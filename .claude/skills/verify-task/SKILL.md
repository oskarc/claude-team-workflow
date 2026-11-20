---
name: verify-task
description: QA checks a built task of the feature in build against its done-when checks on the published stage build at the target device sizes, as a user would, and passes it with the evidence or fails it with what was seen. Only QA passes a task, never the session that built it. Use when the builder marks a task built, or when asked what waits for QA.
---

# Verifying a task

QA is the only one who passes a task (the owner's approval of the delivery workflow; `docs/decisions.md`). A pass means
a user can do what the task's use case says, on the stage build. Adapted in part from obra/superpowers'
`verification-before-completion` (MIT, Copyright (c) 2025 Jesse Vincent): "requirements met" needs a line-by-line check
against them, not passing tests; a builder's report is not evidence.

## Steps
1. **The task:** `node tools/feat.mjs next` gives the oldest built task, its checks, its commit and the builder's note.
   Do not read the builder's conclusions first: read the checks, then look.
2. **Use it** on the newest stage build (its number in the builder's message), at each target device size set in
   CLAUDE.md (for a phone: upright and sideways), as the task's steps say, first step to last. One headless browser at
   a time, in turns (`docs/team.md`).
3. **Each done-when check, one by one:** what was done, what was seen, the picture's path. A check that holds only
   with a trick (a reload, a debug key, a desktop window) fails.
4. **Also look at** what a user would hit next to it: overlapping or cut text, a button off screen, a dead control, a
   screen with no way back. Something wrong outside the checks is not a fail of this task: write it to the lead as a
   line for a later task.
5. **Pass** with the evidence (each check and what was seen, the stage build's number):
   `node tools/feat.mjs pass F03-T2 --evidence "Stage 264: ... ; ... "`
   **or fail** with what was seen and where: `node tools/feat.mjs fail F03-T2 --why "..."`, and tell the builder.
6. A task failed three times: tell the lead (the task may be wrong, not the build).

## A feature's last check
When every task has passed, QA uses the feature's end sentence once from the first screen, and says to the lead
whether the end holds as a whole. Then the lead asks the owner to look.
