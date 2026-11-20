# Manifest

The kit's files and what each is for. The kit was taken from a working project's workflow; tools tied to the original
project were left out.

## Top level
| File | For |
|---|---|
| README.md | what the kit is, the loop, the folder map, adopting it in short |
| CLAUDE.md.template | the note-keeping skeleton for a project's CLAUDE.md, with placeholders |
| team-workflow.example.json | the kit's settings, every key optional (copy to team-workflow.json) |
| package.json | `npm test` runs every selftest; `npm run status`, `npm run jobs` |
| LICENSE | MIT |
| MANIFEST.md | this list |
| .gitattributes, .gitignore | line endings; build output and caches kept out of git |

## .claude/
| File | For |
|---|---|
| rules/workflow.md | the workflow's rules in force; loaded when the tools, skills or settings are opened |
| rule-history/.gitkeep | the folder for replaced decisions and long accounts |
| skills/shape-feature/SKILL.md | the lead shapes a feature, runs the readiness review, starts it |
| skills/build-task/SKILL.md | the builder takes, builds, proves and commits the next task |
| skills/verify-task/SKILL.md | QA passes or fails a built task on the stage build |
| skills/feature-retro/SKILL.md | the retrospective after a feature, with measured changes |
| skills/high-stakes-review/SKILL.md | one strong-model review of a change that is costly to get wrong |
| skills/fresh-review/SKILL.md | a reviewer with no history judges a result before the owner sees it |
| skills/helper-round/SKILL.md | a helper's brief with the standing rules |
| skills/heavy-job/SKILL.md | long jobs through one capped list |
| skills/record-decision/SKILL.md | the owner's decision into the rule files and the inventory, safely |

## docs/
| File | For |
|---|---|
| method.md | the delivery method and why each part is there |
| team.md | what the host must provide, roles, messages, the board, hand-overs, the computer in turns, hooks |
| lead.md | the lead's first hour and hourly check |
| decisions.md | the owner's decisions on the workflow in date order, with the words |
| lessons.md | what cost time once, and the rule each left |
| adopting.md | adopting the kit, step by step |
| stage-live.md | the stage and live builds |

## templates/
| File | For |
|---|---|
| work-inventory.md | the work inventory, written when work is received |
| board-day.md | the lead's board, one line an hour |
| handover.md | a session's hand-over, read after a summary |
| readiness-review.md | the six parts of the readiness review, with evidence |
| retro.md | the retrospective's report |
| carry-over.md | unfinished tasks carried to the next feature |

## tools/
| File | For |
|---|---|
| feat.mjs, feat-selftest.mjs | the delivery list: features, tasks, roles, pauses, retrospectives, in a hash-chained record |
| hook.mjs, hook-selftest.mjs | the delivery hooks: a note at session start, notes after tool calls |
| install-hooks.mjs | installs or removes the hooks in a settings file, with the owner's word recorded |
| jobs.mjs, jobs-selftest.mjs | the job list with a cap: start, list, wait, stop |
| notes.py, notes_selftest.py | writes notes into several files only after checking every anchor |
| metrics.py, metrics_selftest.py | weekly, daily and hourly numbers as JSON for a dashboard of your own |
| cost/scan-turns.py | per-turn usage numbers from the session transcripts (no message text) |
| cost/window.py | each session's steps, context and cost in a time window |
| config.mjs | reads team-workflow.json and finds the project's root |
| selftest.mjs | runs every selftest, one at a time |
