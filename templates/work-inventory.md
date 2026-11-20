# Work inventory

What is in hand right now, piece by piece, with who has it and where its files are, so the work can be picked up again
if the sessions are lost. **Written when the work is received, not when it is done:** an entry is added the moment work
is asked for or handed over, with who has it and what was asked, and changed when it lands, stops or changes hands.
Written through `python -I tools/notes.py <plan.json>` (the skill `record-decision`), committed by path.

Features and their tasks are on the delivery list (`node tools/feat.mjs status`); this file holds everything else in
hand (research, tools, reviews, the owner's side requests) and one line per feature pointing at the list.

## In hand

### (1) <A short name> - <who has it: role or session>, <model / effort>
Asked <date> by <the owner / the lead>: "<the words>". Files: <paths>. State: <where it stands>, <time as printed>.

## Landed
- (n) <name> - landed <date>, commit <sha>.

## Stopped
- (n) <name> - stopped <date>: <why>.
