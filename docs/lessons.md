# Lessons

What cost time once in the project this kit comes from, each with the rule it left. Most are about many sessions sharing
one repository and one computer.

## Git and shared files
- **A stash, checkout or reset in a shared tree loses another session's work.** Commit by path only; never a folder.
- **Uncommitted lines in a shared file go into the next session's commit of it.** Check `git diff <file>` for lines that
  are not yours before committing a shared file; write and commit a shared file in one go.
- **A script that writes several files and fails half-way leaves half a record.** Check every anchor in every file first,
  then write (`tools/notes.py`).
- **A failed heredoc in Git Bash does not stop the next line.** Write multi-line text with a file-writing tool, chain with
  `&&`, and pass a commit message by `-F <file>` rather than `-m` with quotes.

## Time and evidence
- **Times written from memory were up to two hours off,** and the first cause given for an overnight stop was wrong until
  the system's event log was read. Every time is read from `date`, a commit or a command's output.
- **A fresh file is not a passing run.** Read the job's exit code; check the output was written after the job started
  and is not byte-identical to an older one.
- **Numbers passing is not the look.** A result passed every measure and still looked wrong; look first, then measure.
- **The maker's verdict is not evidence.** Nothing is closed until someone other than its author has read it.

## The computer
- **Several sessions starting jobs at once overloaded the computer** (28 search processes, 93%, a run three times its
  length). One job list with a cap.
- **Stopping a background shell's task can leave its children running;** a background loop that starts jobs by itself
  went on starting them after its session was told to wait. No such loops; stop by the whole process tree and check
  the process list.
- **A process number is reused by the system.** Never end a process by an old number alone.
- **One headless browser held for 54 minutes kept another session's helpers waiting.** Turns of at most 45 minutes
  while another run waits.

## Context and cost
- **Nearly every helper ran 30-90% past its context budget** before checkpoints were in its brief. 60% commit, 80% stop.
- **Half the token cost was the part of each step's context above 150,000 tokens,** and 14% was waiting (steps that only
  watched a job, and whole-context rewrites after a pause). A helper does not wait for a long job: it starts it and ends
  its run; a fresh short helper reads the result.
- **A message wakes a session at its whole context.** One message, one question, a short answer.
- **A dialog that asks the owner a question holds the whole session** until answered (one held a session three hours).
  Questions are stored and asked in chat.

## Planning
- **78% of the first feature's tasks were found during the build.** The readiness review exists for this.
- **On every day of the open-ended list more pieces were added than finished.** Fixed budgets and a burnup.
- **The same piece was built twice** when it was named to one session in the minute another claimed it. Read the list's
  owner before giving work by name.
- **Asking the owner about numbers inside a method gives guesses.** Ask direction; settle numbers by evidence.
