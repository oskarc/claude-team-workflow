"""Per turn of every session of a project (and its helpers): the time, the context's size, cache write and read,
output, and counts of a few kinds of tool call. It reads the usage numbers only; no message text is kept.

    python -I tools/cost/scan-turns.py <the project's transcripts folder> <out.json>

The transcripts folder is ~/.claude/projects/<the project's path, every character that is not a letter or a digit
turned into '-'>. Its output is read by tools/cost/window.py and tools/metrics.py.
"""
import io
import json
import os
import re
import sys
from datetime import datetime

root, out = sys.argv[1], sys.argv[2]
# a command that only watches or waits: the job list asked, a sleep as a command of its own, a log or output file read
# directly (not another command's output trimmed through `| tail`), the processes listed
WATCH = re.compile(r'jobs\.mjs\s+(list|wait)|(^|[;&]\s*)sleep\s+\d|(^|[;&]\s*)(tail|cat|head)\b[^|;&]*\.(log|out|output)\b|Get-Content\b[^|;]*-Tail|(^|[;&]\s*)(tasklist|Get-Process|Get-CimInstance\s+Win32_Process)\b')
JOBS = re.compile(r'node\s+tools/jobs\.mjs\s+(list|wait)(\s+[\w.-]+)?')
WORK = re.compile(r'\b(node|python|npm|npx|git|cp|mv|rm|mkdir|curl)\b')
# Reads of the large shared notes, counted per turn (a file read again and again is a cost worth seeing); add your own.
BIG = [('inventory', 'Work inventory.md'), ('rules', '.claude/rules/'), ('claudemd', 'CLAUDE.md')]
IMG = re.compile(r'\.(png|jpg|jpeg|webp)$', re.I)


def epoch(ts):
    try:
        return datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp()
    except Exception:
        return 0


def scan(path):
    turns = {}
    with io.open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '"type":"assistant"' not in line or '"usage"' not in line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            m = d.get('message') or {}
            u = m.get('usage') or {}
            mid = m.get('id') or d.get('uuid')
            t = turns.get(mid)
            if not t:
                t = turns[mid] = {'t': epoch(d.get('timestamp') or ''), 'in': u.get('input_tokens') or 0, 'cw': u.get('cache_creation_input_tokens') or 0,
                                  'cr': u.get('cache_read_input_tokens') or 0, 'out': 0, 'tools': 0, 'watch': 0, 'img': 0, 'big': {}, 'model': m.get('model') or '?'}
            t['out'] = max(t['out'], u.get('output_tokens') or 0)
            for c in (m.get('content') or []):
                if not isinstance(c, dict) or c.get('type') != 'tool_use':
                    continue
                t['tools'] += 1
                inp = c.get('input') or {}
                if c.get('name') in ('Bash', 'PowerShell'):
                    cmd = str(inp.get('command') or '')[:800]
                    if WATCH.search(cmd) and not WORK.search(JOBS.sub('', cmd)):
                        t['watch'] += 1
                elif c.get('name') == 'Read':
                    p = str(inp.get('file_path') or '').replace('\\', '/')
                    if IMG.search(p):
                        t['img'] += 1
                    for k, frag in BIG:
                        if frag in p:
                            t['big'][k] = t['big'].get(k, 0) + 1
    return sorted(turns.values(), key=lambda x: x['t'])


res = {'main': {}, 'sub': []}
files = sorted(f for f in os.listdir(root) if f.endswith('.jsonl'))
for i, f in enumerate(files):
    sid = f[:-6]
    res['main'][sid[:8]] = scan(os.path.join(root, f))
    sd = os.path.join(root, sid, 'subagents')
    if os.path.isdir(sd):
        for g in sorted(os.listdir(sd)):
            if g.endswith('.jsonl'):
                res['sub'].append({'session': sid[:8], 'turns': scan(os.path.join(sd, g))})
    print(i + 1, len(files), flush=True)
json.dump(res, io.open(out, 'w', encoding='utf-8'))
print('written', out)
