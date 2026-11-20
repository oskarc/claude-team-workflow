// The delivery list: features with an end, tasks with a use case and a done-when, one feature in build at a time,
// a pass only from QA, a retrospective after every finished or stopped feature, and a burnup from the record.
// The owner, when it was made: "We need to break the work down to work tasks with a clear usecase and description ...
// we dont use any form of burndown or way to measure wether we finish any features", and "self improvement are very
// important so we need that to be a part of the flow" (docs/decisions.md).
// How the team uses it: the skills shape-feature, build-task, verify-task and feature-retro (.claude/skills/).
// Its settings: team-workflow.json at the project's root (tools/config.mjs). Its test: node tools/feat-selftest.mjs
//
// The record is <deliveryDir>/events.jsonl, one event a line, never edited: each line holds the hash of the line
// before it, so a line changed or taken out by hand is found at the next command and every command is refused until
// `repair` puts the committed file back. <deliveryDir>/features.json is a view written from the record after
// every command (a hand edit of it is overwritten). Each command that writes commits both files by path.
//
// Who may do what goes by the session's transcript id (CLAUDE_CODE_SESSION_ID, set in every session's shell) and the
// role it joined as: lead (the delivery lead), builder, qa, design. A shell with no session id is the owner's own:
// owner, who may do what the lead may.
//
//   node tools/feat.mjs status                      the board, the feature in build, budget used, burnup
//   node tools/feat.mjs next                        the next task for this session's role
//   node tools/feat.mjs join <lead|builder|qa|design>   this session takes a role (a role held by another session: --replace, lead only)
//   node tools/feat.mjs feature add <F01> --name "..." --use-case "..." --end "..." --budget <8h|2d>
//   node tools/feat.mjs feature budget <F01> --budget <58h> --why "..."   lead: before the start only
//   node tools/feat.mjs feature pause <F01> --from <2026-01-17T01:24> --to <2026-01-17T16:46> --why "..."
//                                                   lead: hours the computer was off (Windows only: read from its
//                                                   power log), left out of the time used; refused if any commit or
//                                                   session turn falls in them
//   node tools/feat.mjs feature pause <F01> --idle --from ... --to ... --why "..."
//                                                   lead: hours nobody worked, computer on or off ("idle hours
//                                                   shouldn't count, pause the clock"); refused also if a job ran
//   node tools/feat.mjs task add <F01> --use-case "..." --desc "..." --done "check 1" [--done "check 2"] [--done "check 3"]
//                                  --size S|M|L --kind <one of the configured kinds>
//                                  --screens "..." --steps "first step ... last step"
//   node tools/feat.mjs task cut <F01-T3> --why "..."          lead: out of the feature (counted, never removed)
//   node tools/feat.mjs start <F01>                 lead: into build (refused while another is in build,
//                                                   or a closed feature has no retrospective)
//   node tools/feat.mjs built <F01-T1> --commit <sha> [--note "..."]    builder
//   node tools/feat.mjs pass <F01-T1> --evidence "..."                   qa: each done-when checked on the stage build
//   node tools/feat.mjs fail <F01-T1> --why "..."                        qa: back to the builder
//   node tools/feat.mjs look <F01> --stage <build no.>                   lead: every task passed; the owner's look asked
//   node tools/feat.mjs done <F01> --owner-words "..." --date <YYYY-MM-DD> lead: after the owner's look
//   node tools/feat.mjs stop <F01> --why "..."                           lead: budget out or re-planned
//   node tools/feat.mjs retro <F01> --file <report.md> --change "what changes | how it is measured" [--change ...]
//                                  [--result I3=kept|dropped|changed:"what was seen"]...   lead: after done or stop
//   node tools/feat.mjs check                       the record's chain and the view; exit 2 on a fault
//   node tools/feat.mjs repair                      the record put back as committed (HEAD), the view rewritten
//
// Test runs: DELIVERY_DIR=<folder> keeps the files there and commits nothing; DELIVERY_SESSION stands in for the id.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadConfig, transcriptDirs } from './config.mjs';

const CFG = loadConfig();
const REPO = CFG.root;
const TEST = !!process.env.DELIVERY_DIR;
const REAL_DIR = CFG.abs(CFG.deliveryDir);
const DIR = TEST ? path.resolve(process.env.DELIVERY_DIR) : REAL_DIR;
// A test folder is never the real record: the test's hooks (the clock, the transcripts, the power records) must not reach it.
// Compared as the same folder on disk (real path, then file id) and as the same record (its first event), since one
// folder has many spellings: \\?\X:\..., \\.\X:\..., \\localhost\X$\..., a junction.
if (TEST) {
  const REAL = REAL_DIR, tryF = f => { try { return f(); } catch { return null; } };
  const rp = p => tryF(() => fs.realpathSync.native(p).replace(/^\\\\[?.]\\/, '').toLowerCase());
  const id = p => tryF(() => { const s = fs.statSync(p, { bigint: true }); return `${s.dev}:${s.ino}`; });
  const first = p => tryF(() => fs.readFileSync(path.join(p, 'events.jsonl'), 'utf8').split('\n', 1)[0]) || null;
  if ((rp(DIR) && rp(DIR) === rp(REAL)) || (id(DIR) && id(DIR) === id(REAL)) || (first(DIR) && first(DIR) === first(REAL))) {
    process.stderr.write(`refused: DELIVERY_DIR is for a test folder, never ${CFG.deliveryDir}\n`); process.exit(2);
  }
}
const EVENTS = path.join(DIR, 'events.jsonl'), VIEW = path.join(DIR, 'features.json'), LOCK = path.join(DIR, '.lock');
const REL_EVENTS = `${CFG.deliveryDir}/events.jsonl`, REL_VIEW = `${CFG.deliveryDir}/features.json`;
const SESSION = (process.env.DELIVERY_SESSION ?? process.env.CLAUDE_CODE_SESSION_ID ?? '').trim();
const ROLES = ['lead', 'builder', 'qa', 'design'];
const SIZES = { S: 2, M: 4, L: 8 };                        // hours: S up to 2, M half a day, L a day; bigger is split
// A task's kind ("try to categorize each task"): the part of the product it changes, for the progress page.
// Set per project in team-workflow.json ("kinds"); tools/config.mjs has the defaults.
const KINDS = CFG.kinds;
const FEATURE_ID = /^F\d{2,3}$/, TASK_ID = /^(F\d{2,3})-T(\d{1,3})$/;
const HOUR = 3600e3;
// The clock; the self-test may set DELIVERY_NOW to test hours that have not passed (never outside a test folder).
const NOW = () => (TEST && process.env.DELIVERY_NOW ? Date.parse(process.env.DELIVERY_NOW) : Date.now());

class Refusal extends Error {}
const refuse = m => { throw new Refusal(m); };

// ---- the command line
function parse(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), v = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
      (opt[k] ??= []).push(v);
    } else pos.push(a);
  }
  const one = k => { const v = opt[k]; if (!v) return undefined; if (v.length > 1) refuse(`--${k} given twice`); return v[0]; };
  const all = k => opt[k] ?? [];
  return { pos, one, all, has: k => !!opt[k] };
}
const need = (v, what, min = 1) => {
  if (typeof v !== 'string' || v.trim().length < min) refuse(`${what} is missing or too short (at least ${min} characters)`);
  return v.trim();
};

// ---- the record
const hashOf = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
function readRecord() {
  if (!fs.existsSync(EVENTS)) return [];
  const lines = fs.readFileSync(EVENTS, 'utf8').split('\n').filter(l => l.trim());
  let prev = 'start';
  return lines.map((l, i) => {
    let e;
    try { e = JSON.parse(l); } catch { refuse(`the record's line ${i + 1} is not JSON: it was edited by hand. Run: node tools/feat.mjs repair`); }
    if (e.prev !== prev || e.n !== i + 1) refuse(`the record's line ${i + 1} does not follow the line before it: a line was changed or taken out by hand. Run: node tools/feat.mjs repair`);
    prev = hashOf(l);
    return e;
  });
}
function append(events, e) {
  const lines = fs.existsSync(EVENTS) ? fs.readFileSync(EVENTS, 'utf8').split('\n').filter(l => l.trim()) : [];
  const line = JSON.stringify({ n: events.length + 1, at: new Date().toISOString(), by: SESSION || 'owner', ...e,
    prev: lines.length ? hashOf(lines[lines.length - 1]) : 'start' });
  fs.mkdirSync(DIR, { recursive: true });
  fs.appendFileSync(EVENTS, line + '\n');
  events.push(JSON.parse(line));
}

// ---- the state, folded from the record
function fold(events) {
  const s = { roles: {}, features: {}, order: [], improvements: {}, impOrder: [] };
  for (const e of events) {
    const f = e.feature && s.features[e.feature];
    switch (e.kind) {
      case 'join': for (const [r, id] of Object.entries(s.roles)) if (id === e.session) delete s.roles[r]; s.roles[e.role] = e.session; break;
      case 'feature.add': s.features[e.feature] = { id: e.feature, name: e.name, useCase: e.useCase, end: e.end, budgetH: e.budgetH,
        state: 'planned', tasks: {}, taskOrder: [], added: e.at, started: null, closed: null, stage: null, ownerWords: null, retro: null }; s.order.push(e.feature); break;
      case 'task.add': f.tasks[e.task] = { id: e.task, useCase: e.useCase, desc: e.desc, done: e.done, size: e.size, cat: e.cat ?? null, screens: e.screens,
        steps: e.steps, state: 'open', added: e.at, afterStart: f.state !== 'planned', builtBy: null, commit: null, evidence: null, fails: 0, closedAt: null };
        f.taskOrder.push(e.task); break;
      case 'task.cut': f.tasks[e.task].state = 'cut'; f.tasks[e.task].why = e.why; f.tasks[e.task].closedAt = e.at; break;
      case 'feature.budget': f.budgetH = e.budgetH; f.budgetWhy = e.why; break;
      case 'feature.pause': f.pauses = [...(f.pauses ?? []), { from: e.from, to: e.to, why: e.why, ...(e.idle ? { idle: true } : {}) }]; break;
      case 'feature.start': f.state = 'building'; f.started = e.at; break;
      case 'task.built': Object.assign(f.tasks[e.task], { state: 'built', builtBy: e.by, builtAt: e.at, commit: e.commit, note: e.note ?? null }); break;   // builtAt: the progress page's ticket times
      case 'task.pass': Object.assign(f.tasks[e.task], { state: 'passed', evidence: e.evidence, passedBy: e.by, closedAt: e.at }); break;
      case 'task.fail': Object.assign(f.tasks[e.task], { state: 'open', lastFail: e.why }); f.tasks[e.task].fails++; break;
      case 'feature.look': f.state = 'look'; f.stage = e.stage; break;
      case 'feature.done': f.state = 'done'; f.closed = e.at; f.ownerWords = e.ownerWords; f.ownerDate = e.date; break;
      case 'feature.stop': f.state = 'stopped'; f.closed = e.at; f.why = e.why; break;
      case 'retro': f.retro = { file: e.file, at: e.at };
        for (const r of e.results ?? []) Object.assign(s.improvements[r.id], { result: r.result, seen: r.seen, measuredIn: e.feature });
        for (const c of e.changes) { s.improvements[c.id] = { id: c.id, from: e.feature, change: c.change, measure: c.measure, result: null }; s.impOrder.push(c.id); }
        break;
    }
  }
  for (const id of s.order) {                                  // building or checking, from the tasks
    const f = s.features[id];
    if (f.state !== 'building') continue;
    const live = f.taskOrder.map(t => f.tasks[t]).filter(t => t.state !== 'cut');
    if (live.length && live.every(t => t.state !== 'open')) f.state = 'checking';
  }
  return s;
}
const roleOf = s => (!SESSION ? 'owner' : (Object.entries(s.roles).find(([, id]) => id === SESSION)?.[0] ?? null));
function mustBe(s, ...roles) {
  const r = roleOf(s);
  if (r === 'owner' && roles.includes('lead')) return r;
  if (!roles.includes(r)) refuse(`this session's role is ${r ?? 'none (run: node tools/feat.mjs join <role>)'}; this command is for ${roles.join(' or ')}`);
  return r;
}
const feature = (s, id) => s.features[id] ?? refuse(`no feature ${id}`);
function task(s, id) {
  const m = TASK_ID.exec(id ?? '') ?? refuse(`a task id looks like F01-T3, not ${id}`);
  const f = feature(s, m[1]);
  return [f, f.tasks[id] ?? refuse(`no task ${id}`)];
}
const inBuild = s => s.order.map(i => s.features[i]).find(f => ['building', 'checking', 'look'].includes(f.state));
const live = f => f.taskOrder.map(t => f.tasks[t]).filter(t => t.state !== 'cut');
const hours = ms => Math.round(ms / HOUR * 10) / 10;
function budget(text) {
  const m = /^(\d+(?:\.\d+)?)(h|d)$/.exec(text ?? '') ?? refuse('--budget is hours or days of work: 6h, 2d (a day is 8 hours)');
  const h = Number(m[1]) * (m[2] === 'd' ? 8 : 1);
  if (h <= 0 || h > CFG.maxBudgetH) refuse(`a feature's budget is more than 0 and at most ${CFG.maxBudgetH}h; a bigger one is two features`);
  return h;
}
// Hours the computer was off are left out (the owner: "yes, leave the off hours out of the budget"), and hours nobody
// worked ("idle hours shouldn't count, pause the clock"); each pause was checked when written to hold no
// commit and no session turn, an idle one also no job on the job list.
const pausedMs = (f, end) => (f.pauses ?? []).reduce((n, p) =>
  n + Math.max(0, Math.min(Date.parse(p.to), end) - Math.max(Date.parse(p.from), Date.parse(f.started))), 0);
const pausedH = f => f.started ? hours(pausedMs(f, f.closed ? Date.parse(f.closed) : NOW())) : 0;
const usedH = f => {
  if (!f.started) return 0;
  const end = f.closed ? Date.parse(f.closed) : NOW();
  return hours(end - Date.parse(f.started) - pausedMs(f, end));
};
// What happened in a window: commits on any branch, and turns of any session of this project (the transcripts).
// A check that cannot be made refuses the pause: no answer is never read as "nothing happened".
function activity(fromMs, toMs) {
  const found = [];
  if (!TEST) {
    const r = spawnSync('git', ['log', '--all', `--since=${new Date(fromMs).toISOString()}`, `--until=${new Date(toMs).toISOString()}`,
      '--format=%cI %h %s'], { cwd: REPO, encoding: 'utf8' });
    if (r.error || r.status !== 0) refuse(`the commits in that window could not be read (git log: ${r.error?.message ?? r.stderr.trim()})`);
    for (const l of r.stdout.split('\n').filter(Boolean)) found.push(`commit ${l.slice(0, 90)}`);
  }
  // Every session folder of this project: the one named after its path and its siblings (worktrees), or those set
  // in team-workflow.json (tools/config.mjs).
  const dirs = [];
  if (TEST) { if (process.env.DELIVERY_TRANSCRIPTS) dirs.push(process.env.DELIVERY_TRANSCRIPTS); }
  else dirs.push(...transcriptDirs(REPO, CFG));
  if (!dirs.length || !dirs.every(d => fs.existsSync(d))) refuse('the sessions\' transcripts could not be found, so the turns in that window cannot be checked');
  const files = [];
  const walk = d => { for (const x of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p); else if (x.name.endsWith('.jsonl') && fs.statSync(p).mtimeMs >= fromMs) files.push(p);
  } };
  for (const d of dirs) walk(d);
  const re = /"timestamp":"(\d{4}-\d\d-\d\dT[\d:.]+Z)"/g, buf = Buffer.alloc(8 << 20);
  for (const p of files) {
    const fd = fs.openSync(p, 'r');
    let carry = '', n, hit = null;
    while (!hit && (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      const text = carry + buf.toString('utf8', 0, n);
      for (const m of text.matchAll(re)) { const t = Date.parse(m[1]); if (t > fromMs && t < toMs) { hit = m[1]; break; } }
      carry = text.slice(-80);
    }
    fs.closeSync(fd);
    if (hit) found.push(`a turn at ${hit} in ${path.basename(p)}`);
  }
  return found;
}
// Windows' own record that the PC was off (asleep, hibernating or shut down) for the whole window. No turn and no commit
// is not proof: a long job runs without either. The System log's off events: Kernel-Power 42 (sleep, stamped when it
// sleeps), Kernel-General 13 and EventLog 6006 (shutdown); on events: Power-Troubleshooter 1 (wake, the true wake time),
// Kernel-General 12, EventLog 6005 (start) and Kernel-Boot 27 (logged with every wake and start). Kernel-Power 107 and
// 506/507 are left out: they are stamped at the wrong time. A minute's slack each side, since a pause is typed to the minute.
const POWER = { off: [['Kernel-Power', 42], ['Kernel-General', 13], ['EventLog', 6006]],
  on: [['Power-Troubleshooter', 1], ['Kernel-General', 12], ['EventLog', 6005], ['Kernel-Boot', 27]] };
function powerEvents(fromMs, toMs) {
  const kindOf = (p, id) => { for (const k of ['off', 'on']) if (POWER[k].some(([n, i]) => i === id && p.endsWith(`-${n}`) || p === n && i === id)) return k; return null; };
  const read = text => JSON.parse(text.trim() || '[]').map(e => ({ at: Date.parse(e.at), kind: kindOf(e.p, e.id), what: `${e.p} ${e.id}` })).filter(e => e.kind);
  if (TEST) {                                                   // the self-test's record, in the shape the query prints: [{at, id, p}]
    if (!process.env.DELIVERY_POWER) refuse('no record of the PC\'s sleep and wake could be read');
    return read(fs.readFileSync(process.env.DELIVERY_POWER, 'utf8'));
  }
  if (process.platform !== 'win32') refuse('the computer\'s off hours are read from the Windows power log; on this system use --idle');
  const ids = [...POWER.off, ...POWER.on].map(([, id]) => id).join(',');
  const ps = `$ErrorActionPreference='Stop'; try { $e = Get-WinEvent -FilterHashtable @{LogName='System'; Id=${ids}; ` +
    `StartTime=[datetime]::Parse('${new Date(fromMs - 7 * 24 * HOUR).toISOString()}').ToLocalTime(); ` +
    `EndTime=[datetime]::Parse('${new Date(toMs + 2 * 60e3).toISOString()}').ToLocalTime()} } catch { if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $e = @() } else { throw } }; ` +
    `ConvertTo-Json -Compress -InputObject @($e | ForEach-Object { @{ at = $_.TimeCreated.ToUniversalTime().ToString('o'); id = $_.Id; p = $_.ProviderName } })`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  if (r.error || r.status !== 0) refuse(`Windows' sleep and wake record could not be read (${r.error?.message ?? r.stderr.trim().slice(0, 200)})`);
  return read(r.stdout);
}
// The window must lie inside one span from an off event to the next on event, with no power event of either kind
// between them: a second sleep inside the window means the PC was awake before it, even if that wake logged nothing.
function offSpan(fromMs, toMs) {
  const ev = powerEvents(fromMs, toMs).sort((x, y) => x.at - y.at), SLACK = 60e3;
  const off = ev.filter(e => e.kind === 'off' && e.at <= fromMs + SLACK).pop();
  if (!off) refuse('Windows has no record of the PC going to sleep or shutting down at or before the pause\'s start');
  const inside = ev.find(e => e.at > off.at && e.at < toMs - SLACK);
  if (inside) refuse(`the PC was not off for the whole window: ${inside.what} at ${new Date(inside.at).toISOString()}, before the pause's end`);
  return { off, on: ev.find(e => e.kind === 'on' && e.at > off.at) ?? null };
}
// Jobs on the job list (<jobsDir>/registry.json, tools/jobs.mjs) that ran in a window: a long job is work with no turn
// and no commit, so an idle pause is refused over it. A job ran from `started` to its end file's `ended`. With no end
// file it counts as running to now (killed, or still running: either way not known to have stopped). An entry marked
// `over` with no end file (a job list kept before end files were written) ran to its log's last write. The list
// keeps one entry a name: a name started again replaces its entry and removes its end file, but its log is appended, so
// a log made before the window's end under an entry started after it is an earlier run at a time no longer known, and
// refuses. A list that cannot be read refuses the pause, as in activity(); a project with no job list yet has no jobs.
function jobsIn(fromMs, toMs) {
  const file = TEST ? process.env.DELIVERY_JOBS : path.join(CFG.abs(CFG.jobsDir), 'registry.json');
  if (!file) refuse('no job list was given, so the jobs in that window cannot be checked');
  if (!TEST && !fs.existsSync(file) && !fs.existsSync(path.dirname(file))) return [];
  let reg;
  try { reg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { refuse(`the job list could not be read (${e.message})`); }
  if (!reg || typeof reg !== 'object' || Array.isArray(reg)) refuse('the job list is not a list of jobs by name');
  // Paths on the list are absolute (newer entries) or from the repository's root (older ones, as build\jobs\x.log), as
  // jobs.mjs reads them; an entry with no `end` has its end file, if any, beside the list as <name>.end.json.
  const base = TEST ? (process.env.DELIVERY_JOBS_ROOT ?? path.dirname(file)) : REPO, at = p => p && (path.isAbsolute(p) ? p : path.join(base, p));
  const stat = p => { try { return fs.statSync(at(p)); } catch { return null; } };
  const iso = ms => new Date(ms).toISOString(), found = [];
  for (const [name, j] of Object.entries(reg)) {
    const start = Number(j?.started);
    if (!Number.isFinite(start)) { found.push(`the job ${name} has no start time on the list`); continue; }
    const log = stat(j?.log);
    if (start >= toMs && log && log.birthtimeMs < toMs - 60e3) {
      found.push(`the job ${name} also ran before its present entry (its log was made ${iso(log.birthtimeMs)}), at a time the list no longer holds`); continue; }
    let end = null;
    try { end = Number(JSON.parse(fs.readFileSync(at(j.end) ?? path.join(path.dirname(file), `${name}.end.json`), 'utf8')).ended); } catch { end = null; }
    let open = false;
    if (!Number.isFinite(end) || end < start) { open = !j.over; end = open ? NOW() : Math.max(start, log?.mtimeMs ?? start); }
    if (start < toMs && end > fromMs) found.push(open
      ? `the job ${name}, started ${iso(start)}, has no end file, so it counts as running (see node tools/jobs.mjs list)`
      : `the job ${name} ran from ${iso(start)} to ${iso(end)}`);
  }
  return found;
}

// ---- the commands
function run(argv) {
  const a = parse(argv), [cmd, sub] = a.pos;
  if (cmd === 'repair') return repair();
  const events = readRecord(), s = fold(events);
  const write = (e, summary) => {
    let n;
    lock(() => { const fresh = readRecord(); append(fresh, e); writeView(fold(fresh)); n = fresh.length; });
    print(`written: ${summary} (the record's line ${n})`);
    commit(summary);
  };

  if (cmd === 'status' || !cmd) return print(status(s));
  if (cmd === 'check') { writeView(s); return print(`the record holds ${events.length} lines, each following the one before; the view is written from it`); }
  if (cmd === 'next') return print(next(s));
  if (cmd === 'join') {
    const role = a.pos[1];
    if (!ROLES.includes(role)) refuse(`a role is one of ${ROLES.join(', ')}`);
    if (!SESSION) refuse('only a session joins (its shell carries CLAUDE_CODE_SESSION_ID)');
    if (s.roles[role] === SESSION) refuse(`this session is already the ${role}`);
    if (s.roles[role] && s.roles[role] !== SESSION && !(a.has('replace') && roleOf(s) === 'lead'))
      refuse(`${role} is held by session ${s.roles[role].slice(0, 8)}; the lead may replace it with --replace`);
    return write({ kind: 'join', role, session: SESSION }, `${role} joined`);
  }
  if (cmd === 'feature' && sub === 'add') {
    mustBe(s, 'lead');
    const id = a.pos[2];
    if (!FEATURE_ID.test(id ?? '')) refuse('a feature id looks like F01');
    if (s.features[id]) refuse(`${id} is already on the list`);
    return write({ kind: 'feature.add', feature: id, name: need(a.one('name'), '--name', 4), useCase: need(a.one('use-case'), '--use-case', 30),
      end: need(a.one('end'), '--end (what the user can do when it is finished)', 20), budgetH: budget(a.one('budget')) }, `${id} added`);
  }
  if (cmd === 'feature' && sub === 'budget') {                 // set while shaping only; in build a budget is never extended
    mustBe(s, 'lead');
    const f = feature(s, a.pos[2]);
    if (f.state !== 'planned') refuse(`${f.id} is ${f.state}; a budget in build is never extended: stop it and re-plan`);
    return write({ kind: 'feature.budget', feature: f.id, budgetH: budget(a.one('budget')), why: need(a.one('why'), '--why', 10) },
      `${f.id} budget set before the start`);
  }
  if (cmd === 'feature' && sub === 'pause') {                  // the computer was off: those hours are not work
    mustBe(s, 'lead');
    const f = feature(s, a.pos[2]);
    if (!['building', 'checking', 'look'].includes(f.state)) refuse(`${f.id} is ${f.state}; a pause is for a feature in build`);
    const at = (k) => { const s = a.one(k) ?? '', v = Date.parse(s);       // a date alone would be read as UTC midnight
      return !/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(s) || Number.isNaN(v) ? refuse(`--${k} is a local time like 2026-11-17T01:24`) : v; };
    const from = at('from'), to = at('to'), why = need(a.one('why'), '--why', 10);
    if (to - from < HOUR) refuse('a pause is at least an hour; shorter gaps are part of the work');
    if (from < Date.parse(f.started) || to > NOW()) refuse(`a pause lies between ${f.id}'s start (${f.started}) and now`);
    for (const p of f.pauses ?? []) if (from < Date.parse(p.to) && to > Date.parse(p.from)) refuse(`it overlaps the pause ${p.from} to ${p.to}`);
    const idle = a.has('idle');
    if (idle && a.one('idle') !== true) refuse('--idle takes no value; put it after the feature id');
    const seen = activity(from, to);
    if (seen.length) refuse(`work happened in that window, so it was not ${idle ? 'idle' : 'off'}:\n  ${seen.slice(0, 6).join('\n  ')}`);
    if (idle) {                                                 // nobody worked ("idle hours shouldn't count, pause the clock")
      const jobs = jobsIn(from, to);
      if (jobs.length) refuse(`a job ran in that window, so it was not idle:\n  ${jobs.slice(0, 6).join('\n  ')}`);
      return write({ kind: 'feature.pause', feature: f.id, from: new Date(from).toISOString(), to: new Date(to).toISOString(), why, idle: true },
        `${f.id} paused ${hours(to - from)}h (nobody worked)`);
    }
    const { off, on } = offSpan(from, to);
    return write({ kind: 'feature.pause', feature: f.id, from: new Date(from).toISOString(), to: new Date(to).toISOString(), why,
      power: { off: `${new Date(off.at).toISOString()} ${off.what}`, on: on ? `${new Date(on.at).toISOString()} ${on.what}` : null } },
      `${f.id} paused ${hours(to - from)}h (the PC was off)`);
  }
  if (cmd === 'task' && sub === 'add') {
    mustBe(s, 'lead');
    const f = feature(s, a.pos[2]);
    if (['done', 'stopped'].includes(f.state)) refuse(`${f.id} is ${f.state}; a new task goes into a new feature`);
    const done = a.all('done').map(d => need(d, '--done', 10));
    if (done.length < 1 || done.length > 3) refuse('a task has one to three --done checks, each one a thing QA can see on the stage build');
    const size = a.one('size');
    if (!SIZES[size]) refuse('--size is S (up to 2 hours), M (half a day) or L (a day); a bigger task is split');
    const cat = a.one('kind');
    if (!KINDS[cat]) refuse(`--kind is one of ${Object.keys(KINDS).join(', ')}`);
    const id = `${f.id}-T${f.taskOrder.length + 1}`;
    return write({ kind: 'task.add', feature: f.id, task: id, useCase: need(a.one('use-case'), '--use-case', 20), desc: need(a.one('desc'), '--desc', 20),
      done, size, cat, screens: need(a.one('screens'), '--screens', 3), steps: need(a.one('steps'), '--steps (what the user does, first step to last)', 10) },
      `${id} added${f.state === 'planned' ? '' : ' after the start'}`);
  }
  if (cmd === 'task' && sub === 'cut') {
    mustBe(s, 'lead');
    const [f, t] = task(s, a.pos[2]);
    if (t.state === 'passed' || t.state === 'cut') refuse(`${t.id} is ${t.state}`);
    return write({ kind: 'task.cut', feature: f.id, task: t.id, why: need(a.one('why'), '--why', 10) }, `${t.id} cut`);
  }
  if (cmd === 'start') {
    mustBe(s, 'lead');
    const f = feature(s, a.pos[1]);
    if (f.state !== 'planned') refuse(`${f.id} is ${f.state}`);
    const b = inBuild(s);
    if (b) refuse(`${b.id} is in build (${b.state}); one feature at a time: finish it, or stop it with a reason`);
    const noRetro = s.order.map(i => s.features[i]).find(x => ['done', 'stopped'].includes(x.state) && !x.retro);
    if (noRetro) refuse(`${noRetro.id} is ${noRetro.state} and has no retrospective yet (the skill feature-retro)`);
    if (!live(f).length) refuse(`${f.id} has no tasks`);
    return write({ kind: 'feature.start', feature: f.id }, `${f.id} started`);
  }
  if (cmd === 'built') {
    mustBe(s, 'builder');
    const [f, t] = task(s, a.pos[1]);
    if (!['building', 'checking'].includes(f.state)) refuse(`${f.id} is ${f.state}, not in build`);
    if (t.state !== 'open') refuse(`${t.id} is ${t.state}`);
    const sha = need(a.one('commit'), '--commit', 7);
    if (!TEST && spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: REPO }).status !== 0) refuse(`${sha} is not a commit here`);
    return write({ kind: 'task.built', feature: f.id, task: t.id, commit: sha, note: a.one('note') }, `${t.id} built`);
  }
  if (cmd === 'pass' || cmd === 'fail') {
    mustBe(s, 'qa');
    const [f, t] = task(s, a.pos[1]);
    if (t.state !== 'built') refuse(`${t.id} is ${t.state}; QA checks a built task`);
    if (t.builtBy === SESSION) refuse('the session that built a task does not pass it');
    if (cmd === 'pass') return write({ kind: 'task.pass', feature: f.id, task: t.id,
      evidence: need(a.one('evidence'), '--evidence (each done-when check and what was seen, on which stage build)', 40) }, `${t.id} passed`);
    return write({ kind: 'task.fail', feature: f.id, task: t.id, why: need(a.one('why'), '--why', 15) }, `${t.id} failed`);
  }
  if (cmd === 'look') {
    mustBe(s, 'lead');
    const f = feature(s, a.pos[1]);
    if (f.state !== 'checking' || !live(f).every(t => t.state === 'passed')) refuse(`${f.id}: every task must have passed QA first`);
    return write({ kind: 'feature.look', feature: f.id, stage: need(a.one('stage'), '--stage') }, `${f.id} to the owner's look`);
  }
  if (cmd === 'done') {
    mustBe(s, 'lead');
    const f = feature(s, a.pos[1]);
    if (f.state !== 'look') refuse(`${f.id} is ${f.state}; done comes after the owner's look`);
    const date = a.one('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) refuse("--date is the day of the owner's answer, YYYY-MM-DD");
    return write({ kind: 'feature.done', feature: f.id, ownerWords: need(a.one('owner-words'), '--owner-words', 2), date }, `${f.id} done`);
  }
  if (cmd === 'stop') {
    mustBe(s, 'lead');
    const f = feature(s, a.pos[1]);
    if (['done', 'stopped'].includes(f.state)) refuse(`${f.id} is already ${f.state}`);
    return write({ kind: 'feature.stop', feature: f.id, why: need(a.one('why'), '--why', 15) }, `${f.id} stopped`);
  }
  if (cmd === 'retro') {
    mustBe(s, 'lead');
    const f = feature(s, a.pos[1]);
    if (!['done', 'stopped'].includes(f.state)) refuse(`${f.id} is ${f.state}; a retrospective follows a finished or stopped feature`);
    if (f.retro) refuse(`${f.id} has its retrospective`);
    const file = need(a.one('file'), '--file');
    if (!fs.existsSync(path.resolve(TEST ? DIR : REPO, file))) refuse(`${file} does not exist`);
    const results = a.all('result').map(r => {
      const m = /^(I\d+)=(kept|dropped|changed)(?::(.+))?$/s.exec(r) ?? refuse(`--result looks like I3=kept:"what was seen", not ${r}`);
      if (!s.improvements[m[1]] || s.improvements[m[1]].result) refuse(`${m[1]} is not an open change`);
      return { id: m[1], result: m[2], seen: need(m[3], `what was seen for ${m[1]}`, 15) };
    });
    const open = s.impOrder.filter(i => !s.improvements[i].result && !results.some(r => r.id === i));
    if (open.length) refuse(`the changes of the last retrospectives are measured first: ${open.join(', ')} (--result I<n>=kept|dropped|changed:"what was seen")`);
    const changes = a.all('change').map((c, k) => {
      const [change, measure] = String(c).split('|').map(x => x?.trim());
      return { id: `I${s.impOrder.length + k + 1}`, change: need(change, 'a change', 15), measure: need(measure, `how "${change}" is measured (after the |)`, 10) };
    });
    if (changes.length < 1 || changes.length > 2) refuse('a retrospective makes one or two changes (--change "what | how it is measured")');
    return write({ kind: 'retro', feature: f.id, file, changes, results }, `${f.id} retrospective`);
  }
  refuse(`no command "${argv.join(' ')}"; the commands are at the top of tools/feat.mjs`);
}

// ---- what is printed
function status(s) {
  const out = [], cols = { planned: [], building: [], checking: [], look: [], done: [], stopped: [] };
  for (const id of s.order) cols[s.features[id].state].push(id);
  out.push(`Planned: ${cols.planned.join(' ') || '-'} | Building: ${cols.building.join(' ') || '-'} | Checking: ${cols.checking.join(' ') || '-'} | Your look: ${cols.look.join(' ') || '-'} | Done: ${cols.done.join(' ') || '-'}${cols.stopped.length ? ` | Stopped: ${cols.stopped.join(' ')}` : ''}`);
  out.push(`Roles: ${ROLES.map(r => `${r} ${s.roles[r]?.slice(0, 8) ?? '-'}`).join(', ')}; this session: ${roleOf(s) ?? 'none'}`);
  const f = inBuild(s);
  if (f) {
    const ts = live(f), pass = ts.filter(t => t.state === 'passed').length, used = usedH(f);
    out.push('', `${f.id} ${f.name} (${f.state}): ${pass} of ${ts.length} tasks passed; ${used}h of ${f.budgetH}h used${used > f.budgetH ? ' — BUDGET OUT: stop and re-plan (feat.mjs stop)' : ''}`);
    out.push(`  finished when: ${f.end}`);
    const after = f.taskOrder.filter(i => f.tasks[i].afterStart).length, cut = f.taskOrder.length - ts.length;
    if (after || cut) out.push(`  scope since the start: ${after} added, ${cut} cut`);
    if (f.pauses?.length) { const n = f.pauses.filter(p => p.idle).length, why = n === f.pauses.length ? 'nobody worked' : n ? 'the PC was off or nobody worked' : 'the PC was off';
      out.push(`  left out (${why}): ${pausedH(f)}h in ${f.pauses.length} pause${f.pauses.length > 1 ? 's' : ''}`); }
    for (const t of f.taskOrder.map(i => f.tasks[i])) out.push(`  ${t.id} [${t.state}${t.fails ? `, failed ${t.fails}x` : ''}] ${t.size} ${t.cat ?? '-'} ${t.desc.slice(0, 90)}`);
  }
  const closed = s.order.map(i => s.features[i]).filter(x => ['done', 'stopped'].includes(x.state));
  if (closed.length) {
    out.push('', 'Closed features (budget against used):');
    for (const x of closed) out.push(`  ${x.id} ${x.state}: ${usedH(x)}h of ${x.budgetH}h, ${live(x).filter(t => t.state === 'passed').length} tasks passed${x.retro ? '' : ', NO RETROSPECTIVE YET'}`);
  }
  const open = s.impOrder.map(i => s.improvements[i]).filter(i => !i.result);
  if (open.length) out.push('', 'Changes being tried (measured at the next retrospective):', ...open.map(i => `  ${i.id} ${i.change} — measured by: ${i.measure}`));
  out.push('', burnup(s));
  return out.join('\n');
}
function burnup(s) {
  const days = {};
  for (const id of s.order) for (const t of Object.values(s.features[id].tasks)) {
    const d = t.added.slice(0, 10); (days[d] ??= { added: 0, done: 0 }).added++;
    if (t.state === 'passed') { const c = t.closedAt.slice(0, 10); (days[c] ??= { added: 0, done: 0 }).done++; }
  }
  const rows = Object.keys(days).sort().map(d => `${d} +${days[d].added} added, ${days[d].done} passed`);
  return rows.length ? `Tasks by day (the burnup's numbers):\n  ${rows.join('\n  ')}` : 'No tasks yet.';
}
function next(s) {
  const r = roleOf(s), f = inBuild(s);
  if (!f) return `No feature in build.${r === 'lead' || r === 'owner' ? ' Start the next one with the skill shape-feature.' : ' Wait for the lead.'}`;
  if (r === 'builder') { const t = live(f).find(t => t.state === 'open'); return t ? describe(t) : `Every task of ${f.id} is built; QA checks them.`; }
  if (r === 'qa') { const t = live(f).find(t => t.state === 'built'); return t ? describe(t) : `No built task of ${f.id} waits for QA.`; }
  return status(s);
}
const describe = t => [`${t.id} (${t.size}, ${KINDS[t.cat] ?? 'no kind'}) ${t.desc}`, `  use case: ${t.useCase}`, `  screens: ${t.screens}`, `  the user: ${t.steps}`,
  ...t.done.map((d, i) => `  done when ${i + 1}: ${d}`), ...(t.lastFail ? [`  QA's last fail: ${t.lastFail}`] : []), ...(t.commit ? [`  built in ${t.commit}`] : [])].join('\n');

// ---- the files
function writeView(s) {
  const view = { note: 'Written by tools/feat.mjs from events.jsonl; a hand edit is overwritten.', roles: s.roles,
    features: s.order.map(i => ({ ...s.features[i], tasks: s.features[i].taskOrder.map(t => s.features[i].tasks[t]), taskOrder: undefined, usedH: usedH(s.features[i]) })),
    improvements: s.impOrder.map(i => s.improvements[i]) };
  const tmp = VIEW + '.tmp';
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(view, null, 1) + '\n');
  fs.renameSync(tmp, VIEW);
}
function lock(fn) {
  fs.mkdirSync(DIR, { recursive: true });
  const until = Date.now() + 5000;
  for (;;) {
    try { fs.writeFileSync(LOCK, SESSION || 'owner', { flag: 'wx' }); break; } catch {
      if (Date.now() > until) refuse(`the list is held by another command (${LOCK}); when no command runs, delete that file`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try { fn(); } finally { fs.rmSync(LOCK, { force: true }); }
}
function commit(summary) {
  if (TEST) return;
  const g = (...x) => spawnSync('git', x, { cwd: REPO, encoding: 'utf8' });
  const add = g('add', '--', REL_EVENTS, REL_VIEW);
  const c = g('commit', '-q', '-m', `delivery: ${summary}${CFG.commitTrailer ? `\n\n${CFG.commitTrailer}` : ''}`, '--', REL_EVENTS, REL_VIEW);
  if (add.status || c.status) { console.error(`written, but not committed: ${(add.stderr + c.stderr).trim()}`); return; }
  if (!CFG.push) return;
  const p = g('push', '-q');
  if (p.status) console.error(`committed, not pushed: ${p.stderr.trim()}`);
}
function repair() {
  if (TEST) refuse('repair takes the committed record; there is none in a test folder');
  const r = spawnSync('git', ['show', `HEAD:${REL_EVENTS}`], { cwd: REPO, encoding: 'utf8' });
  if (r.status) refuse('the record is not committed yet');
  fs.writeFileSync(EVENTS, r.stdout);
  writeView(fold(readRecord()));
  print('the record is put back as committed, and the view written from it');
}
const print = t => console.log(t);

try { run(process.argv.slice(2)); }
catch (e) {
  if (e instanceof Refusal) { console.error(`refused: ${e.message}`); process.exit(2); }
  throw e;
}
