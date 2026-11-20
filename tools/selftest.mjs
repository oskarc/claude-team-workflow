// Every test of the kit's tools, one at a time: node tools/selftest.mjs (npm test)
// Each test makes its own temporary folder and never touches the project's record, job list or notes.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const python = ['python3', 'python'].find(p => spawnSync(p, ['--version'], { encoding: 'utf8' }).status === 0);
const tests = [
  ['node', 'feat-selftest.mjs'], ['node', 'hook-selftest.mjs'], ['node', 'jobs-selftest.mjs'],
  ['python', 'notes_selftest.py'], ['python', 'metrics_selftest.py'],
];
let bad = 0;
for (const [kind, file] of tests) {
  if (kind === 'python' && !python) { console.log(`${file}: skipped, no python on PATH`); continue; }
  const [exe, args] = kind === 'node' ? [process.execPath, [path.join(HERE, file)]] : [python, ['-I', path.join(HERE, file)]];
  const r = spawnSync(exe, args, { encoding: 'utf8', timeout: 180e3 });
  const last = (r.stdout + r.stderr).trim().split('\n').pop();
  console.log(`${file}: ${last}`);
  if (r.status !== 0) { bad++; console.log((r.stdout + r.stderr).trim()); }
}
process.exit(bad ? 1 : 0);
