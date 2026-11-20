// The delivery list's test: node tools/feat-selftest.mjs
// Runs feat.mjs in a new temporary folder (DELIVERY_DIR: nothing is committed) as four made-up sessions, and checks
// that every rule of the flow holds: what each role may do, one feature in build, a pass only from QA with evidence,
// tasks never removed, a retrospective before the next start, its changes measured, a hand edit of the record found.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FEAT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'feat.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-test-'));
// A made-up project root, so the test never reads the real project's settings or touches its record.
const root = path.join(dir, 'project'), real = path.join(root, 'reports', 'delivery');
fs.mkdirSync(real, { recursive: true });
const LEAD = 'lead-0000', BUILDER = 'build-000', QA = 'qa-000000', OTHER = 'other-000';
let failed = 0, held = 0;

function featIn(extra, who, ...args) {
  const r = spawnSync(process.execPath, [FEAT, ...args], { encoding: 'utf8',
    env: { ...process.env, TEAM_WORKFLOW_ROOT: root, DELIVERY_DIR: dir, DELIVERY_SESSION: who, CLAUDE_CODE_SESSION_ID: '', DELIVERY_NOW: '', DELIVERY_TRANSCRIPTS: '', ...extra } });
  return { code: r.status, out: r.stdout + r.stderr };
}
const feat = (who, ...args) => featIn({}, who, ...args);
// a local time like 2026-11-17T01:24, so many hours from now
const loc = h => { const d = new Date(Date.now() + h * 3600e3), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function expect(name, r, code, text) {
  const ok = r.code === code && (!text || r.out.includes(text));
  ok ? held++ : failed++;
  if (!ok) console.log(`FAIL ${name}: code ${r.code} (wanted ${code})${text ? `, wanted "${text}"` : ''}\n  ${r.out.trim().split('\n').join('\n  ')}`);
}
const UC = 'The user opens the reports page and exports a report as a file';
const task = (who, f, extra = []) => feat(who, 'task', 'add', f, '--use-case', UC, '--desc', 'The export button on the reports page saves the report',
  '--done', 'The file is saved with the report in it on the stage build', '--size', 'M', '--kind', 'feature', '--screens', 'Reports page', '--steps', 'open reports, press export, open the saved file', ...extra);
const EVID = 'Stage build 263: opened reports, pressed export, the saved file held the report';

// roles
expect('join lead', feat(LEAD, 'join', 'lead'), 0, 'written: lead joined');
expect('a repeat join is refused', feat(LEAD, 'join', 'lead'), 2, 'already the lead');
expect('join builder', feat(BUILDER, 'join', 'builder'), 0);
expect('join qa', feat(QA, 'join', 'qa'), 0);
expect('a held role is refused', feat(OTHER, 'join', 'qa'), 2, 'is held by');
expect('only the lead adds a feature', feat(BUILDER, 'feature', 'add', 'F01', '--name', 'Export a report', '--use-case', UC, '--end', 'The user can export any report and open the file', '--budget', '2d'), 2, 'for lead');
// a feature and its tasks
expect('a feature needs an end', feat(LEAD, 'feature', 'add', 'F01', '--name', 'Export a report', '--use-case', UC, '--budget', '2d'), 2, '--end');
expect('a budget over ten days is refused', feat(LEAD, 'feature', 'add', 'F01', '--name', 'Export a report', '--use-case', UC, '--end', 'The user can export any report and open the file', '--budget', '11d'), 2, 'at most 80h');
expect('feature add', feat(LEAD, 'feature', 'add', 'F01', '--name', 'Export a report', '--use-case', UC, '--end', 'The user can export any report and open the file', '--budget', '2d'), 0);
expect('feature add twice', feat(LEAD, 'feature', 'add', 'F01', '--name', 'Export a report', '--use-case', UC, '--end', 'The user can export any report and open the file', '--budget', '2d'), 2, 'already');
expect('start without tasks', feat(LEAD, 'start', 'F01'), 2, 'no tasks');
expect('a task needs a done-when', feat(LEAD, 'task', 'add', 'F01', '--use-case', UC, '--desc', 'The export button on the reports page saves the report', '--size', 'M', '--screens', 'Reports page', '--steps', 'open reports, press export'), 2, 'one to three');
expect('size XL is refused', feat(LEAD, 'task', 'add', 'F01', '--use-case', UC, '--desc', 'The export button on the reports page saves the report',
  '--done', 'The file is saved with the report in it on the stage build', '--size', 'XL', '--screens', 'Reports page', '--steps', 'open reports, press export'), 2, 'a bigger task is split');
expect('a task needs a kind', feat(LEAD, 'task', 'add', 'F01', '--use-case', UC, '--desc', 'The export button on the reports page saves the report',
  '--done', 'The file is saved with the report in it on the stage build', '--size', 'M', '--kind', 'misc', '--screens', 'Reports page', '--steps', 'open reports, press export'), 2, '--kind is one of');
expect('task add T1', task(LEAD, 'F01'), 0);
expect('task add T2', task(LEAD, 'F01'), 0);
expect('task add T3', task(LEAD, 'F01'), 0);
expect('feature add F02', feat(LEAD, 'feature', 'add', 'F02', '--name', 'Second', '--use-case', UC, '--end', 'The user can do the second thing fully', '--budget', '8h'), 0);
expect('task add F02-T1', task(LEAD, 'F02'), 0);
// the build
expect('builder before start', feat(BUILDER, 'built', 'F01-T1', '--commit', 'abcdef1'), 2, 'not in build');
expect('only the lead sets a budget', feat(BUILDER, 'feature', 'budget', 'F01', '--budget', '3d', '--why', 'the builder sized it at 24h'), 2, 'for lead');
expect('a budget needs a reason', feat(LEAD, 'feature', 'budget', 'F01', '--budget', '3d'), 2, '--why');
expect('budget set before the start', feat(LEAD, 'feature', 'budget', 'F01', '--budget', '3d', '--why', 'the builder sized it at 24h'), 0, 'budget set');
expect('start F01', feat(LEAD, 'start', 'F01'), 0);
expect('no budget change in build', feat(LEAD, 'feature', 'budget', 'F01', '--budget', '4d', '--why', 'running late on it'), 2, 'never extended');
expect('the status shows the new budget', feat(LEAD, 'status'), 0, 'of 24h used');
// a pause: hours the PC was off, left out of the time used
const later = { DELIVERY_NOW: new Date(Date.now() + 5 * 3600e3).toISOString() };
const turns = path.join(dir, 'turns'); fs.mkdirSync(turns);
expect('only the lead pauses', featIn(later, BUILDER, 'feature', 'pause', 'F01', '--from', loc(1), '--to', loc(3), '--why', 'the PC was turned off'), 2, 'for lead');
expect('a pause needs a reason', featIn(later, LEAD, 'feature', 'pause', 'F01', '--from', loc(1), '--to', loc(3)), 2, '--why');
expect('a pause under an hour is refused', featIn(later, LEAD, 'feature', 'pause', 'F01', '--from', loc(1), '--to', loc(1.5), '--why', 'the PC was turned off'), 2, 'at least an hour');
expect('a pause before the start is refused', featIn(later, LEAD, 'feature', 'pause', 'F01', '--from', loc(-3), '--to', loc(-1), '--why', 'the PC was turned off'), 2, 'between');
expect('a pause past now is refused', feat(LEAD, 'feature', 'pause', 'F01', '--from', loc(1), '--to', loc(3), '--why', 'the PC was turned off'), 2, 'between');
fs.writeFileSync(path.join(turns, 's.jsonl'), `{"type":"user","timestamp":"${new Date(Date.now() + 2 * 3600e3).toISOString()}"}\n`);
const future = new Date(Date.now() + 4.5 * 3600e3), touch = () => fs.utimesSync(path.join(turns, 's.jsonl'), future, future);
touch();                                                       // a transcript is written after the turns it holds
expect('a turn in the window refuses it', featIn({ ...later, DELIVERY_TRANSCRIPTS: turns }, LEAD, 'feature', 'pause', 'F01', '--from', loc(1), '--to', loc(3), '--why', 'the PC was turned off'), 2, 'was not off');
fs.writeFileSync(path.join(turns, 's.jsonl'), `{"type":"user","timestamp":"${new Date(Date.now() + 4 * 3600e3).toISOString()}"}\n`);
touch();
// Windows' record as the query prints it: [kind, hours from now], kinds 'sleep' 'wake' 'boot' 'start' 'shutdown' 'other'
const KIND = { sleep: ['Microsoft-Windows-Kernel-Power', 42], wake: ['Microsoft-Windows-Power-Troubleshooter', 1],
  boot: ['Microsoft-Windows-Kernel-Boot', 27], start: ['EventLog', 6005], shutdown: ['EventLog', 6006],
  other: ['Microsoft-Windows-UserModePowerService', 12] };          // id 12 of another provider is not a start
let nP = 0;
const P = (...ev) => { const f = path.join(dir, `power-${nP++}.json`);
  fs.writeFileSync(f, JSON.stringify(ev.map(([k, h]) => ({ p: KIND[k][0], id: KIND[k][1], at: new Date(Date.now() + h * 3600e3).toISOString() })))); return f; };
const at1 = Date.parse(loc(1)), at3 = Date.parse(loc(3)), hFrom = ms => (ms - Date.now()) / 3600e3;   // the window's ends as typed
const pause = (extra, ...args) => featIn({ ...later, DELIVERY_TRANSCRIPTS: turns, ...extra }, LEAD, 'feature', 'pause', 'F01', '--from', loc(1), '--to', loc(3), '--why', 'the PC was turned off', ...args);
expect('a date alone is refused', featIn({ ...later, DELIVERY_TRANSCRIPTS: turns }, LEAD, 'feature', 'pause', 'F01', '--from', loc(1).slice(0, 10), '--to', loc(3), '--why', 'the PC was turned off'), 2, 'local time');
expect('no transcripts refuses it', pause({ DELIVERY_TRANSCRIPTS: path.join(dir, 'none') }), 2, 'transcripts could not be found');
expect('no power record refuses it', pause({}), 2, 'sleep and wake could be read');
expect('no sleep before the start refuses it', pause({ DELIVERY_POWER: P(['sleep', 1.5], ['wake', 4]) }), 2, 'no record of the PC going to sleep');
expect('a wake inside the window refuses it', pause({ DELIVERY_POWER: P(['sleep', 0.9], ['wake', 2], ['sleep', 2.5], ['wake', 4]) }), 2, 'not off for the whole window');
expect('a second sleep inside the window refuses it (its wake logged nothing)', pause({ DELIVERY_POWER: P(['sleep', 0.9], ['sleep', 2], ['wake', 3.02]) }), 2, 'not off for the whole window');
expect('a boot inside the window refuses it', pause({ DELIVERY_POWER: P(['shutdown', 0.9], ['boot', 2], ['wake', 3.5]) }), 2, 'Kernel-Boot 27');
expect('a sleep over a minute after the start refuses it', pause({ DELIVERY_POWER: P(['sleep', hFrom(at1 + 61e3)], ['wake', 4]) }), 2, 'no record of the PC going to sleep');
expect('a wake over a minute before the end refuses it', pause({ DELIVERY_POWER: P(['sleep', 0.5], ['wake', hFrom(at3 - 61e3)]) }), 2, 'not off for the whole window');
for (const [name, spelling] of [['as written', real], ['by \\\\?\\', `\\\\?\\${path.resolve(real)}`], ['by \\\\.\\', `\\\\.\\${path.resolve(real)}`],
  ['by \\\\localhost', `\\\\localhost\\${path.resolve(real).replace(/^([A-Za-z]):/, '$1$$')}`]])
  expect(`the real record is never a test folder (${name})`, featIn({ DELIVERY_DIR: spelling }, LEAD, 'status'), 2, 'never reports/delivery');
expect('pause, within a minute of the sleep and the wake', pause({ DELIVERY_POWER: P(['wake', -1], ['sleep', hFrom(at1 + 50e3)], ['other', 2], ['wake', hFrom(at3 - 50e3)], ['boot', hFrom(at3 - 45e3)]) }), 0, 'paused 2h');
expect('an overlapping pause is refused', featIn(later, LEAD, 'feature', 'pause', 'F01', '--from', loc(2), '--to', loc(4), '--why', 'the PC was turned off'), 2, 'overlaps');
expect('the status leaves the pause out', featIn(later, LEAD, 'status'), 0, '3h of 24h used');
expect('the status names the pause', featIn(later, LEAD, 'status'), 0, 'left out (the PC was off): 2h');
// an idle pause: hours nobody worked, the computer on or off; no turn, no commit and no job on the list
const later9 = { DELIVERY_NOW: new Date(Date.now() + 9 * 3600e3).toISOString(), DELIVERY_TRANSCRIPTS: turns };
const jobsDir = path.join(dir, 'jobs'); fs.mkdirSync(jobsDir);
const T = h => Date.now() + h * 3600e3;
const J = (name, reg, ...ends) => { const f = path.join(jobsDir, `${name}.json`); fs.writeFileSync(f, JSON.stringify(reg));
  for (const [file, ended] of ends) fs.writeFileSync(path.join(jobsDir, file), JSON.stringify({ code: 0, ended })); return f; };
const idle = (extra, from, to, ...args) => featIn({ ...later9, ...extra }, LEAD, 'feature', 'pause', 'F01', '--idle', '--from', loc(from), '--to', loc(to), '--why', 'nobody worked overnight', ...args);
expect('an idle pause with a turn in it is refused', idle({ DELIVERY_JOBS: J('none', {}) }, 3.5, 4.6), 2, 'was not idle');
expect('an idle pause with no job list is refused', idle({}, 5, 7), 2, 'no job list');
expect('an idle pause with a job ending in it is refused', idle({ DELIVERY_JOBS: J('a', { build: { started: T(4.8), end: 'build.end.json' } }, ['build.end.json', T(5.5)]) }, 5, 7), 2, 'a job ran');
expect('an idle pause with a job starting in it is refused', idle({ DELIVERY_JOBS: J('b', { build: { started: T(6), end: 'b2.end.json' } }, ['b2.end.json', T(8)]) }, 5, 7), 2, 'a job ran');
fs.writeFileSync(path.join(jobsDir, 'k.log'), 'x'); fs.utimesSync(path.join(jobsDir, 'k.log'), new Date(T(5.5)), new Date(T(5.5)));
expect('an idle pause over a killed job\'s last log write is refused', idle({ DELIVERY_JOBS: J('c', { killed: { started: T(4), end: 'k.end.json', log: 'k.log' } }) }, 5, 7), 2, 'a job ran');
expect('an unreadable job list refuses it', idle({ DELIVERY_JOBS: path.join(jobsDir, 'missing.json') }, 5, 7), 2, 'job list could not be read');
expect('an empty job list as an array is refused', idle({ DELIVERY_JOBS: J('arr', []) }, 5, 7), 2, 'not a list of jobs');
expect('an idle pause with no transcripts is refused', idle({ DELIVERY_JOBS: J('t0', {}), DELIVERY_TRANSCRIPTS: path.join(dir, 'none') }, 5, 7), 2, 'transcripts could not be found');
expect('a job spanning the whole window refuses it', idle({ DELIVERY_JOBS: J('f', { long: { started: T(4), end: 'long.end.json' } }, ['long.end.json', T(8)]) }, 5, 7), 2, 'a job ran');
expect('a job with no end file and no log counts to now', idle({ DELIVERY_JOBS: J('g', { lost: { started: T(1), end: 'lost.end.json', log: 'lost.log' } }) }, 5, 7), 2, 'a job ran');
expect('an end before the start is not an end', idle({ DELIVERY_JOBS: J('h', { odd: { started: T(4), end: 'odd.end.json' } }, ['odd.end.json', T(2)]) }, 5, 7), 2, 'a job ran');
fs.mkdirSync(path.join(jobsDir, 'root', 'build', 'jobs'), { recursive: true });
fs.writeFileSync(path.join(jobsDir, 'root', 'build', 'jobs', 'r.end.json'), JSON.stringify({ code: 0, ended: T(4.7) }));
expect('a path from the repository\'s root is read from there (its end before the window lets it pass)', idle({ DELIVERY_JOBS: J('i', { rooted: { started: T(4.5), end: 'build\\jobs\\r.end.json' } }), DELIVERY_JOBS_ROOT: path.join(jobsDir, 'root') }, 7.5, 8.5), 0, 'paused 1h (nobody worked)');
fs.writeFileSync(path.join(jobsDir, 'again.log'), 'x');           // made now, before the window: the name ran before
expect('a name started again after the window refuses it', idle({ DELIVERY_JOBS: J('j', { again: { started: T(8), end: 'again.end.json', log: 'again.log' } }, ['again.end.json', T(8.5)]) }, 5, 7), 2, 'also ran before');
expect('--idle with a value is refused', featIn({ ...later9, DELIVERY_JOBS: J('d', {}) }, LEAD, 'feature', 'pause', 'F01', '--from', loc(5), '--to', loc(7), '--why', 'nobody worked overnight', '--idle', 'yes'), 2, 'takes no value');
fs.writeFileSync(path.join(jobsDir, 'silent.log'), ''); fs.utimesSync(path.join(jobsDir, 'silent.log'), new Date('2026-11-09T00:00:00Z'), new Date('2026-11-09T00:00:00Z'));
expect('an idle pause needs no power record (a job before it, and an old ended one, are fine)', idle({ DELIVERY_JOBS: J('e', { old: { started: T(3), end: 'o.end.json' },
  early: { started: Date.parse('2026-11-10T00:00:00Z'), over: true, log: 'silent.log' } }, ['o.end.json', T(4.9)]) }, 5, 7), 0, 'paused 2h (nobody worked)');
expect('the status names both kinds', featIn(later9, LEAD, 'status'), 0, 'left out (the PC was off or nobody worked): 5h in 3 pauses');
expect('one feature in build', feat(LEAD, 'start', 'F02'), 2, 'one feature at a time');
expect('qa cannot mark built', feat(QA, 'built', 'F01-T1', '--commit', 'abcdef1'), 2, 'for builder');
expect('built T1', feat(BUILDER, 'built', 'F01-T1', '--commit', 'abcdef1'), 0);
expect('the builder cannot pass', feat(BUILDER, 'pass', 'F01-T1', '--evidence', EVID), 2, 'for qa');
expect('pass needs evidence', feat(QA, 'pass', 'F01-T1', '--evidence', 'ok'), 2, '--evidence');
expect('pass an open task', feat(QA, 'pass', 'F01-T2', '--evidence', EVID), 2, 'QA checks a built task');
expect('fail T1', feat(QA, 'fail', 'F01-T1', '--why', 'the file was empty'), 0);
expect('next shows the fail', feat(BUILDER, 'next'), 0, 'the file was empty');
expect('built T1 again', feat(BUILDER, 'built', 'F01-T1', '--commit', 'abcdef2'), 0);
expect('pass T1', feat(QA, 'pass', 'F01-T1', '--evidence', EVID), 0);
expect('look before all pass', feat(LEAD, 'look', 'F01', '--stage', '263'), 2, 'every task');
expect('a task added after the start', task(LEAD, 'F01'), 0);
expect('cut T4', feat(LEAD, 'task', 'cut', 'F01-T4', '--why', 'out of scope for this budget'), 0);
expect('status counts scope change', feat(LEAD, 'status'), 0, '1 added, 1 cut');
for (const t of ['F01-T2', 'F01-T3']) { expect(`built ${t}`, feat(BUILDER, 'built', t, '--commit', 'abcdef3'), 0); expect(`pass ${t}`, feat(QA, 'pass', t, '--evidence', EVID), 0); }
expect('status: checking', feat(LEAD, 'status'), 0, 'Checking: F01');
expect('done before look', feat(LEAD, 'done', 'F01', '--owner-words', 'good', '--date', '2026-11-17'), 2, "after the owner's look");
expect('look', feat(LEAD, 'look', 'F01', '--stage', '263'), 0);
expect('done', feat(LEAD, 'done', 'F01', '--owner-words', 'good', '--date', '2026-11-17'), 0);
// the retrospective
expect('no start without a retrospective', feat(LEAD, 'start', 'F02'), 2, 'no retrospective');
fs.writeFileSync(path.join(dir, 'retro-F01.md'), '# F01\n');
expect('retro needs a measure', feat(LEAD, 'retro', 'F01', '--file', 'retro-F01.md', '--change', 'QA checks on the phone size first'), 2, 'is measured');
expect('retro', feat(LEAD, 'retro', 'F01', '--file', 'retro-F01.md', '--change', 'QA checks on the phone size first | fails found after look, count'), 0);
expect('status shows the change', feat(LEAD, 'status'), 0, 'I1 QA checks');
expect('start F02', feat(LEAD, 'start', 'F02'), 0);
expect('stop F02', feat(LEAD, 'stop', 'F02', '--why', 'the budget ran out, re-plan'), 0);
fs.writeFileSync(path.join(dir, 'retro-F02.md'), '# F02\n');
expect('the last change is measured first', feat(LEAD, 'retro', 'F02', '--file', 'retro-F02.md', '--change', 'Smaller tasks for the export | tasks over budget, count'), 2, 'I1');
expect('retro F02 with a result', feat(LEAD, 'retro', 'F02', '--file', 'retro-F02.md', '--change', 'Smaller tasks for the export | tasks over budget, count',
  '--result', 'I1=kept:no fails found after the look on F02'), 0);
// the record
const ev = path.join(dir, 'events.jsonl');
const lines = fs.readFileSync(ev, 'utf8').split('\n');
fs.writeFileSync(path.join(dir, 'features.json'), '{}');
expect('a hand edit of the view is overwritten', feat(LEAD, 'check'), 0, 'each following');
if (!fs.readFileSync(path.join(dir, 'features.json'), 'utf8').includes('F02')) { failed++; console.log('FAIL the view was not written again'); } else held++;
fs.writeFileSync(ev, lines.map(l => l.replace('"the file was empty"', '"fine"')).join('\n'));
expect('a changed line is found', feat(LEAD, 'status'), 2, 'by hand');
fs.writeFileSync(ev, lines.filter((_, i) => i !== 5).join('\n'));
expect('a removed line is found', feat(LEAD, 'status'), 2, 'by hand');

fs.rmSync(dir, { recursive: true, force: true });
console.log(`${held} held, ${failed} failed`);
process.exit(failed ? 1 : 0);
