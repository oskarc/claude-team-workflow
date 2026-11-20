# Adopting the kit in a project

The kit assumes Claude Code, git, Node 20 or later and Python 3.9 or later. It runs on Windows, macOS and Linux (the
computer-off pause reads the Windows power log; elsewhere use `--idle`).

## 1. Copy the files
Into the project's root:
- `.claude/skills/*` (the nine skills), `.claude/rules/workflow.md` and `.claude/rule-history/`;
- `tools/` (keep the folder name: the skills call `node tools/feat.mjs`);
- `docs/` and `templates/` (or put them under another folder and change the paths the skills name);
- `CLAUDE.md.template` as `CLAUDE.md` (merge by hand if one exists);
- `package.json`, if the project has none. If it has one, add the kit's scripts to it (`"test:workflow": "node
  tools/selftest.mjs"`) instead; the tools are `.mjs` files, so the project's `"type"` does not matter.
Add `build/` to `.gitignore`, or set `jobsDir` and `stateDir` (below) to an ignored folder. Then make the folders the
notes and the team use, each with an empty `.gitkeep` so git keeps it:
```
mkdir -p .claude/rule-history reports/team/handover reports/team/board reports/delivery
touch .claude/rule-history/.gitkeep reports/team/handover/.gitkeep reports/team/board/.gitkeep
```
and copy `templates/work-inventory.md` to `reports/Work inventory.md`.

## 2. Configure
Copy `team-workflow.example.json` to `team-workflow.json` at the root and change what differs (every key is optional):
- `deliveryDir`: where the delivery record lives (committed);
- `jobsDir`, `stateDir`: the job list and the hooks' state (not committed);
- `kinds`: what a task may change, shown as colours on the progress page;
- `maxBudgetH`: the largest feature budget;
- `commitTrailer`: the last line of each commit the tools make;
- `push`: whether `feat.mjs` pushes after its commits;
- `ownerName`: how the tools name the person the team works for;
- `transcriptsDirs`: only if Claude Code keeps this project's transcripts somewhere unusual;
- `jobsCap`: how many heavy jobs may run at once (2);
- `roleOverrides`: for `tools/metrics.py` only. It counts cost by role from the delivery list's `join` records; a
  session that never joined (a design session before the flow began, a reviewer tab) would count as "other". Map the
  first 8 characters of its session id (the name of its transcript file) to a role: `{"1a2b3c4d": "design"}`.
Then, at the project's root: `npm test` (or `npm run test:workflow`, or `node tools/selftest.mjs`) must print every
selftest passing. The selftests work in temporary folders and leave the project untouched.

## 3. Fill in CLAUDE.md
The placeholders in angle brackets: the product, the owner's goals, the target device sizes, the stage and live
addresses, the checks before a stage publish, the areas and their rule files. Keep it under 200 lines.

## 4. Start the team
1. Open three or four Claude Code sessions on the repository (lead, builder, QA, optionally design).
2. In each: `node tools/feat.mjs join <role>`.
3. Set a summary window for long runs (`autoCompactWindow` in `~/.claude/settings.json`, about 215,000), and make each
   session keep `reports/team/handover/<role>.md` current.
4. Optional, with the owner's word: the hooks. `node tools/install-hooks.mjs --settings .claude/settings.local.json
   --owner-word "<the owner's words>" --date <YYYY-MM-DD>`. Off without touching the settings: create
   `<stateDir>/hooks-off`. Out: `--remove --settings <file>`.

## 5. The first feature
The lead runs the skill `shape-feature`: a use case, an end sentence, a budget, tasks with done-when checks, the
readiness review, `feat.mjs start`. The builder runs `build-task`, QA `verify-task`. When every task passes and the owner
has looked: `feature-retro`. Expect the first feature to find many tasks after its start; the retrospective is where
that number starts to fall.

## What to change first in your project
- The target sizes and the stage checks (CLAUDE.md, `docs/stage-live.md`).
- The kinds of task.
- The model guide in `.claude/rules/workflow.md`, if your team runs other models.
- Delete the decisions in `docs/decisions.md` you do not adopt, or keep them as the reasons for the defaults.
