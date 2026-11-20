"""Write notes into the shared text files (the work inventory, the rule files, their history) safely: every anchor is
checked in every file BEFORE any file is written, an anchor must be found exactly once, and a file with uncommitted
changes (another session's unfinished lines, perhaps) is refused. Used by the skill record-decision. It was made after
two writes were left half-done: a script wrote one file and then failed on the next file's anchor.

    python -I tools/notes.py plan.json [--allow-dirty] [--root <project root>]

plan.json is a list of operations, checked all together and then applied in order:
    {"file": "reports/Work inventory.md", "after": "<unique text>", "text": " **(14) ...**"}
    {"file": ".claude/rules/design.md", "end": true, "text": "- **...** (the owner, 2026-01-07). ...\\n"}
    {"file": ".claude/rules/design.md", "move_first": "<unique text in the entry's first line>",
     "move_last": "<unique text in its last line>", "to": ".claude/rule-history/design.md",
     "note": "Replaced on 2026-01-14 by the owner's answer on ..."}

"after" inserts the text right after the anchor. "end" appends it at the end of the file (after one newline).
"move" takes the whole lines from the line holding move_first to the line holding move_last, and the blank lines after
them, out of the file; puts one line in their place, "- (moved to <to> on <today>: <note>)"; and appends them to "to"
after one line "Moved here on <today>: <note>". The history file is made if it does not exist.

Refused before anything is written: an anchor not found once (in the file as the earlier operations leave it); a move
whose last line comes before its first; a file outside the root; a file with uncommitted changes (git status), unless
--allow-dirty is given. A new text of more than 900 bytes into a rule file (.claude/rules/) is written all the same,
with a warning: rule files are read into every session that touches their area, so a long entry belongs in the history
file with a short one in its place.

It prints the files changed; commit them by path yourself: git commit -m "..." -- <those paths>.
Its test: python -I tools/notes_selftest.py
"""
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile

LONG_ENTRY = 900
ENV = {k: v for k, v in os.environ.items() if k.upper() not in ('GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE')}


class Refusal(Exception):
    pass


def find_root(start):
    d = os.path.abspath(start)
    while True:
        if os.path.exists(os.path.join(d, '.git')):
            return d
        up = os.path.dirname(d)
        if up == d:
            return os.path.abspath(start)
        d = up


def once(text, anchor, where):
    if not isinstance(anchor, str) or not anchor:
        raise Refusal(f'{where}: the anchor is missing')
    n = text.count(anchor)
    if n != 1:
        raise Refusal(f'{where}: the anchor {anchor[:60]!r} is found {n} times; it must be found once')
    return text.index(anchor)


def line_span(text, pos):
    """The start of the line holding pos, and the end of that line (after its newline)."""
    start = text.rfind('\n', 0, pos) + 1
    end = text.find('\n', pos)
    return start, (len(text) if end < 0 else end + 1)


def dirty(root, paths):
    if not os.path.exists(os.path.join(root, '.git')):
        return []
    r = subprocess.run(['git', 'status', '--porcelain', '--', *paths], cwd=root, capture_output=True, text=True, env=ENV)
    if r.returncode != 0:
        raise Refusal(f'git status could not be read: {r.stderr.strip()}')
    return [ln[3:] for ln in r.stdout.splitlines() if ln.strip() and not ln.startswith('??')]


def plan_files(root, ops, allow_dirty, today):
    texts, warnings = {}, []

    def load(f):
        full = os.path.abspath(os.path.join(root, f))
        if not full.startswith(os.path.abspath(root) + os.sep):
            raise Refusal(f'{f} is outside the project root')
        if full not in texts:
            texts[full] = open(full, encoding='utf-8', newline='').read() if os.path.exists(full) else None
        return full

    for i, op in enumerate(ops, 1):
        where = f'operation {i} ({op.get("file")})'
        if not isinstance(op, dict) or not op.get('file'):
            raise Refusal(f'operation {i} has no "file"')
        full = load(op['file'])
        text = texts[full]
        is_rule = op['file'].replace('\\', '/').startswith('.claude/rules/')
        if 'after' in op or op.get('end'):
            new = op.get('text')
            if not isinstance(new, str) or not new:
                raise Refusal(f'{where}: "text" is missing')
            if is_rule and len(new.encode('utf-8')) > LONG_ENTRY:
                warnings.append(f'warning: {where} writes {len(new.encode("utf-8"))} bytes into a rule file; '
                                f'over {LONG_ENTRY}, keep the whole in its history file and a short entry here')
            if 'after' in op:
                if text is None:
                    raise Refusal(f'{where}: the file does not exist')
                p = once(text, op['after'], where) + len(op['after'])
                texts[full] = text[:p] + new + text[p:]
            else:
                text = text or ''
                texts[full] = text + ('' if not text or text.endswith('\n') else '\n') + new
        elif 'move_first' in op:
            if text is None:
                raise Refusal(f'{where}: the file does not exist')
            if not op.get('to') or not op.get('note'):
                raise Refusal(f'{where}: a move needs "to" and "note"')
            a = line_span(text, once(text, op['move_first'], where))[0]
            b = line_span(text, once(text, op['move_last'], where))[1]
            if b <= a:
                raise Refusal(f'{where}: move_last comes before move_first')
            while b < len(text) and text[b] == '\n':
                b += 1
            moved = text[a:b].rstrip('\n') + '\n'
            texts[full] = text[:a] + f'- (moved to {op["to"]} on {today}: {op["note"]})\n\n' + text[b:]
            dest = load(op['to'])
            d = texts[dest] or ''
            texts[dest] = d + ('' if not d or d.endswith('\n') else '\n') + f'\nMoved here on {today}: {op["note"]}\n' + moved
        else:
            raise Refusal(f'{where}: an operation is "after", "end" or "move_first"')

    changed = [f for f in texts if texts[f] is not None]
    if not allow_dirty:
        rels = [os.path.relpath(f, root).replace('\\', '/') for f in changed if os.path.exists(f)]
        d = dirty(root, rels) if rels else []
        if d:
            raise Refusal('uncommitted changes in ' + ', '.join(d) + ': commit or look at them first '
                          '(they may be another session\'s), or give --allow-dirty')
    return texts, warnings


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    allow = '--allow-dirty' in argv
    root = None
    if '--root' in argv:
        root = argv[argv.index('--root') + 1]
        args = [a for a in args if a != root]
    if len(args) != 1:
        print(__doc__)
        return 2
    root = os.path.abspath(root or find_root(os.getcwd()))
    try:
        ops = json.load(open(args[0], encoding='utf-8'))
        if not isinstance(ops, list) or not ops:
            raise Refusal('the plan is a list of one or more operations')
        texts, warnings = plan_files(root, ops, allow, datetime.date.today().isoformat())
    except Refusal as e:
        print(f'refused, nothing written: {e}')
        return 2
    for full, text in texts.items():
        if text is None:
            continue
        os.makedirs(os.path.dirname(full), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(full))
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
            f.write(text)
        os.replace(tmp, full)
    for w in warnings:
        print(w)
    print('written: ' + ', '.join(os.path.relpath(f, root).replace('\\', '/') for f, t in texts.items() if t is not None))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
