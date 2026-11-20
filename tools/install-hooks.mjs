// The delivery hooks' installer: the only thing that writes their command lines into a settings file.
//   node tools/install-hooks.mjs --settings <file> --owner-word "<the owner's words>" --date <YYYY-MM-DD>
//   node tools/install-hooks.mjs --remove --settings <file>
// Its rules (docs/team.md, "Hooks"):
//   1. it runs the hooks' test (hook-selftest.mjs) and refuses when it fails;
//   2. it copies hook.mjs to <stateDir>/live/ (what sessions run is this copy, never the file helpers edit);
//   3. it tries each exact command line through a shell with a made-up input; each must end with code 0;
//   4. it writes two entries (SessionStart; PostToolUse for Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell), each
//      with a timeout of 5 seconds, never a PreToolUse or Stop entry, keeping everything else in the file; it writes by
//      rename and reads the file back; the file as it was is kept beside it (<file>.before-delivery).
// Every session of the project reads .claude/settings.json and .claude/settings.local.json, so an install there
// reaches every session: it needs the owner's word (--owner-word, --date), which is kept in <stateDir>/installed.json.
// --remove takes out every entry whose command names the delivery hook, and nothing else.
// Switch off without the settings file: make the file <stateDir>/hooks-off.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CFG = loadConfig(), REPO = CFG.root;
const STATE = CFG.abs(CFG.stateDir), LIVE = path.join(STATE, 'live'), MARK = `${CFG.stateDir}/live/hook.mjs`;
const NODE = process.execPath.replace(/\\/g, '/'), R = REPO.replace(/\\/g, '/');
const line = ev => `"${NODE}" "${R}/${CFG.stateDir}/live/hook.mjs" ${ev} "${R}"`;
const ENTRIES = { SessionStart: { cmd: line('start') }, PostToolUse: { matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell', cmd: line('post') } };
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(`--${k}`); return i < 0 ? undefined : args[i + 1]; };
const die = (m, c = 2) => { console.error(`refused: ${m}`); process.exit(c); };

const file = opt('settings') ?? die('--settings <file> is needed');
const read = () => { if (!fs.existsSync(file)) return {}; try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { die(`${file} is not JSON`); } };
const ours = h => (h.hooks ?? []).every(x => String(x.command ?? '').includes(MARK));
function writeBack(obj) {
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

if (args.includes('--remove')) {
  const s = read();
  for (const ev of Object.keys(s.hooks ?? {})) {
    s.hooks[ev] = s.hooks[ev].filter(h => !ours(h));
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  const back = writeBack(s);
  if (JSON.stringify(back).includes(MARK)) die('a delivery hook line is still in the file', 1);
  console.log(`the delivery hooks are out of ${file}`);
  process.exit(0);
}

const word = opt('owner-word'), date = opt('date');
if (!word || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) die('an install reaches every session of the project: --owner-word "<the owner\'s words>" --date <YYYY-MM-DD>');
const test = spawnSync(process.execPath, [path.join(HERE, 'hook-selftest.mjs')], { encoding: 'utf8' });
if (test.status !== 0) die(`the hooks' test fails:\n${test.stdout}`);
fs.mkdirSync(LIVE, { recursive: true });
fs.copyFileSync(path.join(HERE, 'hook.mjs'), path.join(LIVE, 'hook.mjs.tmp'));
fs.renameSync(path.join(LIVE, 'hook.mjs.tmp'), path.join(LIVE, 'hook.mjs'));
// Claude Code runs a hook's command through a shell: bash where there is one (Git Bash on Windows), so try it there.
const bash = process.env.TEAM_WORKFLOW_BASH ?? (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
for (const [ev, e] of Object.entries(ENTRIES)) {
  const input = JSON.stringify(ev === 'SessionStart' ? { session_id: 'install-trial', source: 'startup' } : { session_id: 'install-trial', tool_name: 'Bash', tool_input: { command: 'ls' } });
  const r = spawnSync(bash, ['-c', e.cmd], { input, encoding: 'utf8', timeout: 8000 });
  if (r.error) die(`no shell to try the command lines in (${bash}: ${r.error.message}); set TEAM_WORKFLOW_BASH to one`);
  if (r.status !== 0) die(`the line for ${ev} ended with code ${r.status}: ${e.cmd}\n${r.stderr}`);
}
const s = read();
if (fs.existsSync(file)) fs.copyFileSync(file, file + '.before-delivery');
s.hooks ??= {};
for (const [ev, e] of Object.entries(ENTRIES)) {
  s.hooks[ev] = (s.hooks[ev] ?? []).filter(h => !ours(h));
  s.hooks[ev].push({ ...(e.matcher ? { matcher: e.matcher } : {}), hooks: [{ type: 'command', command: e.cmd, timeout: 5 }] });
}
const back = writeBack(s);
for (const [ev, e] of Object.entries(ENTRIES)) if (!JSON.stringify(back.hooks?.[ev] ?? []).includes(JSON.stringify(e.cmd).slice(1, -1))) die(`read back: ${ev} is missing`, 1);
fs.writeFileSync(path.join(STATE, 'installed.json'), JSON.stringify({ file, at: new Date().toISOString(), ownerWord: word, date }, null, 1));
console.log(`installed in ${file}: SessionStart and PostToolUse (${ENTRIES.PostToolUse.matcher}); remove with --remove --settings ${file}`);
