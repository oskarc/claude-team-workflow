"""The test of tools/metrics.py: python -I tools/metrics_selftest.py
Makes a made-up project (a git repository, a delivery record of one feature with two tasks, and usage numbers for two
sessions) and checks the JSON metrics.py writes: the roles' cost, the tasks, the feature against its budget, the burnup."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

METRICS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'metrics.py')
root = tempfile.mkdtemp(prefix='metrics-test-')
held = failed = 0


def expect(name, ok, detail=''):
    global held, failed
    held, failed = (held + 1, failed) if ok else (held, failed + 1)
    if not ok:
        print(f'FAIL {name} {detail}')


def at(h):
    return time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(time.time() + h * 3600))


subprocess.run(['git', 'init', '-q', '-b', 'main'], cwd=root)
os.makedirs(os.path.join(root, 'docs', 'delivery'))
os.makedirs(os.path.join(root, 'build', 'team'))
json.dump({'deliveryDir': 'docs/delivery', 'roleOverrides': {'dddd0000': 'design'}}, open(os.path.join(root, 'team-workflow.json'), 'w'))
events = [
    {'kind': 'join', 'role': 'builder', 'session': 'bbbb0000-x', 'at': at(-5)},
    {'kind': 'feature.add', 'feature': 'F01', 'at': at(-5)},
    {'kind': 'task.add', 'feature': 'F01', 'task': 'F01-T1', 'at': at(-5)},
    {'kind': 'task.add', 'feature': 'F01', 'task': 'F01-T2', 'at': at(-5)},
    {'kind': 'feature.start', 'feature': 'F01', 'at': at(-4)},
    {'kind': 'task.built', 'feature': 'F01', 'task': 'F01-T1', 'at': at(-3)},
    {'kind': 'task.pass', 'feature': 'F01', 'task': 'F01-T1', 'at': at(-2)},
]
open(os.path.join(root, 'docs', 'delivery', 'events.jsonl'), 'w').write(''.join(json.dumps(e) + '\n' for e in events))
json.dump({'features': [{'id': 'F01', 'name': 'Export a report', 'state': 'building', 'budgetH': 8, 'started': at(-4), 'closed': None,
                         'pauses': [{'from': at(-3.5), 'to': at(-2.5)}],
                         'tasks': [{'id': 'F01-T1', 'state': 'passed', 'size': 'S', 'cat': 'feature', 'desc': 'the export button'},
                                   {'id': 'F01-T2', 'state': 'open', 'size': 'M', 'cat': 'ui', 'desc': 'the saved file is named'}]}]},
          open(os.path.join(root, 'docs', 'delivery', 'features.json'), 'w'))
turn = lambda h, n: {'t': time.time() + h * 3600, 'in': n, 'cw': 0, 'cr': 0, 'out': 0}
json.dump({'main': {'bbbb0000': [turn(-3, 1_000_000)], 'dddd0000': [turn(-1, 500_000)]}, 'sub': [{'session': 'bbbb0000', 'turns': [turn(-2, 250_000)]}]},
          open(os.path.join(root, 'build', 'team', 'turns.json'), 'w'))

r = subprocess.run([sys.executable, '-I', METRICS], cwd=root, capture_output=True, text=True,
                   env={**os.environ, 'TEAM_WORKFLOW_ROOT': root})
expect('it runs', r.returncode == 0 and 'written' in r.stdout, r.stdout + r.stderr)
try:
    m = json.load(open(os.path.join(root, 'build', 'team', 'metrics.json'), encoding='utf-8'))
except (OSError, ValueError) as e:
    m = {}
    expect('it writes the file', False, str(e))
day = m.get('daily', [{}])[-1] if m.get('daily') else {}
expect('the builder and its helper count to the builder', round(sum(d['units_builder'] for d in m.get('daily', [])), 3) == 1.25, json.dumps(m.get('daily'))[:300])
expect('roleOverrides names the design session', round(sum(d['units_design'] for d in m.get('daily', [])), 3) == 0.5)
f = (m.get('features') or [{}])[0]
expect('the feature: tasks and passes', f.get('tasks') == 2 and f.get('passed') == 1 and f.get('open') == 1, f)
expect('the feature: the pause is left out', 2.9 <= f.get('used_h', 0) <= 3.1, f.get('used_h'))
expect('the feature: the estimate from the sizes', f.get('est_h') == 6, f.get('est_h'))
expect('the tasks', [t['task'] for t in m.get('tasks', [])] == ['F01-T1', 'F01-T2'])
expect('the burnup ends with one of two passed', m.get('burnup', [{}])[-1].get('passed') == 1 and m['burnup'][-1].get('tasks') == 2, m.get('burnup'))
shutil.rmtree(root, ignore_errors=True)
print(f'{held} held, {failed} failed')
sys.exit(1 if failed else 0)
