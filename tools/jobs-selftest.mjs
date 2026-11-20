// The test of tools/jobs.mjs: node tools/jobs-selftest.mjs
// Runs three tiny made-up jobs (a few seconds in all) in a temporary list (JOBS_DIR) with a cap of 2, and checks the
// cap, a name held while running, wait's exit code and freshness check, stop, and the list.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const JOBS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-test-'));
let held = 0, failed = 0;
const jobs = (...args) => {
  const r = spawnSync(process.execPath, [JOBS, ...args], { encoding: 'utf8', env: { ...process.env, JOBS_DIR: dir, JOBS_CAP: '2', CLAUDE_CODE_SESSION_ID: 'test0000' }, timeout: 60e3 });
  return { code: r.status, out: r.stdout + r.stderr };
};
function expect(name, r, code, text) {
  const ok = r.code === code && (!text || r.out.includes(text));
  ok ? held++ : failed++;
  if (!ok) console.log(`FAIL ${name}: code ${r.code} (wanted ${code})${text ? `, wanted "${text}"` : ''}\n  ${r.out.trim()}`);
}
// a made-up job: sleeps <ms>, then writes <file> (if given) and ends with <code>
const job = path.join(dir, 'job.cjs');
fs.writeFileSync(job, "const [ms, code, file] = process.argv.slice(2); setTimeout(() => { if (file) require('fs').writeFileSync(file, 'x'); process.exit(Number(code)); }, Number(ms));\n");
const run = (ms, code, file) => ['--', `"${process.execPath}"`, `"${job}"`, String(ms), String(code), ...(file ? [`"${file}"`] : [])];
const out = path.join(dir, 'result.txt'), stale = path.join(dir, 'old.txt');
fs.writeFileSync(stale, 'made before the job');
fs.utimesSync(stale, new Date(Date.now() - 3600e3), new Date(Date.now() - 3600e3));

expect('a bad name is refused', jobs('start', 'no way', ...run(10, 0)), 2, 'a job name');
expect('no command is refused', jobs('start', 'a'), 2, 'after --');
expect('start a', jobs('start', 'a', '--out', out, '--minutes', '1', ...run(1500, 0, out)), 0, 'started a');
expect('the same name while it runs is refused', jobs('start', 'a', ...run(10, 0)), 2, 'is running');
expect('start long', jobs('start', 'long', ...run(30000, 0)), 0, 'started long');
expect('the cap holds', jobs('start', 'c', ...run(10, 0)), 2, 'the cap is 2');
expect('the list shows them running', jobs('list'), 0, 'a: running');
expect('wait a: fresh and code 0', jobs('wait', 'a', '--timeout', '30'), 0, 'is fresh');
expect('stop long', jobs('stop', 'long'), 0, 'stopped long');
expect('the list shows it stopped', jobs('list'), 0, 'long: stopped');
expect('wait on a stopped job', jobs('wait', 'long'), 1, 'no result');
expect('stop when not running is refused', jobs('stop', 'long'), 2, 'not running');
expect('start b: a failing job', jobs('start', 'b', '--out', stale, ...run(200, 3)), 0);
expect('wait b: its code and a stale result', jobs('wait', 'b', '--timeout', '30'), 1, 'code 3');
expect('wait b names the stale file', jobs('wait', 'b'), 1, 'STALE');
expect('the log holds the run', { code: 0, out: fs.readFileSync(path.join(dir, 'b.log'), 'utf8') }, 0, 'end: code 3');
expect('no such job', jobs('wait', 'nothing'), 2, 'no job');

Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${held} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
