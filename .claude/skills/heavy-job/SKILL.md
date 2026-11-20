---
name: heavy-job
description: Start, watch and stop long jobs on this computer (whole builds, long test suites, renders, data runs) through one list with a cap, so the computer is never overloaded by several sessions at once and every result can be traced to the run that made it. Use before starting any job longer than a few minutes, and when asked what is running.
---

# Heavy jobs on this computer

In the project this kit comes from, one day 28 search processes from several sessions put the owner's computer at 93%,
a run took over three hours instead of 80 minutes, a duplicate queue ran a check on a file that did not exist yet, and
a helper's stop was refused because nobody could tell which processes were whose. One list fixes that.

## Rules
- **At most two heavy jobs at once** across all sessions and their helpers (`jobsCap` in `team-workflow.json`, 2 by
  default). A job that runs several processes in parallel uses at most four. One headless browser at a time, always.
- **Every heavy job goes through `tools/jobs.mjs`**, so `list` shows it, with its log and its result file.
- **A result is used only if it is fresh:** written after its job started (`wait` says fresh or stale), and not
  byte-identical to an older result (`cmp` against the previous run's file). A chain that copies a report at the end
  checks that its input exists first.
- **The exit code is the verdict, not the file.** A fresh output says the job wrote it, not that the job passed.
- **A helper that stops** names its running jobs in its report, by their job names. Nobody leaves an unnamed process.
- **No background loop that starts jobs by itself.** Stopping a background shell's task can leave the loop and its
  children running; wait in the foreground (`wait`) or start the next job yourself.

## Commands
```
node tools/jobs.mjs start <name> [--out <result file>] [--minutes <n>] -- <command ...>
node tools/jobs.mjs list                      # running, ended (exit code), stopped or lost; flags a job past 2x its minutes
node tools/jobs.mjs wait <name> [--timeout <seconds>]   # exit code + whether --out is fresh; exit 0 only for both
node tools/jobs.mjs stop <name>               # the whole process tree
```
Name jobs by what and which build: `build-264`, `e2e-full-264`, `render-sheet-3`.

A chain is best started as one script (`sh <script>` or `node <script>`): `stop` reaches it and the programs it runs.
The code of a chain is the code of its last command: end it with the program whose verdict counts, or `exit $code`.

`start` holds a lock (`<jobsDir>/.lock`) from reading the list to writing it, so two sessions starting at the same
moment cannot both pass the cap.

**What `list` cannot see.** When a job's runner is killed alone, the command under it may go on running while `list`
says `lost`, and the cap does not count it. Such a process can be found only by its command line (Windows:
`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '<script>' }`; elsewhere `ps -eo pid,args`).
Never end a process by the number in the list alone: the system may have given that number to another process.

The tool's own test, run after every change to `tools/jobs.mjs`: `node tools/jobs-selftest.mjs`.

## Before starting
1. `node tools/jobs.mjs list`: what runs now, and is anything stuck (alive for hours with no log growth)?
2. Is the input there? (`ls` the files the job reads.) Start nothing on a file another job is still writing; chain them
   in one command instead (`build && check`).
3. Write the job's name, command and result path into the work inventory's entry for the work.
4. A job longer than about 20 minutes: a helper starts it, names it in its report and ends its run; a fresh short
   helper or the session reads the result later. Never sit waiting on it with a full context.

## Stopping
Stop through `stop <name>`. A job not in the list is found by its command line (above) and stopped by id, parents
first, only when the owner asked for it or it is this session's own; a refused stop is put to the owner, never worked
around.
