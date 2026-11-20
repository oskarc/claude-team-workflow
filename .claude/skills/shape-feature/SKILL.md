---
name: shape-feature
description: The delivery lead shapes the next feature of the product - a use case, an end the user can see, a fixed time budget, and tasks of at most a day, each with a use case, a description, the screens and the user's steps, and one to three done-when checks QA can see on the stage build - runs the readiness review, then puts it on the delivery list (tools/feat.mjs) and starts it. Use when no feature is in build, when the owner picks what comes next, or when a stopped feature is re-planned.
---

# Shaping a feature

The owner, when this was made: "We need to break the work down to work tasks with a clear usecase and description,
right now we have features without a clear ending, and alot of work is just small adjustments that takes alot of
time." The method is Shape Up's fixed time and variable scope, with Anthropic's harness for long-running agents (a list
of checks that start failing and only a check passes). Why: `docs/method.md`.

## Steps
1. **What it is for.** One use case in the user's words ("The user exports a report and opens the saved file"), taken
   from the project's plan, its specs or the owner's answer. The owner picks the feature; the lead recommends one from
   the goals the owner gave (named in CLAUDE.md).
2. **Its end.** One sentence a person can check by using the product: what the user can do when it is finished. Not
   "better", not "tuned": a thing that happens on screen.
3. **The budget** (the appetite): hours of work, at most `maxBudgetH` (80 by default, ten days); most features two to
   five days. When it runs out the feature is stopped and re-planned (`feat.mjs stop`), never extended. Cut scope to fit,
   never the checks.
4. **The tasks.** Each at most a day (S up to 2 hours, M half a day, L a day; bigger is split). Each has:
   - a use case (who does what, and why it matters to the user);
   - a description (what changes, in which files or systems, without the how in detail);
   - the screens it touches and what the user does on them, first step to last;
   - one to three done-when checks, each a thing QA can see on the stage build at the target device sizes (set in
     CLAUDE.md) ("the saved file opens and holds the report's rows within two seconds of the press"), never "the code
     is clean" or "tests pass" alone.
   Before writing them, read the screens as they stand on the stage build, the spec that owns the system, and the
   area's rule file. Polish that is not in a done-when is a task of a later feature.
5. **The readiness review, before the start** (the owner, after 52 of the first feature's 67 tasks were found during
   the build: "there should be an review and reasoning, evidence based desicions BEFORE development starts, so the team
   is certain the road ahead is clear"). The feature is not started until each part below has its answer and its
   evidence (a picture, a log, a code line, a probe), written in `<deliveryDir>/<F>-readiness.md`
   (`templates/readiness-review.md`):
   a. **The play-through (QA):** QA uses the whole use case on the current stage build at each target device size, from
      the first step to the end sentence, and writes down every fault and gap seen, each with its picture or log. Each
      one becomes a task, or is named out of scope with the reason.
   b. **The code read (builder):** for each task, the builder reads the code and content it touches and writes what is
      known and what is not (state, timing, saving, the order of events). An unknown that reading cannot settle gets a
      short probe before the start, and its answer goes into the task's description.
   c. **The design check (design):** the design session reads the task list against the screens as they stand; its
      answer goes into the tasks, not beside them. (No design session: the lead does it.)
   d. **The carry-over:** the tasks in `<deliveryDir>/carry-over.md` (`templates/carry-over.md`) are taken in first, as
      written there.
   e. **The budget from evidence:** each size is set against the actual times of the last feature's tasks of that kind
      and size (`tools/metrics.py`), and the forecast is written down. A forecast over the appetite is cut to fit before
      the start, never during.
   f. **A fresh review:** a reviewer given only the use case, the end sentence, the readiness file and the task list
      answers "what would stop a user from reaching the end that is not on this list?" Each answer becomes a task, or is
      named out of scope with the reason.
   The lead starts the feature only when every part has its answer. **The case goes to the owner as a page, not as a
   question** (the owner: "create the readiness review as an artifact where you present and show the case. But do not
   wait for my approval. i can give feedback when i check the artifact"): the lead publishes the readiness file as a
   page labelled "Draft for direction" (the use case and end; each part's finding with its evidence, the pictures shown;
   what was put out of scope and why; the budget and its forecast from the last feature's times; the task list), tells
   the owner the link in one line, and starts the feature without waiting. The owner's notes on the page are read at
   each hourly check and go into the tasks as they are given (a note that changes scope is put to the owner in chat).
   The retrospective counts each task added after the start as a miss of this review, and names the part that should
   have found it (the first feature: 78% added after the start; the aim is under 30%).
6. **On the list:**
   ```
   node tools/feat.mjs feature add F03 --name "..." --use-case "..." --end "..." --budget 3d
   node tools/feat.mjs task add F03 --use-case "..." --desc "..." --done "..." [--done "..."] --size M --kind <kind> --screens "..." --steps "..."
   node tools/feat.mjs start F03
   ```
   The start is refused while another feature is in build, or while a closed one has no retrospective (the skill
   `feature-retro`). The list commits itself. The kinds are set in `team-workflow.json` (`tools/config.mjs`).
7. **Hand it out:** a message to the builder and QA: the feature, its end, its budget, `feat.mjs next`. One line in the
   work inventory for the feature, with who has it.

## The progress page
Not included in the kit: build one for your host from `features.json` (and the JSON of `tools/metrics.py` for the
weekly numbers), or use `node tools/feat.mjs status` alone until you have one.
The owner asked for "a living artifact document where i can see progress and remaining work. visuals are very
important". Keep one page that reads `<deliveryDir>/features.json` (published beside it) and draws the features, their
tasks by state and kind, the budget used and the burnup. The lead republishes it after every change to the list and at
each hourly check. Every task has a `--kind`, its colour on the page.

## During the build
- A task found missing is added (`task add`; it shows as added after the start); one that does not fit the budget is
  cut with a reason (`task cut`). Never edit or remove a done-when to make a task pass.
- `feat.mjs status` daily: budget used against tasks passed. At the budget: stop and re-plan, with the owner if scope
  changes.
- When every task has passed QA: publish the stage build (`docs/stage-live.md`), `feat.mjs look F03 --stage <n>`, and
  ask the owner to look, once, in chat, with what to try. The owner's answer: `feat.mjs done F03 --owner-words "..." --date
  ...`, and `record-decision` if it decides anything. Then the skill `feature-retro`.
