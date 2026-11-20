// The delivery hooks' test: node tools/hook-selftest.mjs
// Feeds hook.mjs made-up inputs in a made-up project folder (DELIVERY_REPO) and checks what it says, and that it
// ends with code 0 every time, garbage input and a missing view included.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hook.mjs');
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-hook-test-'));
let held = 0, failed = 0;
const hook = (ev, input) => {
  const r = spawnSync(process.execPath, [HOOK, ev], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8',
    env: { ...process.env, DELIVERY_REPO: repo }, timeout: 8000 });
  return { code: r.status, out: r.stdout };
};
function expect(name, r, has) {
  const ok = r.code === 0 && (has === '' ? r.out === '' : r.out.includes(has));
  ok ? held++ : failed++;
  if (!ok) console.log(`FAIL ${name}: code ${r.code}, out ${JSON.stringify(r.out)}`);
}
const B = 'builder-session', Q = 'qa-session';
expect('no view: start says nothing', hook('start', { session_id: B }), '');
fs.mkdirSync(path.join(repo, 'reports', 'delivery'), { recursive: true });
const writeView = dir => fs.writeFileSync(path.join(repo, ...dir.split('/'), 'features.json'), JSON.stringify({ roles: { builder: B, qa: Q },
  features: [{ id: 'F01', name: 'Export a report', state: 'building', budgetH: 16, usedH: 3.5,
    tasks: [{ id: 'F01-T1', state: 'passed' }, { id: 'F01-T2', state: 'open' }, { id: 'F01-T3', state: 'cut' }] }],
  improvements: [{ id: 'I1', result: null }] }));
writeView('reports/delivery');
const s = hook('start', { session_id: B, source: 'startup' });
expect('start: role', s, 'Your role: builder.');
expect('start: feature', s, 'F01 Export a report (building), 1 of 2 tasks passed, 3.5h of 16h');
expect('start: next', s, 'feat.mjs next');
expect('start: changes tried', s, 'I1');
if (s.out.length > 600) { failed++; console.log('FAIL start over 600 characters'); } else held++;
expect('start: no role', hook('start', { session_id: 'someone' }), 'no delivery role');
expect('edit of the record', hook('post', { session_id: Q, tool_name: 'Edit', tool_input: { file_path: 'C:\\work\\project\\reports\\delivery\\events.jsonl' } }), 'written only by');
expect('edit of another file', hook('post', { session_id: Q, tool_name: 'Edit', tool_input: { file_path: 'C:/work/project/src/a.ts' } }), '');
const commit = { session_id: B, tool_name: 'Bash', tool_input: { command: 'git commit -m "x" -- src/a.ts' } };
expect('builder commit', hook('post', commit), 'F01-T2 of F01 is open');
expect('the same note within 30 minutes', hook('post', commit), '');
expect('qa commit', hook('post', { ...commit, session_id: Q }), '');
expect('feat.mjs own commit', hook('post', { session_id: 'other-builder', tool_name: 'Bash', tool_input: { command: 'node tools/feat.mjs built F01-T2 --commit abc && git commit' } }), '');
expect('a helper', hook('post', { ...commit, session_id: B, agent_id: 'x' }), '');
expect('garbage input', hook('post', '{not json'), '');
expect('no input', hook('start', ''), '');
// a project that keeps its record elsewhere (team-workflow.json)
fs.writeFileSync(path.join(repo, 'team-workflow.json'), JSON.stringify({ deliveryDir: 'docs/delivery', ownerName: 'the client' }));
fs.mkdirSync(path.join(repo, 'docs', 'delivery'), { recursive: true });
writeView('docs/delivery');
expect('configured: the sender', hook('start', { session_id: B }), 'not the client');
expect('configured: edit of the record', hook('post', { session_id: Q, tool_name: 'Write', tool_input: { file_path: '/home/u/project/docs/delivery/features.json' } }), 'docs/delivery/ is written only by');
expect('configured: the old place is not the record', hook('post', { session_id: Q, tool_name: 'Write', tool_input: { file_path: '/home/u/project/reports/delivery/features.json' } }), '');
fs.mkdirSync(path.join(repo, 'build', 'team'), { recursive: true });
fs.writeFileSync(path.join(repo, 'build', 'team', 'hooks-off'), 'test');
expect('switched off', hook('start', { session_id: B }), '');
fs.rmSync(repo, { recursive: true, force: true });
console.log(`${held} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
