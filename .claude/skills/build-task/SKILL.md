---
name: build-task
description: The builder takes the next task of the feature in build from the delivery list, builds exactly what its use case and done-when checks ask, proves each check with fresh evidence before calling it built, commits by path and marks it built for QA. Use when the builder starts work, after QA fails a task, or when asked what to build next.
---

# Building a task

The builder (on the strongest model: the owner, "we switch builder to opus") works one task at a time from
`node tools/feat.mjs next`. The verification gate below is adapted from obra/superpowers'
`verification-before-completion` and `test-driven-development` (MIT, Copyright (c) 2025 Jesse Vincent).

## Steps
1. **Read the task** (`feat.mjs next`): its use case, screens, the user's steps and done-when checks, and QA's last
   fail if it has one. Read the area's rule file (`.claude/rules/<area>.md`) and the spec that owns the system. When a
   check cannot be met as written, or the task is bigger than its size, say so to the lead before building: the lead
   splits or changes the task on the list, never the builder.
2. **Build only what the checks ask.** Something else found on the way goes to the lead as a line for a later task,
   not into this one.
3. **A failing test first** where the logic or a rule changes: run it and see it fail for the right reason, then make
   it pass. A bug fix starts with a test that shows the bug.
4. **The gate: no "built" without fresh evidence.** For each done-when check:
   - name the command or the look that proves it (a test, the smoke run, a picture at the target device sizes from the
     project's screen audit or a probe of that screen);
   - run it in full, now, after the last change; read the output and the exit code;
   - only then write that it holds. "Should work", "probably", a helper's report or an older run are not evidence.
   Plus the project's nightly checks that the change touches (named in CLAUDE.md: tests, type check, the screen audit
   of the screens changed, one browser at a time). Run the full audit once before a feature goes to the owner, not
   after every task.
5. **Commit by path** (never a folder; never stash, checkout, reset or rebase: other sessions work in the same tree),
   push if the project pushes.
6. **Mark it built** with the commit: `node tools/feat.mjs built F03-T2 --commit <sha> --note "..."`; the note names
   the evidence for each check (file paths of pictures, test names). Tell QA in one line.
7. **The stage build** for QA: when the feature's open tasks are built, or at the end of the day's work, publish STAGE
   (`docs/stage-live.md`) and tell QA its number.

## A high-stakes change
A change to the save or data format, determinism, the shared constants, code every screen leans on, or the team's own
tools and hooks gets one review by a fresh helper on the strongest review model before it is marked built (the skill
`high-stakes-review`). Not for ordinary tasks.

## When stuck
Two tries at one fault, then a fresh look (systematic: read the error, reproduce, check what changed, one hypothesis at
a time); four rounds on one problem, then stop and tell the lead.
