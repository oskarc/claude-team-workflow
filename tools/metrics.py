"""The team's metrics for a dashboard page: weekly, daily and hourly cost by role, commits, tasks built, passed,
failed, added and cut, each feature against its budget, and the burnup.

Read-only: it reads the delivery record (<deliveryDir>/events.jsonl, features.json), the usage numbers
(<stateDir>/turns.json, written by tools/cost/scan-turns.py) and git's commit times, and writes one JSON file:

    python -I tools/cost/scan-turns.py <the project's transcripts folder> build/team/turns.json
    python -I tools/metrics.py [<out.json>]

The lead runs it at each hourly check and uploads the file to the dashboard (the owner: "build a dashboard that you
update with each hourly check that shows metrics data and visualises progress etc weekly"). Days and hours are this
computer's local time. Token units as tools/cost/window.py: input 1, cache write 1.25, cache read 0.1, output 5.
Settings from team-workflow.json at the project's root (tools/config.mjs): deliveryDir, stateDir, and roleOverrides
(a session id's first 8 characters to a role, for sessions that never joined the delivery list, such as design).
"""
import io
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta


def find_root():
    if os.environ.get('TEAM_WORKFLOW_ROOT'):
        return os.path.abspath(os.environ['TEAM_WORKFLOW_ROOT'])
    d = os.path.abspath(os.getcwd())
    while not os.path.exists(os.path.join(d, '.git')):
        if os.path.dirname(d) == d:
            return os.path.abspath(os.getcwd())
        d = os.path.dirname(d)
    return d


ROOT = find_root().replace(os.sep, '/')
try:
    CFG = json.load(io.open(ROOT + '/team-workflow.json', encoding='utf-8'))
except (OSError, ValueError):
    CFG = {}
DELIVERY = ROOT + '/' + CFG.get('deliveryDir', 'reports/delivery').strip('/')
STATE = ROOT + '/' + CFG.get('stateDir', 'build/team').strip('/')
OUT = sys.argv[1] if len(sys.argv) > 1 else STATE + '/metrics.json'
ROLES = ['builder', 'qa', 'lead', 'design', 'other']
EXTRA = dict(CFG.get('roleOverrides') or {})

units = lambda t: t['in'] + 1.25 * t['cw'] + 0.1 * t['cr'] + 5 * t['out']
iso = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone().replace(tzinfo=None)
day = lambda d: d.strftime('%Y-%m-%d')
week = lambda d: '%d-W%02d' % d.isocalendar()[:2]

events = [json.loads(l) for l in io.open(DELIVERY + '/events.jsonl', encoding='utf-8') if l.strip()]
view = json.load(io.open(DELIVERY + '/features.json', encoding='utf-8'))
turns = json.load(io.open(STATE + '/turns.json', encoding='utf-8'))

role_of = dict(EXTRA)
for e in events:
    if e['kind'] == 'join':
        role_of[e['session'][:8]] = e['role']
role = lambda sid: role_of.get(sid[:8], 'other')

# Every step with its time, units and role: a session's own steps and its helpers' steps count to that session.
steps = [(datetime.fromtimestamp(t['t']), units(t), role(sid)) for sid, tt in turns['main'].items() for t in tt]
steps += [(datetime.fromtimestamp(t['t']), units(t), role(s['session'])) for s in turns['sub'] for t in s['turns']]
first = min(s[0] for s in steps)
commits = [datetime.fromtimestamp(int(x)) for x in subprocess.run(
    ['git', '-C', ROOT, 'log', '--since=' + first.strftime('%Y-%m-%d'), '--format=%at'],
    capture_output=True, text=True).stdout.split()]
now = datetime.now()

KINDS = {'task.built': 'built', 'task.pass': 'passed', 'task.fail': 'failed', 'task.add': 'added', 'task.cut': 'cut'}


def buckets(key):
    b = defaultdict(lambda: dict({'units_' + r: 0.0 for r in ROLES}, steps=0, commits=0,
                                 **{k: 0 for k in KINDS.values()}))
    for t, u, r in steps:
        b[key(t)]['units_' + r] += u
        b[key(t)]['steps'] += 1
    for t in commits:
        b[key(t)]['commits'] += 1
    for e in events:
        if e['kind'] in KINDS:
            b[key(iso(e['at']))][KINDS[e['kind']]] += 1
    return b


def finish(row):
    for r in ROLES:
        row['units_' + r] = round(row['units_' + r] / 1e6, 3)   # millions of token units
    row['units'] = round(sum(row['units_' + r] for r in ROLES), 3)
    return row


bd = buckets(lambda t: day(t))
daily, d = [], first.replace(hour=0, minute=0, second=0, microsecond=0)
while d <= now:
    daily.append(finish(dict(date=day(d), week=week(d), weekday=d.strftime('%a'), **bd[day(d)])))
    d += timedelta(days=1)

# Weeks (ISO, Monday first): the days' rows summed, with the days counted.
weekly = []
for r in daily:
    if not weekly or weekly[-1]['week'] != r['week']:
        weekly.append(dict(week=r['week'], start=r['date'], days=0, **{k: 0 for k in r if k not in
                                                                         ('date', 'week', 'weekday')}))
    w = weekly[-1]
    w['days'] += 1
    for k, v in r.items():
        if k not in ('date', 'week', 'weekday'):
            w[k] = round(w[k] + v, 3)

hkey = lambda t: t.strftime('%Y-%m-%d %H:00')
bh = buckets(hkey)
hourly, h = [], (now - timedelta(hours=71)).replace(minute=0, second=0, microsecond=0)
while h <= now:
    hourly.append(finish(dict(hour=hkey(h), **bh[hkey(h)])))
    h += timedelta(hours=1)

# Tasks and the feature's burnup: work hours as feat.mjs counts them (from the start, less the pauses).
features, tasks, burnup = [], [], []
for f in view['features']:
    started = iso(f['started']) if f.get('started') else None
    pauses = [(iso(p['from']), iso(p['to'])) for p in f.get('pauses') or []]

    def work_h(t):
        if not started or t < started:
            return 0.0
        off = sum(max(0, (min(t, b) - a).total_seconds()) for a, b in pauses if a < t)
        return round(((t - started).total_seconds() - off) / 3600, 2)

    live = [t for t in f['tasks'] if t['state'] != 'cut']
    passed = [t for t in live if t['state'] == 'passed']
    features.append(dict(feature=f['id'], name=f['name'], state=f['state'], budget_h=f['budgetH'],
                         written=now.strftime('%Y-%m-%d %H:%M'),
                         used_h=work_h(iso(f['closed']) if f.get('closed') else now), tasks=len(live),
                         passed=len(passed), built=sum(t['state'] == 'built' for t in live),
                         open=sum(t['state'] == 'open' for t in live), cut=len(f['tasks']) - len(live),
                         fails=sum(t.get('fails', 0) for t in f['tasks']),
                         est_h=sum({'S': 2, 'M': 4, 'L': 8}.get(t.get('size'), 0) for t in live)))
    first_built, passed_at, added_at = {}, {}, {}
    for e in events:
        if e.get('feature') != f['id'] or 'task' not in e:
            continue
        if e['kind'] == 'task.add':
            added_at[e['task']] = e['at']
        if e['kind'] == 'task.built':
            first_built.setdefault(e['task'], e['at'])
        if e['kind'] == 'task.pass':
            passed_at[e['task']] = e['at']
    for t in f['tasks']:
        tid = t['id']
        tasks.append(dict(task=tid, feature=f['id'], kind=t.get('cat'), size=t.get('size'), state=t['state'],
                          fails=t.get('fails', 0), after_start=t.get('afterStart'),
                          added_h=work_h(iso(added_at[tid])) if tid in added_at else None,
                          built_h=work_h(iso(first_built[tid])) if tid in first_built else None,
                          passed_h=work_h(iso(passed_at[tid])) if tid in passed_at else None,
                          passed_on=day(iso(passed_at[tid])) if tid in passed_at else None,
                          desc=(t.get('desc') or '')[:140]))
    total, done = 0, 0
    for e in events:
        if e.get('feature') != f['id'] or e['kind'] not in ('task.add', 'task.cut', 'task.pass', 'feature.start'):
            continue
        total += {'task.add': 1, 'task.cut': -1}.get(e['kind'], 0)
        done += e['kind'] == 'task.pass'
        if started and iso(e['at']) >= started:
            burnup.append(dict(feature=f['id'], at=day(iso(e['at'])) + iso(e['at']).strftime(' %H:%M'),
                               work_h=work_h(iso(e['at'])), tasks=total, passed=done))
    burnup.append(dict(feature=f['id'], at=now.strftime('%Y-%m-%d %H:%M'), work_h=work_h(now), tasks=total,
                       passed=done))

out = dict(written=now.strftime('%Y-%m-%d %H:%M'), weekly=weekly, daily=daily, hourly=hourly, features=features, tasks=tasks,
           burnup=burnup)
io.open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('written %s: %d days, %d hours, %d tasks, %d burnup points' % (OUT, len(daily), len(hourly), len(tasks),
                                                                     len(burnup)))
