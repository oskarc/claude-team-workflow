# The owner's decisions on the workflow

Every rule of this kit came from an answer of the owner's in the project it was built in, in about ten days of
November 2026. Each entry: what was asked or what happened, the owner's words (trimmed, spelling as given), what changed,
and why. In date order. Your own project starts its own list in `.claude/rules/workflow.md` (the skill
`record-decision`); this one is the evidence behind the kit's defaults.

## Before the delivery flow

**How the work is run (2026-11-07).** From one session's reflection on two weeks of slow rounds, which the owner asked
to be captured ("we should adjust how we work here"). Changed: show first (what is built reaches the owner's device
early and is judged there); one vertical slice before breadth; foundations checked once before fine work stands on
them; look before measuring; evidence, not estimates; at most two helpers; four rounds, then the owner; the bar is the
owner's, and the gates serve it. Why: twenty rounds had gone by on measures before anyone looked at the result.

**What the workflow is for (2026-11-11).** The owner asked for an analysis of the ways of working: "I am looking for an
autonomous workflow that yields high end results so what i am being shown has provably passed all checks and
verifications and is always of high quality, not never at a higher cost that what is required." And: "We do not do what
others do, what others do is inspiration and examples to be evaluated; we build our own method, apprach and discipline
here." Changed: the goals of the workflow as written in `docs/lead.md`. Research is adapted, not copied.

**Two labels on what the owner is shown (2026-11-11).** Asked which kinds of showing were wanted, the owner chose two:
"Verified" (every required check passed on these exact files) and "Draft for direction" (says what did not pass or did
not run). The label is written by a program from the checks' records, never by the maker. Why: a draft must never look
like a result. (In this kit the labels are a convention only, and the refusing hook below is not included;
`.claude/rules/workflow.md`, "What the owner is shown", says how a project could add one.)

**A publish without a label is refused; the owner's word waives it (2026-11-11).** A hook refuses the publish; the
owner's word waives it and is printed on the label with the date. Why: a gate that can be skipped by forgetting is not
a gate.

**Cost measured per piece (2026-11-11).** Told that the analysis had read the usage numbers (tokens, model, time, tool
names; no message text) from the session transcripts, and asked whether cost may be measured this way from now on, the
owner said yes, per piece. Only the usage numbers are read, never message text (`tools/cost/`).

**Overnight work goes on, decided and documented (2026-11-12).** The owner's rule for nights: "document your decision
but keep working". Each decision is written with its reason; what changes what the owner sees waits for the owner's look.

**Working as a team, hourly check-ins (2026-11-12).** "you should do hourly checkins with all agents so you know the
status throughout for all agents, with that information we can review performance and teamwork. Being a team means you
all take responsibility for each other and lift the group up. Common understanding and common direction is
foundational." Then: "I have an expectation that you will continue working for 3-4 days without stopping under the
condition there is still work in the list", "we have hooks to wake on the reporting (consider it a reporting SLA)", "We
should announce an SDLC workflow that we intent to adhere to", and a review of the workflow after every piece of work.
Changed: the lead's hourly check (`docs/lead.md`), a lifecycle announced to all sessions, a review after each piece
(later: after each feature).

**A model and an effort level for every piece (2026-11-12).** "What we are missing is that each piece of work should
state a suggested model and effortlevel so each session adapts to the work." Changed: every task states both; a helper
started for it takes them.

**At a sitting on the team's open questions (2026-11-12).**
- The order of priority is the owner's; the team proposes it.
- For a run of days, the owner pauses system updates and sets sleep to never.
- The list tool commits its own files by itself.
- Hooks are tried on one session first; any hook in the shared settings stays the owner's to allow.
- No hook stops a session at a token count: "the checkin is required by all sessions to clear the SLA. i dont want
  sessions to stop working if they hit a certain token amount in the middle of the night."
- Two addresses for the build: "we can have a "live" artifact and a "stage" artifact, and the team can publish to stage
  whenever." (`docs/stage-live.md`.)
- Every check stops a publish exactly as its rule is written, no routine waivers: "quality first, if the system cant
  supply it we need to amend the system not lower the bar."
- Rule files are split into decisions in force and a history of replaced decisions and long accounts, nothing deleted.
  (`.claude/rules/` and `.claude/rule-history/`.)

**Questions are stored (2026-11-13).** "questions should be stored so that you can put them to me when i am present, and
handled when i am not." Changed: a question is written down where the team keeps its list, worded so the owner can answer
without opening a file; when the owner is away the team decides what it may, parks the rest and goes on. No dialog that
holds a session: one held a session for three hours.

**Sessions summarised earlier, with a hand-over (2026-11-13, changed 2026-11-14).** Asked whether a hook could clear a
session and tell it to read a hand-over: no hook can clear a session, but the setting `autoCompactWindow` makes Claude
Code summarise a session at a chosen size. The owner: "set it of all tabs immediately" (300,000), then 215,000 on
2026-11-14 (summarised at about 70% of the window, so about 150,000 in use). A session reads its hand-over after a summary.
A session that asks for a clear announces it.

**Ask the owner high-level questions only (2026-11-14).** On a question about a single number inside a method: "questions
like these im just guessing at, i have no way to lead you in this. This must be evidence backed, and you need to
reevaluate the method and data if the result is worse than expected. You may ask higher level questions, these are too
detailed." Changed: numbers, limits and formulas are settled by evidence; the owner is asked direction, purpose, what the
user should see, and for a look at a verified result.

**A team of three that cares for the codebase (2026-11-14).** After an evaluation of the autonomous work: "Lets reduce
the teamsize to 3, but id like to keep the coordinator that does team interference and checking progress. But the
coordinator can heavily rely on scripts and other automations, that is common sense. Have the team deeply care about this
codebase so they are commited and feel a long term responsibility for this." Changed: three sessions; the lead relies on
scripts for what can be counted; each session owns its parts of the code for the long term.

## The delivery flow

**A design session that audits screens (2026-11-16).** After rejecting a screen's structure and saying a sheet should
have been audited before it was shown, the owner started a session to "be the Senior lead designer who verifies any gui
changes and goes web searching to get the best practice and standards to verify against." Changed: the design role; it
advises and does not edit the product's code.

**Tasks with a clear end, and finishing measured (2026-11-16).** The lead had recommended building the next slice only
when the last one was fun. The owner: "i disagree that every piece has to be verified fun before the next can be built.
that is not a good measure. We need to break the work down to work tasks with a clear usecase and description, right now
we have features without a clear ending, and alot of work is just small adjustments that takes alot of time. The issue is
that we do not focus and we dont use any form of burndown or way to measure wether we finish any features." Measured at
the time: 290 pieces added in four days, 100 done. Changed: features of tasks with use cases and done-when checks, a
burnup, a focus limit.

**The roles and the delivery workflow approved (2026-11-16).** Proposed: a lead, a design lead, a builder, QA that alone
passes a task, the owner as product owner; Shape Up's fixed budget; Anthropic's harness of checks that start failing;
one feature in build; done in two levels; a stage build per feature; a burnup instead of the hourly board. The owner: "i
like this approach but we switch builder to opus. we can run review subagents on fable for limited high stakes work. A
note, self improvement are very important so we need that to be a part of the flow. And id like you to gather or create
skills and hooks designed to strengthen the workflow." Changed: the builder on Opus; high-stakes reviews only on the
review model (the skill `high-stakes-review`); a retrospective after every feature with measured changes (the skill
`feature-retro`); the delivery skills and hooks of this kit.

**The progress page (2026-11-16).** "build a living artifact document where i can see progress and remaining work.
visuals are very important". Changed: one page drawn from `features.json`, republished at each hourly check (not
included in this kit: it was made for one host's private pages).

**The hooks installed; roles are the team's to fill (2026-11-16).** "install them. And you can fill the roles out within
the team, it doesnt matter to me if you switch roles as long as all the roles are present." Changed: the installer
records the owner's words (`tools/install-hooks.mjs`); the lead assigns roles.

**A budget is set before the start and never extended (2026-11-17).** Asked, when the builder sized the first feature
above its budget, whether to split it or run one longer feature, the owner chose one longer feature. Changed: `feat.mjs
feature budget` exists for a planned feature only; in build a budget never changes.

**Hours the computer is off are left out (2026-11-17).** "yes, leave the off hours out of the budget". Changed: `feat.mjs
feature pause`, refused if a commit or a session turn falls in the window.

**A metrics dashboard (2026-11-18).** "build a dashboard that you update with each hourly check that shows metrics data
and visualises progress etc weekly". Changed: `tools/metrics.py`, which writes the numbers as one JSON file; the dashboard page that drew them is not included.

**Idle hours leave the clock too (2026-11-19).** "idle hours shouldn't count, pause the clock". Changed: `feature pause
--idle`, refused also if a job ran in the window.

**Time worked and total time shown apart (2026-11-19).** "Show time worked as one thing and total time as another."

**Unfinished work carried over with its checks unchanged; the browser in turns (2026-11-20).** On the lead's review of
the last day, asked whether the feature could close on time if some fixes moved to the next feature with their checks
unchanged, and whether a second browser for QA was acceptable if turns were not enough: "i accept both proposed
changes". Changed: `templates/carry-over.md`, taken in first by the next readiness review; the browser held at most 45
minutes while another run waits; a second headless browser for QA only when turns still leave the builder waiting.

**A readiness review before any start (2026-11-20).** Asked about narrowing the stage audit to the changed screens and a
play-through before shaping: "yeah, those changes are good to add. Something im reacting to is that so many new tasks
where found in flight. From my perspective, there should be an review and reasoning, evidence based desicions BEFORE
development starts, so the team is certain the road ahead is clear." Measured: 78% of the first feature's tasks were added
after its start. Changed: the readiness review's six parts (the skill `shape-feature`, step 5); the aim is under 30%.

**The readiness review is a page, and the team does not wait (2026-11-20).** "create the readiness review as an artifact
where you present and show the case. But do not wait for my approval. i can give feedback when i check the artifact, that
is OK. We will improve over time." Changed: the readiness file is published as a "Draft for direction" page; the feature
starts when every part has its answer.

**This kit (2026-11-20).** "create a new public github repo where you copy everything about our workflow here so i can use
it in different projects."
