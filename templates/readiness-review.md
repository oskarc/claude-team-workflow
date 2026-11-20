# <F03> <feature name>: readiness review

Label: Draft for direction. Written by the lead; each part by its holder. Times as `date` printed them.

## The feature
- **Use case:** <the user's words: "The user exports a report and opens the saved file">
- **End:** <one sentence a person can check by using the product>
- **Budget:** <hours>, forecast <hours> (part e)

## a. The play-through (QA)
Stage build <n>, commit <sha>, at <each target size>. The whole use case from the first step to the end sentence.

| # | What was done | What was seen | Evidence (picture, log) | Task, or out of scope and why |
|---|---|---|---|---|
| 1 | | | | |

## b. The code read (builder)
For each task: what it touches, what is known, what is not.

| Task | Files and systems | Known | Unknown, and the probe that settled it |
|---|---|---|---|
| T1 | | | |

## c. The design check (design, or the lead)
The task list read against the screens as they stand. What changed in the tasks because of it.

## d. The carry-over
The tasks taken in from `carry-over.md`, as written there, with their done-when unchanged.

## e. The budget from evidence
The last feature's actual hours by kind and size (`tools/metrics.py`), and this feature's forecast.

| Size | Kind | Last feature's mean hours (n) | Tasks here | Forecast |
|---|---|---|---|---|
| S | | | | |

Forecast <total> against the budget <budget>. What was cut to fit, if anything.

## f. The fresh review
The reviewer was given only the use case, the end, this file and the task list. Its answers to "what would stop a user
from reaching the end that is not on this list?":

| # | Finding | Task, or out of scope and why |
|---|---|---|
| 1 | | |

## Out of scope, and why
-

## The task list at the start
| Task | Size | Kind | Use case | Done when |
|---|---|---|---|---|
| T1 | | | | |

## The owner's notes
(read at each hourly check; each with what was done about it)
