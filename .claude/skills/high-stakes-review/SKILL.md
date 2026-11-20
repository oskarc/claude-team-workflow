---
name: high-stakes-review
description: One review by a fresh helper on the strongest review model of a change that is costly to get wrong - the save or data format, determinism, the shared constants, code every screen leans on, a security or data-loss risk, or the team's own tools and hooks that every session runs - given the diff and the task's checks, never the builder's conclusions. Limited to those cases. Use before such a change is marked built.
---

# A high-stakes review

The owner: "we can run review subagents on fable for limited high stakes work." The strongest review model costs more
than the builder's, so it is used only for the cases below; ordinary tasks are checked by QA. The brief follows
obra/superpowers' `requesting-code-review` (MIT, Copyright (c) 2025 Jesse Vincent): the reviewer gets crafted context
and the commits, never the session's history.

## When (one of these, or the lead's word)
- the save or data format, or anything that can lose a user's data or progress;
- determinism (a fixed timestep, random numbers, the order of updates), where the project depends on it;
- the shared constants (the project's table of fixed numbers) or a rule several systems share;
- code every screen or system leans on (start-up, the store, the render loop, the request layer);
- the team's tools and hooks that every session runs (`tools/feat.mjs`, `tools/hook.mjs`, `tools/jobs.mjs`, the
  settings files);
- a security or data risk (anything that reads or sends personal data, tokens, outside requests).
At most one per task; a second round only after the fixes, and only for the findings marked critical.

## The call
`Agent` with the strongest review model the project names (CLAUDE.md), `effort: "high"`, `description` beginning with
the task's id ("F03-T2 review the save change"). The brief:
1. **What it is:** the task's use case and done-when checks (from `feat.mjs next` or `features.json`), the area's rule
   file and the spec that owns the system, by path.
2. **The change:** `git diff <base>..<head> -- <paths>` and the commits' ids; the tests that cover it.
3. **Not given:** the builder's report, its reasoning, "this is fixed".
4. **The task:** find what would break: wrong behaviour, a case the tests miss, lost data, a non-deterministic step, a
   change that reaches further than the task. Each finding: critical / important / minor, the file and line, a concrete
   failure (input, state, what goes wrong). Under 400 words. No edits.
5. The helper rules of the skill `helper-round` (git, one browser, the context budget).

## After
- Critical: fixed before the task is marked built, each with a test that failed before the fix. Important: fixed or
  given to the lead as a task with a reason. Minor: listed in the task's built note.
- A finding judged wrong is answered with evidence (the code, a test), not by agreeing.
- The review's verdict and what was done go in the built note (`feat.mjs built ... --note`).
