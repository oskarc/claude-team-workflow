// The delivery hooks: node tools/hook.mjs <start|post> [<project root>]
// Built at the owner's word ("id like you to gather or create skills and hooks designed to strengthen the
// workflow"); installed only by tools/install-hooks.mjs. Its test: node tools/hook-selftest.mjs
//
//   start  (SessionStart) under 600 characters into the context: this session's role in the delivery flow, the
//          feature in build with its tasks passed and budget used, and the command for its next task.
//   post   (PostToolUse) two notes beside a tool's result, nothing else:
//          - a file of the delivery record was edited by hand: the record is written only by feat.mjs (every time);
//          - the builder made a commit while a task of the feature in build is open: mark it built when the commit
//            finishes it (at most once in 30 minutes a session).
//
// The safety rules of the team's hooks (docs/team.md, "Hooks") hold here: everything is inside one catch, any fault
// ends with exit code 0 and no output; it ends itself after three seconds; it never ends with code 2, so it can never
// hold a stop or refuse a call; while <stateDir>/hooks-off exists it does nothing. It reads small files only (the
// view <deliveryDir>/features.json and team-workflow.json), and runs no program.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const end = () => process.exit(0);
setTimeout(end, 3000).unref?.();
process.on('uncaughtException', end);
process.on('unhandledRejection', end);

// the project's root: the test's folder, else the installed command line's second argument, else the folder above tools/
const REPO = process.env.DELIVERY_REPO ?? process.argv[3] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let CFG = {};
try { CFG = JSON.parse(fs.readFileSync(path.join(REPO, 'team-workflow.json'), 'utf8')); } catch { /* the defaults */ }
const rel = (v, d) => String(v ?? d).replace(/\\/g, '/').replace(/\/+$/, '');
const DELIVERY = rel(CFG.deliveryDir, 'reports/delivery'), STATE_DIR = rel(CFG.stateDir, 'build/team');
const VIEW = path.join(REPO, ...DELIVERY.split('/'), 'features.json');
const STATE = path.join(REPO, ...STATE_DIR.split('/'), 'hook-state');
const OFF = path.join(REPO, ...STATE_DIR.split('/'), 'hooks-off');
const NOTE_APART = 30 * 60e3, START_MAX = 600;
const SENDER = `The delivery hook (a program, not ${CFG.ownerName ?? 'the owner'}):`;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RECORD = new RegExp(`(^|/)${esc(DELIVERY)}/(events\\.jsonl|features\\.json)$`, 'i');

function readInput() {
  try { const t = fs.readFileSync(0, 'utf8'); return t.trim() ? JSON.parse(t) : {}; } catch { return {}; }
}
function view() { try { return JSON.parse(fs.readFileSync(VIEW, 'utf8')); } catch { return null; } }
const roleOf = (v, id) => Object.entries(v?.roles ?? {}).find(([, s]) => s === id)?.[0] ?? null;
const inBuild = v => (v?.features ?? []).find(f => ['building', 'checking', 'look'].includes(f.state));

function start(input) {
  const v = view();
  if (!v || !input.session_id) return;
  const role = roleOf(v, input.session_id), f = inBuild(v);
  const parts = [`${SENDER} delivery flow (tools/feat.mjs; skills shape-feature, build-task, verify-task, feature-retro).`];
  parts.push(role ? `Your role: ${role}.` : 'This session has no delivery role yet: node tools/feat.mjs join <lead|builder|qa|design>.');
  if (f) {
    const live = f.tasks.filter(t => t.state !== 'cut'), pass = live.filter(t => t.state === 'passed').length;
    parts.push(`In build: ${f.id} ${f.name.slice(0, 50)} (${f.state}), ${pass} of ${live.length} tasks passed, ${f.usedH}h of ${f.budgetH}h at the last write.`);
  } else parts.push('No feature in build.');
  if (role === 'builder' || role === 'qa') parts.push('Your next task: node tools/feat.mjs next.');
  const tried = (v.improvements ?? []).filter(i => !i.result).map(i => i.id);
  if (tried.length) parts.push(`Changes being tried: ${tried.join(', ')} (feat.mjs status).`);
  let text = parts.join(' ');
  if (text.length > START_MAX) text = text.slice(0, START_MAX - 1) + '…';
  process.stdout.write(text + '\n');
}

function noteOnce(id, key) {
  const file = path.join(STATE, `${String(id).replace(/[^0-9a-zA-Z-]/g, '')}.json`);
  let s = {};
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }
  if (s[key] && Date.now() - s[key] < NOTE_APART) return false;
  s[key] = Date.now();
  fs.mkdirSync(STATE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s));
  return true;
}
const say = text => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `${SENDER} ${text}` } }));

function post(input) {
  const name = input.tool_name ?? '', ti = input.tool_input ?? {};
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name)) {
    const p = String(ti.file_path ?? ti.notebook_path ?? '').replace(/\\/g, '/');
    if (RECORD.test(p))
      say(`${DELIVERY}/ is written only by tools/feat.mjs. This edit breaks the record or is overwritten. Run: node tools/feat.mjs check; if it refuses, node tools/feat.mjs repair. Then make the change through a feat.mjs command.`);
    return;
  }
  if (name === 'Bash' || name === 'PowerShell') {
    if (!/\bgit\b[^\n|;&]*\bcommit\b/.test(String(ti.command ?? ''))) return;
    if (/tools\/feat\.mjs/.test(String(ti.command ?? ''))) return;
    const v = view(), f = inBuild(v);
    if (!f || roleOf(v, input.session_id) !== 'builder') return;
    const open = f.tasks.filter(t => t.state === 'open').map(t => t.id);
    if (!open.length || !noteOnce(input.session_id, 'commit')) return;
    say(`a commit while ${open.join(', ')} of ${f.id} ${open.length > 1 ? 'are' : 'is'} open. When this commit finishes a task: node tools/feat.mjs built <task> --commit <sha>, then the skill build-task's last step.`);
  }
}

try {
  if (!fs.existsSync(OFF)) {
    const input = readInput();
    if (input.agent_id) end();                       // a helper's call: nothing
    if (process.argv[2] === 'start') start(input);
    else if (process.argv[2] === 'post') post(input);
  }
} catch { /* a fault lets the call through */ }
end();
