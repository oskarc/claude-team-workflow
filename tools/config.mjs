// The kit's settings for one project, read by every node tool in tools/.
//
// The project's root is TEAM_WORKFLOW_ROOT if set, else the nearest folder above the working directory that holds
// .git, else the folder above tools/. Its settings are team-workflow.json at that root (every key optional):
//
//   {
//     "deliveryDir": "reports/delivery",        the delivery record (events.jsonl) and its view (features.json)
//     "jobsDir": "build/jobs",                  the job list of tools/jobs.mjs (registry.json, logs, end files)
//     "stateDir": "build/team",                 the hooks' state, their live copy and their off switch
//     "kinds": { "ui": "Screens", ... },        what a task may change, for --kind (see DEFAULT_KINDS)
//     "transcriptsDirs": ["..."],               where Claude Code keeps this project's session transcripts; by default
//                                               every folder under ~/.claude/projects named after the root's path
//     "maxBudgetH": 80,                          the largest budget one feature may have
//     "commitTrailer": "Co-Authored-By: ...",   the last line of each commit the tools make
//     "push": false,                            push after each commit the delivery tool makes
//     "ownerName": "the owner",                 how the tools name the person the team works for
//     "roleOverrides": { "1a2b3c4d": "design" } a session id's first 8 characters to a role, for the metrics
//   }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_KINDS = {
  feature: 'User-facing behaviour', ui: 'Screens and hints', content: 'Content and text', data: 'Data and storage',
  art: 'Art and assets', spec: 'Spec text', tech: 'Code under the product',
};

export function findRoot(start = process.cwd()) {
  if (process.env.TEAM_WORKFLOW_ROOT) return path.resolve(process.env.TEAM_WORKFLOW_ROOT);
  let d = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

// Claude Code names a project's transcript folder after its path with every character that is not a letter or a
// digit turned into '-'. Worktrees and sibling folders start with the same name, so every folder that does is taken.
export function transcriptDirs(root, cfg = {}) {
  if (Array.isArray(cfg.transcriptsDirs) && cfg.transcriptsDirs.length) return cfg.transcriptsDirs.map(d => path.resolve(root, d));
  const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const base = path.join(home, '.claude', 'projects');
  const name = root.replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(x => x.isDirectory() && x.name.toLowerCase().startsWith(name))
    .map(x => path.join(base, x.name));
}

export function loadConfig(start) {
  const root = findRoot(start);
  let file = {};
  const p = path.join(root, 'team-workflow.json');
  if (fs.existsSync(p)) {
    try { file = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { throw new Error(`team-workflow.json could not be read: ${e.message}`); }
  }
  const rel = v => String(v).replace(/\\/g, '/').replace(/\/+$/, '');
  const cfg = {
    root,
    deliveryDir: rel(file.deliveryDir ?? 'reports/delivery'),
    jobsDir: rel(file.jobsDir ?? 'build/jobs'),
    stateDir: rel(file.stateDir ?? 'build/team'),
    kinds: file.kinds && Object.keys(file.kinds).length ? file.kinds : DEFAULT_KINDS,
    maxBudgetH: Number(file.maxBudgetH ?? 80),
    commitTrailer: file.commitTrailer ?? 'Co-Authored-By: Claude <noreply@anthropic.com>',
    push: file.push === true,
    ownerName: file.ownerName ?? 'the owner',
    roleOverrides: file.roleOverrides ?? {},
    transcriptsDirs: file.transcriptsDirs ?? null,
  };
  cfg.abs = rel => path.join(root, ...rel.split('/'));
  return cfg;
}
