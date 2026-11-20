---
name: helper-round
description: Write the brief for a helper round (a subagent given one piece of work) with the standing rules every brief needs - ownership, git by path, shared files, the computer's job cap, context checkpoints, the four-round rule, the look before the measures, and a short report. Use whenever handing work to a helper.
---

# A helper round

Every brief carries the standing rules below, so they are not retyped and nothing is forgotten. Before these rules,
nearly every helper ran 30-90% past its context budget and had to be stopped mid-work, and twenty rounds went by on
measures before anyone looked at the result.

## The call that starts the helper
A helper started for a piece of work: the call's `description` begins with the task's or piece's id and holds no other
id ("F03-T2 build the export"; not "Build F03-T2 export", not "F03-T2 after F03-T1's fix": either gives the board no
task). `model` and `effort` are the piece's, given in every call (a helper with no effort takes its session's, which
may be far higher than the work needs). A helper that only reads or reviews another session's result does not begin
with an id. The model guide: `.claude/rules/workflow.md`, "A model and an effort level per piece".

## The brief's parts, in order
1. **Who and why:** "You are a helper of <session or role> ... the owner decided ... (the owner's words, the rule
   file)". The one piece of work.
2. **Read first:** the area's rule file, the standard or research that applies, the log section where the last round
   stopped. Paths, not summaries.
3. **Where it stands:** numbers and file paths from the last round, two to six lines.
4. **The work:** one or two faults, in order, each with how it is proven. No new attempts beyond them.
5. **The look first:** before any measure-driven change, the helper looks at the thing (a screen, a picture, the
   output) and says what a user would see; a round that cannot change what is visible to the user is not worth running.
6. **Ownership:** what it may edit, what other helpers own now (by file), what nobody touches (a file with another
   session's uncommitted lines, the work inventory, the rule files, CLAUDE.md). Shared logs are appended by reading
   right before writing.
7. **Standing rules** (copy as they are):
   - Git: commit by path (`git commit -m "..." -- <paths>`; a new file `git add -- <file>` first; never a folder); never
     stash, checkout, reset or rebase; a rejected push: `git fetch origin main && git merge --no-edit origin/main && git
     push`; messages end with the project's co-author line.
   - Heavy jobs through the skill `heavy-job` (`tools/jobs.mjs`, its cap); one headless browser at a time.
   - No background loop that starts a job by itself: stopping its task ends the shell, not the loop (two helpers'
     waiters once started runs after they were told to wait). Wait in the foreground, or end the loop by its whole
     process tree and check the process list before saying it is stopped.
   - Absolute paths (relative ones have landed in the wrong folder).
   - Downloads in a new empty folder, nothing run from it, Python with `-I`; no personal data in web requests.
   - Context: a budget (150-250k by the work's size). At 60% commit what is proven and write the hand-over line in the
     log; at 80% stop starting anything, finish the step in hand, commit, report. Name any job left running.
   - Four rounds on one problem, then stop and report.
   - Read the sections named in this brief, never a whole file over 300 lines; before proposing anything new, search
     for prior work in the area (the rule file, the area's log, `git log -S`).
   - Write a time only as `date` printed it, a length only as measured, a result only after reading the command's
     answer; build a file that other programs load as a copy and put it in place as the last step. Run `date` in the
     same command that writes the time into a file, and read it before writing a time into a message (on one day four
     sessions wrote guessed times).
   - A job longer than about 20 minutes: start it through the job list, name it in the report, and end your run; a
     fresh short helper or the session reads its result. Never sit waiting on a monitor (helpers have run to 250k
     waiting on a 73-minute job).
   - Never write the team's check-in or board line for your parent: your shell carries your parent session's id, so
     the line would be written in its name. Your parent writes its own line.
8. **Report:** to the parent, under 300 words: what changed, its proof, what a user would now see, the commits, what is
   left. Nothing shown to the owner.

## Before sending
- At most two helpers at once (the owner: "Show first, then one slice").
- Write the hand-out into the work inventory first (the skill `record-decision`'s tool, `tools/notes.py`).
