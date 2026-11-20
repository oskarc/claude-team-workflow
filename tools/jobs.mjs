// One list for every long job on this computer (builds, renders, test suites, data runs), with a cap, so the computer
// is never overloaded by several sessions at once and every result can be traced to the run that made it.
// The skill heavy-job says when and how to use it. Its test: node tools/jobs-selftest.mjs
//
//   node tools/jobs.mjs start <name> [--out <file>] [--minutes <n>] -- <command ...>
//        refused while <cap> jobs run (team-workflow.json "jobsCap", 2 by default) or a job of that name runs;
//        the command runs detached through the shell, its output into <jobsDir>/<name>.log (appended);
//        --out names the file it makes (wait checks that it is fresh); --minutes is how long it should take
//        (the lead asks its owner when a job runs past twice that)
//   node tools/jobs.mjs list                      every job: running, ended (its exit code), stopped or lost
//   node tools/jobs.mjs wait <name> [--timeout <seconds>]
//        until it ends; prints its exit code and whether --out was written after the start (fresh) or not (stale);
//        exit 0 only for exit code 0 and a fresh --out
//   node tools/jobs.mjs stop <name>               ends the job and every process it started (the whole tree)
//
// The list is <jobsDir>/registry.json: { <name>: { started, cmd, log, end, out, minutes, by, pid } }. A job's end file
// <jobsDir>/<name>.end.json ({ code, ended }) is written when it ends; a job with no end file whose process is gone
// was killed some other way ("lost"). feat.mjs reads the same list to refuse an idle pause over a job that ran.
// Test runs: JOBS_DIR=<folder> keeps the list there.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';

const SELF = fileURLToPath(import.meta.url);
const CFG = loadConfig();
const DIR = process.env.JOBS_DIR ? path.resolve(process.env.JOBS_DIR) : CFG.abs(CFG.jobsDir);
const REG = path.join(DIR, 'registry.json'), LOCK = path.join(DIR, '.lock');
let CAP = 2;
try { CAP = Number(JSON.parse(fs.readFileSync(path.join(CFG.root, 'team-workflow.json'), 'utf8')).jobsCap ?? 2); } catch { /* default */ }
if (process.env.JOBS_CAP) CAP = Number(process.env.JOBS_CAP);
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

// A refusal is thrown, so the lock's finally runs before the exit.
class Refusal extends Error { constructor(m, code) { super(m); this.code = code; } }
const die = (m, code = 2) => { throw new Refusal(m, code); };
process.on('uncaughtException', e => {
  if (e instanceof Refusal) { console.error(`refused: ${e.message}`); process.exit(e.code); }
  console.error(e?.stack ?? e); process.exit(1);
});
const readReg = () => { try { return JSON.parse(fs.readFileSync(REG, 'utf8')); } catch { return {}; } };
function writeReg(reg) { const t = REG + '.tmp'; fs.writeFileSync(t, JSON.stringify(reg, null, 1)); fs.renameSync(t, REG); }
function locked(fn) {
  fs.mkdirSync(DIR, { recursive: true });
  const until = Date.now() + 5000;
  for (;;) {
    try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); break; } catch {
      if (Date.now() > until) die(`the list is held (${LOCK}); when no jobs.mjs command runs, delete that file`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try { return fn(); } finally { fs.rmSync(LOCK, { force: true }); }
}
const endOf = (name, j) => { try { return JSON.parse(fs.readFileSync(j?.end ?? path.join(DIR, `${name}.end.json`), 'utf8')); } catch { return null; } };
const alive = pid => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
function state(name, j) {
  const e = endOf(name, j);
  if (e) return e.stopped ? { s: 'stopped', e } : { s: 'ended', e };
  return alive(j.pid) ? { s: 'running' } : { s: 'lost' };
}
const mins = ms => `${Math.round(ms / 60e3)} min`;

const argv = process.argv.slice(2), [cmd, name] = argv;
const opt = k => { const i = argv.indexOf(`--${k}`), dd = argv.indexOf('--'); return i < 0 || (dd >= 0 && i > dd) ? undefined : argv[i + 1]; };

if (cmd === '_run') {                                          // the detached wrapper: runs the command, writes the end file
  const j = readReg()[name];
  const log = fs.openSync(j.log, 'a');
  fs.writeSync(log, `\n--- ${new Date().toISOString()} start: ${j.cmd}\n`);
  const child = spawn(j.cmd, { shell: true, stdio: ['ignore', log, log], windowsHide: true });
  const finish = code => {
    fs.writeSync(log, `--- ${new Date().toISOString()} end: code ${code}\n`);
    fs.writeFileSync(j.end, JSON.stringify({ code, ended: Date.now() }));
    process.exit(0);
  };
  child.on('exit', code => finish(code ?? 1));
  child.on('error', () => finish(127));
} else if (cmd === 'start') {
  if (!NAME.test(name ?? '')) die('a job name is letters, digits, dot, dash and underscore');
  const dd = argv.indexOf('--');
  if (dd < 0 || dd === argv.length - 1) die('the command comes after --');
  const command = argv.slice(dd + 1).join(' ');
  const minutes = opt('minutes') ? Number(opt('minutes')) : null;
  if (minutes !== null && !(minutes > 0)) die('--minutes is a number above 0');
  locked(() => {
    const reg = readReg();
    if (reg[name] && state(name, reg[name]).s === 'running') die(`${name} is running (node tools/jobs.mjs list)`);
    const running = Object.entries(reg).filter(([n, j]) => state(n, j).s === 'running');
    if (running.length >= CAP) die(`${running.length} jobs run, the cap is ${CAP}: ${running.map(([n]) => n).join(', ')}. Wait for one (node tools/jobs.mjs wait <name>)`);
    const end = path.join(DIR, `${name}.end.json`);
    fs.rmSync(end, { force: true });
    reg[name] = { started: Date.now(), cmd: command, log: path.join(DIR, `${name}.log`), end,
      out: opt('out') ? path.resolve(opt('out')) : null, minutes, by: (process.env.CLAUDE_CODE_SESSION_ID ?? '').slice(0, 8) || 'owner', pid: null };
    writeReg(reg);
    const w = spawn(process.execPath, [SELF, '_run', name], { detached: true, stdio: 'ignore', windowsHide: true,
      env: { ...process.env, JOBS_DIR: DIR } });
    reg[name].pid = w.pid;
    writeReg(reg);
    w.unref();
    console.log(`started ${name} (pid ${w.pid}); its log: ${reg[name].log}`);
  });
} else if (cmd === 'list' || !cmd) {
  const reg = readReg(), rows = Object.entries(reg);
  if (!rows.length) console.log('no jobs on the list');
  for (const [n, j] of rows) {
    const { s, e } = state(n, j), ran = (e?.ended ?? Date.now()) - j.started;
    const late = s === 'running' && j.minutes && ran > 2 * j.minutes * 60e3 ? ` - PAST TWICE ITS ${j.minutes} MIN: ask ${j.by}` : '';
    console.log(`${n}: ${s}${e && !e.stopped ? ` (code ${e.code})` : ''}, ${mins(ran)}${j.minutes ? ` of ${j.minutes} min` : ''}, by ${j.by}${late}\n  ${j.cmd.slice(0, 120)}`);
  }
} else if (cmd === 'wait') {
  const j = readReg()[name] ?? die(`no job ${name}`);
  const until = opt('timeout') ? Date.now() + Number(opt('timeout')) * 1000 : Infinity;
  let st;
  while ((st = state(name, j)).s === 'running') {
    if (Date.now() > until) die(`${name} still runs after ${opt('timeout')} s`, 3);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (st.s !== 'ended') die(`${name} was ${st.s}; it has no result`, 1);
  let fresh = null;
  if (j.out) { try { fresh = fs.statSync(j.out).mtimeMs >= j.started - 1000; } catch { fresh = false; } }
  console.log(`${name} ended with code ${st.e.code}${j.out ? `; ${j.out} is ${fresh ? 'fresh (written after the start)' : 'STALE or missing: not this run\'s result'}` : ''}`);
  process.exit(st.e.code === 0 && fresh !== false ? 0 : 1);
} else if (cmd === 'stop') {
  locked(() => {
    const reg = readReg(), j = reg[name] ?? die(`no job ${name}`);
    if (state(name, j).s !== 'running') die(`${name} is not running`);
    // The whole tree: stopping only the wrapper would leave the command and its children running.
    if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(j.pid)], { stdio: 'ignore' });
    else { try { process.kill(-j.pid, 'SIGTERM'); } catch { try { process.kill(j.pid, 'SIGTERM'); } catch { /* gone */ } } }
    fs.writeFileSync(j.end, JSON.stringify({ code: null, ended: Date.now(), stopped: true }));
    console.log(`stopped ${name}; check with node tools/jobs.mjs list that nothing of it runs`);
  });
} else die(`no command "${cmd}"; the commands are at the top of tools/jobs.mjs`);
