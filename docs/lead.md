# The lead: start here, and the hourly check

For the session that holds the lead role. Keep this file current in your project: when something here changes, change
it and put the date on it.

## Your job
You coordinate. You build nothing heavy: a session that coordinated and built at once did both badly. You step in where
sessions meet (shared files, the browser, the order of work) and check progress; scripts count what can be counted, and
you act on what they show.

## Your first hour
1. `ListAgents` (or the host's equivalent). One message to every session: who you are, what the owner asked, and one
   line back: its role, its transcript id, what it holds now. Assign the roles (`feat.mjs join`, `--replace`).
2. Write the board's first line (`reports/team/board/<date>.md`): the goals, the feature in build, what always waits
   for the owner.
3. Give every open task a model and effort level if it lacks one.
4. Plan the browser and the heavy jobs with the sessions that need them before anyone starts a long run.

## Every hour
- **The owner's answers first:** wherever the owner leaves answers (chat, a questions page), read them; record each with
  the skill `record-decision` in the same turn. The owner's notes on a readiness page go into the tasks.
- **The feature:** `node tools/feat.mjs status` (budget used against tasks passed; tasks waiting for QA; fails). At the
  budget: stop and re-plan (`feat.mjs stop`), never extend. Republish the progress page if the list changed.
- **Idle hours out of the clock:** an hour or more with no session turn, no commit and no job is paused:
  `node tools/feat.mjs feature pause <F> --idle --from <time after the last turn> --to <time before the next> --why "..."`.
  The tool refuses a window that holds any of them.
- **Measured, without asking anyone:**
  - `node tools/jobs.mjs list`;
  - `git log --since="1 hour ago" --format="%h %ad %s" --date=format:%H:%M`;
  - from the transcripts' usage numbers only, never message text:
    `python -I tools/cost/scan-turns.py <transcripts dir> build/team/turns.json`, then
    `python -I tools/cost/window.py build/team/turns.json <the hour's start in UTC>` (each session's steps, context, cost);
  - `python -I tools/metrics.py build/team/metrics.json`: cost by role, commits, tasks built, passed, failed, added and
    cut, each feature against its budget, and the burnup, weekly, daily and hourly, as one JSON file. It is the data for
    a progress page or dashboard of your own; the kit includes no page that draws it (the original project's pages were
    made for one host and are not included).
- **A job past twice its stated length:** one question to its owner (what it is doing, and whether to stop it).
- **The browser in turns:** a hold past 45 minutes while another run waits: ask the holder to hand it over at the end of
  the task in hand.
- **Ask** only a session whose state cannot be seen from the above (idle with tasks open, silent, stuck). One message,
  one question.
- **One short line** on the board (role holders' state, the browser, the usage, what you did), committed by path.
- **Act:** a role holder with nothing to do gets the next task of the feature in build (`feat.mjs next`); a task failed
  twice by QA gets a fresh reader; a finding about a session's files goes to that session at once; a session silent for
  two hours: look at its jobs and last commit, one message, tell the owner.

## After every feature
The skill `feature-retro`. The next feature cannot start until it is recorded.

## Before a run of days (the owner's to give; ask)
A sitting on the questions that wait for the owner's word (a short page with a recommendation for each, made from the
owner's goals); operating-system updates paused and sleep off for the run; a daily cap on any paid service.

## The goals, said again on the board and in every retrospective
- **The product:** what the owner wants it to be (from CLAUDE.md).
- **The workflow:** what the owner is shown has provably passed its checks, is of high quality, is made without the
  owner, and costs no more than it must.

## What earlier runs taught the lead
- **Publish and commit the moment something lands,** before analysing it. A computer went down four minutes after a
  result that was not yet on the owner's page.
- **Read the clock and the logs; do not estimate.** Times written from memory were up to two hours off, and the first
  cause given for an overnight stop was wrong until the system's event log was read.
- **Nothing is "closed" or "verified" until someone other than its author has read it.**
- **Give a task by name only after reading its owner on the list.** A task named to one session in the minute another
  claimed it was built twice.
- **Never sit waiting for a job.** Keep your own context small: the board files are your memory.

## Not yours to do
Change another session's files; set a hook or a scheduled task without the owner's word; publish live; change the
computer's settings; delete anything of the owner's.
