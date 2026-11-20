---
paths:
  - "tools/**/*"
  - ".claude/skills/**/*"
  - ".claude/settings.json"
  - "team-workflow.json"
---

# The workflow: the rules in force

How the team of sessions works. Each rule here stands until the owner changes it; a new decision of the owner's on the
workflow is written here in the turn it is given, with the owner's words and the date (the skill `record-decision`),
and the long account goes to `.claude/rule-history/workflow.md`. Where each rule came from and why: `docs/decisions.md`.

## The delivery flow
- **Work is features broken into tasks.** A feature has a use case, an end a person can see by using the product, a
  fixed time budget, and a finite list of tasks of at most a day. Each task has a use case, a description, the screens
  and the user's steps, a size and one to three done-when checks QA can see on the stage build. Small adjustments are not
  open-ended work: they are tasks with a done-when, or they wait for a later feature. (The skill `shape-feature`.)
- **One feature in build at a time.** `tools/feat.mjs start` refuses a second.
- **Fixed time, variable scope.** The budget is set before the start and never extended; scope is cut to fit, never the
  checks. At the budget the feature is stopped and re-planned. Hours nobody worked (computer off or idle, no commit, no
  session turn, no job) are paused out of the time used (`feat.mjs feature pause`); the budget itself never changes.
- **Done has two levels.** A task is done when QA has passed each done-when on the stage build. A feature is done when
  every task has passed and the owner has looked once.
- **Only QA passes a task.** The session that built it never does. A builder's report is not evidence. (The skills
  `build-task`, `verify-task`.)
- **A readiness review before every start**, six parts each with its evidence (play-through, code read, design check,
  carry-over, budget from the last feature's times, a fresh review), published to the owner as a page labelled "Draft
  for direction"; the team starts without waiting for the owner's approval and takes the owner's notes in at the next
  hourly check. Tasks added after the start count as misses of the review (aim: under 30%).
- **A retrospective after every finished or stopped feature**, with one or two changes, each with its measure; the last
  retrospective's changes are measured first. The next start is refused until it is recorded. (The skill
  `feature-retro`.)
- **The record is written only by `tools/feat.mjs`.** `events.jsonl` is hash-chained; `features.json` is its view.
  A hand edit is caught by `feat.mjs check` and undone by `feat.mjs repair`.
- **A stage build and a live build.** Any session publishes to stage after the checks; only the build on stage goes
  live, and only on the owner's recorded word (`docs/stage-live.md`).

## The team
- **Roles:** lead, builder, QA, design; all must be held, any session may hold any of them, and the lead assigns them
  (`feat.mjs join`, `--replace`). The owner is the product owner and holds no session. (`docs/team.md`.)
- **Three sessions as a rule** (the owner trimmed a larger team to three, keeping a lead "that does team interference
  and checking progress", relying on scripts for what can be counted). A fourth for design when the product has screens.
- **Each session cares for its parts of the codebase for the long term:** it leaves a file it touches better (tests for
  what changed, no dead code, no probes left behind, names a reader understands a year later); a fault found in its own
  parts is its own work, mended or put on the list, never passed by.
- **A model and an effort level per piece of work**, stated with the task; a helper started for it takes them. The
  builder runs on the strongest building model (the owner chose Opus); reviews on the strongest review model only for
  high-stakes changes (the skill `high-stakes-review`).
- **At most two helpers at once** per session, briefed by the skill `helper-round`.
- **The lead checks every hour** (`docs/lead.md`): the feature's numbers, idle hours paused, jobs, the browser's turns,
  one board line. It builds nothing heavy.
- **Hand-overs:** every session's tab is summarised automatically at a set window (`autoCompactWindow`); after a
  summary a session reads its hand-over in `reports/team/handover/` and runs `node tools/feat.mjs next` before anything
  else. A session that wants its tab cleared writes its hand-over, commits it and says so where the owner sees it.
- **Questions to the owner are stored, high level, and asked when the owner is present.** A number, a limit or a
  formula inside a method is settled by evidence, never asked; the owner is asked direction, purpose, what the user
  should see, and for a look at a verified result. Nobody waits on a question: the team decides what it may decide,
  writes the reason, and takes the next task. No dialog that holds a session.

## What the owner is shown
- **Two labels, from the checks' records, never from the maker's opinion:** "Verified" (every required check passed on
  these exact files) and "Draft for direction" (says what did not pass or did not run). A draft never looks like a
  result. In this kit the labels are a convention the sessions keep: no tool writes them and no hook enforces them. The
  original project added a hook that refused a publish without a label (the owner's word waived it); it is not
  included. A project can add one: its check runner writes a label file naming the exact files it checked, and a
  PreToolUse hook on the publish command exits with code 2 when the files sent have no such label.
- **Show first:** what is built reaches the owner's device early and is judged there before more polish; a round that
  cannot change what the user sees is not run.
- **Look before measuring:** the maker looks, then a fresh reviewer (the skill `fresh-review`), before the owner. Numbers
  passing is not the look.
- **No check is softened to get a pass.** "Quality first, if the system cant supply it we need to amend the system not
  lower the bar." A failing check is work.

## Every session
- **Git:** commit by path (`git commit -m "..." -- <paths>`, a new file `git add -- <file>` first, never a folder);
  never stash, checkout, reset or rebase in the shared tree; a rejected push: fetch, merge, push. Uncommitted lines in a
  shared file may be another session's: check before committing it.
- **Notes:** the work inventory is written when work is received, not when it is done; the owner's decisions into the
  area's rule file in the turn they are given (`tools/notes.py`, the skill `record-decision`).
- **Times only from the clock:** a time is written only as `date`, a commit or a command printed it.
- **Evidence, not estimates:** a result is claimed only after reading the command's answer; a length only as measured.
- **Heavy jobs through the list** (`tools/jobs.mjs`, the skill `heavy-job`), at most two at once; one headless browser
  at a time, given in turns (`docs/team.md`, "The browser in turns").
- **Context checkpoints:** at 60% of the budget commit what is proven and write the hand-over line; at 80% stop starting
  anything, commit, report.
- **Four rounds on one problem, then stop and report.**
- **Plain words** in replies, pages and briefs: say what a phrase refers to.
- **Cost is measured per piece** from the transcripts' usage numbers only (`tools/cost/`), never message text.
- **Hooks** follow the safety rules of `docs/team.md`, "Hooks"; a hook in the shared settings needs the owner's word.
