# Stage and live builds

The owner: "we can have a "live" artifact and a "stage" artifact, and the team can publish to stage whenever."

## Two addresses
- **STAGE:** where every built task is checked. Any session may publish a committed build there after the night's (or
  the task's) checks pass. QA verifies tasks only on stage. Each stage publish gets a build number, and the builder names
  it in the message to QA.
- **LIVE:** what the owner and users open. It takes only the build that is on stage (the same commit, the very same
  files), and only on the owner's word, recorded with its date.

## The rules
1. **Publish from a clean copy of a commit,** never from a working tree that other sessions are editing: make a worktree
   or export of the commit, build there, publish that.
2. **Run the checks before a stage publish:** the project's tests, its type check, a smoke run, and the layout audit at
   every target device size (set in CLAUDE.md). The audit may be narrowed to the screens the change touched; the whole
   audit is run when asked for by name and before every live publish.
3. **Record each publish** in one committed file (for example `published-builds.json`): the address, build number,
   commit, version, time, and the hashes of the files sent.
4. **Live sends the same set of files stage was sent,** checked against the recorded hashes; a live publish of a commit
   other than the one on stage is refused. Live needs the owner's words and the date; a program cannot check the words
   are the owner's, so the session quotes them exactly.
5. **Label what is published:** "Verified" when every required check passed on these exact files, otherwise "Draft for
   direction" with what did not pass or did not run.
6. **A feature's end is looked at on stage.** When every task has passed QA, the lead runs `feat.mjs look <F> --stage
   <n>` and asks the owner to look once; the owner's answer may also be the word for live. `<n>` is whatever names the
   stage build in your project (a build number, a version, a short commit hash); `feat.mjs` only records it beside the
   feature and reads no file for it. The record of publishes in rule 3 is the project's own, and no kit tool reads it.

## Where to host
Anything the owner can open on the target device: an internal web host, a preview channel of an app store, a private
page on a sharing service. The pattern needs only two stable addresses and a record of what went to each.
