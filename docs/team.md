# The team

A team of Claude Code sessions, each in its own tab or terminal on the same repository, working as a delivery team for
one owner.

## What the host must provide
The kit's tools run anywhere with git, Node and Python; the team around them leans on what the Claude Code host offers:
- **Messages between sessions** (`ListAgents` to see the open sessions, `SendMessage` to write to one), so the lead
  can ask and assign. Without them the board, the hand-over files and `feat.mjs status` carry the team's state, and the
  owner relays messages.
- **A session id in each session's shell** (`CLAUDE_CODE_SESSION_ID`): `feat.mjs` knows a session's role by it. A tool
  run from a shell without it counts as the owner.
- **Summaries at a chosen size** (`autoCompactWindow` in `~/.claude/settings.json`), so long runs go on after a
  summary with the hand-over file; without it the owner clears tabs by hand.
- **Something that wakes the lead every hour** for its check: a scheduled task or loop the host offers, a hook on the
  lead's own turns, or the owner. The kit has no scheduler of its own.
- **Hooks** (SessionStart, PostToolUse) for the optional delivery hooks.
- **A place to publish the stage and live builds** the owner can open on the target devices (`docs/stage-live.md`).

## Roles

| Role | Holds | Does | Never does |
|---|---|---|---|
| Owner (a person) | the product's direction | picks features, looks once at each finished feature, decides what only the owner can (direction, purpose, the bar, shared settings, live builds) | is asked about a number inside a method |
| Lead | the delivery list | shapes features, runs the readiness review, assigns roles, the hourly check, the retrospective, the progress page, puts stored questions to the owner | builds anything heavy |
| Builder | the code | takes the next task, builds what its checks ask, proves each, commits, marks it built, publishes the stage build | passes its own task |
| QA | acceptance | uses each built task on the stage build at the target sizes, passes with evidence or fails with what was seen; plays the next feature's use case for the readiness review | edits the product's code |
| Design (optional) | the screens' quality | checks the task list against the screens before the start; audits screens and pages before the owner sees them against standards it researches | edits the product's code |

All four roles must be held; a session may hold more than one when the team is small, but never builder and QA for the
same task. The lead assigns and changes roles: `node tools/feat.mjs join <role>` (the lead: `--replace`). A session is
known to the tools by its transcript id (`CLAUDE_CODE_SESSION_ID`, set in every session's shell); the owner's shell has
none, which is how the tools tell the owner apart.

Model and effort: each piece of work states the model and effort it needs; the builder runs on the strongest building
model; reviews of high-stakes changes run on the strongest review model, and only those.

## Messaging between sessions
Sessions talk through Claude Code's messages between sessions (`ListAgents`, `SendMessage`) where the host offers them.
A message wakes the receiving session at its whole context, so:
- one message, one question, a short answer asked for;
- ask only a session whose state cannot be read from the list, the commits and the job list;
- a claim about a session's work goes to that session before it goes on a page.
A helper never writes a check-in or board line for its parent: its shell carries the parent's session id.

## The board
`reports/team/board/<date>.md` (`templates/board-day.md`): one line per hourly check by the lead (the role holders'
state, the browser, the usage, what the lead did), committed by path. The progress page (built from `features.json`)
is the owner's view; the board is the team's.

## Hand-overs after a summary
Every tab is summarised by Claude Code at a set window (`autoCompactWindow` in `~/.claude/settings.json`; a session is
summarised at about 70% of it). Before that point a session keeps its hand-over current in
`reports/team/handover/<role>.md` (`templates/handover.md`): what it holds, where each piece stands, what is running,
what it was about to do. After a summary, before anything else: read the hand-over, then `node tools/feat.mjs next`.
A session that wants its tab cleared writes and commits its hand-over and says so as its last text; clearing is the
owner's.

## The computer in turns
- **Heavy jobs** go through `tools/jobs.mjs`, at most two at once across all sessions (the skill `heavy-job`).
- **The browser in turns:** one headless browser at a time. A session holds it at most 45 minutes while another
  session's run waits, and hands it over at the end of the task in hand. Hours with a run queued and the builder idle
  are counted on the board line; when turns still leave more than half an hour a day of waiting, a second headless
  browser for QA only is allowed.
- Shared files: a file with another session's uncommitted lines is not committed by anyone else; shared logs are
  appended by reading right before writing.

## Hooks
The delivery hooks (`tools/hook.mjs`) add two kinds of notes to sessions, nothing else:
- **SessionStart:** under 600 characters into the session's context: its role, the feature in build with tasks passed
  and budget used, and the command for its next task.
- **PostToolUse:** a note when a file of the delivery record was edited by hand (it is written only by `feat.mjs`); a
  note to the builder after a commit while a task is open, to mark it built (at most once in 30 minutes).

**The safety rules every hook of the team keeps:**
1. Everything inside one catch; any fault ends with exit code 0 and no output.
2. It ends itself after three seconds; the settings entry has a timeout of 5 seconds.
3. It never exits with code 2, so it can never block a tool call or hold a stop.
4. No PreToolUse or Stop entries from the installer.
5. It reads small files only and runs no program.
6. An off switch without touching the settings: while `<stateDir>/hooks-off` exists it does nothing.
7. Sessions run a live copy (`<stateDir>/live/hook.mjs`), never the file a helper is editing.
8. Only the installer writes its entries: `node tools/install-hooks.mjs --settings <file> --owner-word "<the owner's
   words>" --date <YYYY-MM-DD>`. It runs the hooks' selftest first and refuses if it fails; tries each command line
   through a shell; writes by rename, keeps the file as it was beside it (`<file>.before-delivery`), and records the
   owner's words in `<stateDir>/installed.json`. `--remove` takes out its entries and nothing else.
9. A hook in the shared settings (`.claude/settings.json`, `.claude/settings.local.json`) reaches every session, so it
   needs the owner's word.
