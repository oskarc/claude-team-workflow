---
name: feature-retro
description: The team's self-improvement step - after every finished or stopped feature, the delivery lead compares budget with time used and tasks planned with tasks added, cut and failed, asks each session for its three lines, measures the changes the last retrospective made, and makes one or two new changes to a skill, a hook, a tool or a rule, each with how it will be measured. The next feature cannot start until it is recorded. Use when a feature is done or stopped.
---

# The retrospective after a feature

The owner: "self improvement are very important so we need that to be a part of the flow." The list enforces it:
`feat.mjs start` is refused while a closed feature has no retrospective, and a retrospective is refused until every
change the last one made has its result.

## Steps
1. **The numbers**, from `node tools/feat.mjs status` and `<deliveryDir>/features.json` (no estimates): budget against
   hours used; tasks at the start, added after (each one a miss of the readiness review: name the part that should have
   found it), cut; QA's fails per task and why; hours from built to passed; the owner's answer at the look. Plus the
   cost per feature if measured (`tools/cost/`, `tools/metrics.py`).
2. **The sessions' three lines:** ask the builder, QA and design each for: what slowed this feature most, with an
   example; what helped most; one change they would make. Under 80 words each.
3. **The changes being tried** (from the last retrospective): for each, what its measure shows now, and kept, dropped
   or changed. Measured on this feature's numbers, not felt.
4. **One or two changes**, no more, each aimed at the biggest slowdown found in 1 and 2, each one of:
   - a skill's step (`.claude/skills/<name>/SKILL.md`), a hook's note (`tools/hook.mjs`), a check in `feat.mjs`, a gate
     in a tool, or a rule-file line;
   - with how it is measured on the next feature (a count or a time from the list: "QA fails for text cut at the
     smallest target size: 0", "hours from built to passed under 4").
   A change the owner must decide (a rule of the owner's, a role, a model) is asked in chat, high level, not made.
5. **Write the report** to `<deliveryDir>/retro/<feature> <name>.md` (`templates/retro.md`: the numbers, the three
   lines, the results, the changes and their measures; under 400 words), make the changes, commit by path, then record
   it:
   ```
   node tools/feat.mjs retro F03 --file "<deliveryDir>/retro/F03 ....md" \
     --change "what changes | how it is measured" [--change "..."] [--result I2=kept:"what was seen"]...
   ```
   Whatever was not finished goes into `<deliveryDir>/carry-over.md` (`templates/carry-over.md`), task by task, ready to
   be taken in first by the next feature's readiness review.
6. **Tell the owner** in the day's note: the feature's end, budget against used, the changes and why. One paragraph.
