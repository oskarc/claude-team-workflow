"""What a stretch of time cost, session by session, from scan-turns.py's output (usage numbers only, no message text).

    python -I tools/cost/scan-turns.py <transcripts folder> <turns.json>
    python -I tools/cost/window.py <turns.json> <since, UTC, 2026-01-12T01:15:00> [<until>] [--json out.json]

Token units: input 1, cache write 1.25, cache read 0.1, output 5. A session's own steps and its helpers' runs are given
apart. "Mean context" is the mean size of what each step read (input + cache write + cache read).
"""
import io
import json
import sys
from datetime import datetime, timezone

args = [a for a in sys.argv[1:] if not a.startswith('--')]
out = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
if out in args:
    args.remove(out)
r = json.load(io.open(args[0], encoding='utf-8'))
stamp = lambda s: datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp()
since = stamp(args[1])
until = stamp(args[2]) if len(args) > 2 else 9e12
units = lambda t: t['in'] + 1.25 * t['cw'] + 0.1 * t['cr'] + 5 * t['out']
ctx = lambda t: t['in'] + t['cw'] + t['cr']
inside = lambda turns: [t for t in turns if since <= t['t'] < until]

rows = {}
for sid, turns in r['main'].items():
    tt = inside(turns)
    if tt:
        rows[sid] = {'session': sid, 'steps': len(tt), 'units': sum(map(units, tt)), 'mean_context': sum(map(ctx, tt)) / len(tt),
                     'model': max(set(t.get('model') for t in tt), key=[t.get('model') for t in tt].count), 'helper_runs': 0, 'helper_steps': 0, 'helper_units': 0.0}
for sub in r['sub']:
    tt = inside(sub['turns'])
    if not tt:
        continue
    row = rows.setdefault(sub['session'], {'session': sub['session'], 'steps': 0, 'units': 0.0, 'mean_context': 0, 'model': None, 'helper_runs': 0, 'helper_steps': 0, 'helper_units': 0.0})
    row['helper_runs'] += 1
    row['helper_steps'] += len(tt)
    row['helper_units'] += sum(map(units, tt))
table = sorted(rows.values(), key=lambda x: -(x['units'] + x['helper_units']))
total = sum(x['units'] + x['helper_units'] for x in table)
print(f"{'session':10s} {'model':18s} {'steps':>6s} {'own, M':>8s} {'mean ctx':>9s} {'helpers':>8s} {'their, M':>9s} {'sum, M':>8s}")
for x in table:
    print(f"{x['session']:10s} {str(x['model'] or '')[:18]:18s} {x['steps']:6d} {x['units'] / 1e6:8.2f} {x['mean_context'] / 1000:8.0f}k {x['helper_runs']:8d} {x['helper_units'] / 1e6:9.2f} {(x['units'] + x['helper_units']) / 1e6:8.2f}")
print(f"all: {total / 1e6:.2f} M token units in {sum(x['steps'] + x['helper_steps'] for x in table)} steps; helpers {sum(x['helper_units'] for x in table) / 1e6:.2f} M of it")
if out:
    json.dump({'since': args[1], 'until': args[2] if len(args) > 2 else None, 'total_units': total, 'sessions': table}, io.open(out, 'w', encoding='utf-8'), indent=1)
