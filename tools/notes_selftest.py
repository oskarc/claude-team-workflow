"""The test of tools/notes.py: python -I tools/notes_selftest.py
Makes a made-up project in a temporary folder (a git repository with two committed files) and checks that each
operation writes what it should, that every refusal leaves every file as it was, and that uncommitted changes refuse."""
import json
import os
import shutil
import subprocess
import sys
import tempfile

NOTES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'notes.py')
held = failed = 0
root = tempfile.mkdtemp(prefix='notes-test-')
git = lambda *a: subprocess.run(['git', *a], cwd=root, capture_output=True, text=True)


def write(rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8', newline='').write(text)


def read(rel):
    p = os.path.join(root, rel)
    return open(p, encoding='utf-8', newline='').read() if os.path.exists(p) else None


def run(ops, *extra):
    plan = os.path.join(root, '..', os.path.basename(root) + '-plan.json')
    json.dump(ops, open(plan, 'w', encoding='utf-8'))
    r = subprocess.run([sys.executable, '-I', NOTES, plan, '--root', root, *extra], capture_output=True, text=True)
    os.remove(plan)
    return r.returncode, r.stdout + r.stderr


def expect(name, ok, detail=''):
    global held, failed
    if ok:
        held += 1
    else:
        failed += 1
        print(f'FAIL {name} {detail}')


INV = 'reports/Work inventory.md'
RULE = '.claude/rules/area.md'
write(INV, '# Work inventory\n\n## In hand\n\n- (1) the user exports a report: builder.\n')
write(RULE, '# Area\n\n- **Old rule** (the owner, 2026-01-02). Reports are exported as text.\n  Its second line.\n\n- **Kept rule**. Stays.\n')
git('init', '-q', '-b', 'main')
git('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.')
git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'start')
commit = lambda: (git('add', '.'), git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x'))

before = (read(INV), read(RULE))
code, out = run([{'file': INV, 'after': '## In hand\n\n', 'text': '- (2) the user prints a report: qa.\n'},
                 {'file': RULE, 'after': 'not there', 'text': 'x'}])
expect('a missing anchor refuses all', code == 2 and 'found 0 times' in out and (read(INV), read(RULE)) == before, out)
code, out = run([{'file': RULE, 'after': 'rule', 'text': 'x'}])
expect('an anchor found twice refuses', code == 2 and 'found 2 times' in out, out)
code, out = run([{'file': '../outside.md', 'end': True, 'text': 'x'}])
expect('a file outside the root refuses', code == 2 and 'outside' in out, out)

code, out = run([{'file': INV, 'after': '## In hand\n\n', 'text': '- (2) the user prints a report: qa.\n'},
                 {'file': RULE, 'end': True, 'text': '- **New rule** (the owner, 2026-01-09). Reports are exported as files.\n'}])
expect('after and end write both files', code == 0 and '(2) the user prints' in read(INV) and read(RULE).endswith('as files.\n'), out)
expect('after puts the text right after the anchor', read(INV).index('(2)') < read(INV).index('(1)'))

code, out = run([{'file': INV, 'end': True, 'text': 'x'}])
expect('uncommitted changes refuse', code == 2 and 'uncommitted' in out, out)
code, out = run([{'file': INV, 'end': True, 'text': '- (3) more.\n'}], '--allow-dirty')
expect('--allow-dirty lets it through', code == 0 and read(INV).endswith('- (3) more.\n'), out)
commit()

code, out = run([{'file': RULE, 'move_first': 'Old rule', 'move_last': 'Its second line', 'to': '.claude/rule-history/area.md',
                  'note': 'replaced by the new rule'}])
hist = read('.claude/rule-history/area.md') or ''
expect('move takes the whole entry out', code == 0 and 'Old rule' not in read(RULE) and 'Its second line' not in read(RULE), out)
expect('move leaves a pointer', '- (moved to .claude/rule-history/area.md on ' in read(RULE))
expect('move keeps the other entries', 'Kept rule' in read(RULE) and 'New rule' in read(RULE))
expect('move appends to the history', 'Moved here on ' in hist and 'Old rule' in hist and 'Its second line' in hist, hist)
commit()

code, out = run([{'file': RULE, 'move_first': 'Stays', 'move_last': 'Kept rule', 'to': 'h.md', 'note': 'n'}])
expect('a move on one line is fine', code == 0, out)
commit()
write(RULE, read(RULE) + '- **A** first.\n- **B** last.\n')
commit()
code, out = run([{'file': RULE, 'move_first': 'B** last', 'move_last': 'A** first', 'to': 'h.md', 'note': 'n'}])
expect('a move whose last line comes first refuses', code == 2 and 'before' in out, out)
code, out = run([{'file': RULE, 'end': True, 'text': '- ' + 'x' * 1000 + '\n'}])
expect('a long rule entry is written with a warning', code == 0 and 'warning' in out, out)
code, out = run([{'file': RULE, 'sideways': True}])
expect('an unknown operation refuses', code == 2, out)

shutil.rmtree(root, ignore_errors=True)
print(f'{held} held, {failed} failed')
sys.exit(1 if failed else 0)
