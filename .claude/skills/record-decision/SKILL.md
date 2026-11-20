---
name: record-decision
description: Write the owner's decision or answer into the right rule files in the owner's own words with the date, and the work inventory entry for the work it starts, all checked before anything is written and committed by path in one commit. Use in the same turn as any answer or decision of the owner's.
---

# Recording the owner's decision

CLAUDE.md: a new decision of the owner's is written into its area's rule file in the turn it is given, with the
owner's words and the date; the work it starts goes into the work inventory when it is received. Twice in one day in
the project this kit comes from, a script wrote one file and then failed on the next file's anchor (an anchor that was
not unique), leaving half a record committed. `tools/notes.py` checks everything before it writes anything.

## Steps
1. **Which files:** the area's rule file under `.claude/rules/` (CLAUDE.md's "Where each area is written"); a standard
   or spec too if the decision changes a rule's text or level (mark it with the owner's words and the date); CLAUDE.md
   only if every session must know it; the inventory entry it starts or closes.
2. **The text**, in plain words: what the owner was asked (the question as put, in quotes), what the owner answered
   (the words in quotes, the option picked), and what it means for the work. A rule-file entry is at most about 900
   bytes: the head with the date, the owner's words in quotes, what it decides. A longer account (what was built, the
   findings, every mark word for word) goes to the area's history file, `.claude/rule-history/<area>.md`, in the same
   plan, by an `end` operation, under the same head line. (notes.py warns about a longer entry into a rule file and
   writes it all the same.)
   An entry that replaces an earlier decision says so, and the earlier entry is changed in the same plan and commit:
   - if the new decision replaces everything the earlier one decides, the earlier entry is moved whole to the history
     file (a `move` operation, after the new entry is written; notes.py leaves a line "(moved to ...)" in its place);
   - if it replaces a part, the earlier entry stays and gets "(Replaced on <date> by ...)" after the replaced sentence
     (an `after` operation).
3. **Write all files in one plan** with `tools/notes.py`, which checks every anchor in every file (each must be found
   once) and refuses files with uncommitted changes, before writing any:
   ```
   python -I tools/notes.py <plan.json>
   ```
   ```json
   [{"file": ".claude/rules/ui.md", "end": true, "text": "- **...** (the owner, 2026-01-07). ...\n"},
    {"file": "reports/Work inventory.md", "after": "<unique text at the end of the entry>", "text": " **...**"},
    {"file": ".claude/rules/ui.md", "move_first": "<unique text in the earlier entry's head>",
     "move_last": "<unique text in its last line>", "to": ".claude/rule-history/ui.md",
     "note": "Replaced on <date> by the owner's answer on ..."}]
   ```
   For the inventory's long entries, pick an anchor that is the end of the last sentence written there and appears
   once. A file refused as having uncommitted changes holds someone's unfinished lines: find out whose before passing
   `--allow-dirty`.
4. **Commit by path** in one commit, then push if the project pushes:
   `git commit -m "Owner: <the decision in a line>; inventory: <what it starts>" -- <the files>`. When the plan wrote to
   a history file, that file is among the paths, with its rule file.
5. If a memory note covers the same ground (`MEMORY.md`), update it rather than adding a second.
