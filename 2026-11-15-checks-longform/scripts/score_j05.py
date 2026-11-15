"""Score J05 on the long-form rewrites. Usage: python3 -I score_j05.py <work dir> <study dir>.
Writes j05-results.json: each finding's item, line, kind and verdict (no quotations), and the totals."""
import json, re, sys
from collections import Counter
from pathlib import Path
W, D = Path(sys.argv[1]), Path(sys.argv[2])
F = json.loads((W / 'j05-findings.json').read_text()); rows, cost = [], 0.0
for n, fs in F.items():
    for t in json.loads((W / 'rewrites' / f'{n}.call.json').read_text())['tries']: cost += t.get('total_cost_usd') or 0
    if not fs: continue
    j = json.loads((W / 'j05-judge' / f'{n}.json').read_text())
    for t in j['tries']: cost += t.get('total_cost_usd') or 0
    for f, it in zip(fs, j['parsed']['items']):
        m = re.search(r'is in the original (\d+) times .*?, but (not at all|once|\d+ times) in the rewrite', f['message'])
        kind = 'one use, gone' if not m else ('several uses, none left' if m.group(2) == 'not at all' else 'several uses, still there')
        rows.append({'text': n, 'term': f['term'], 'line': f['line'], 'kind': kind, 'verdict': it.get('verdict')})
res = {'findings': len(rows), 'verdicts': dict(Counter(r['verdict'] for r in rows)),
       'by_kind': {k: dict(Counter(r['verdict'] for r in rows if r['kind'] == k)) for k in sorted({r['kind'] for r in rows})},
       'by_text': {n: len(v) for n, v in F.items()},
       'rewrite_words': {n: len((W / 'rewrites' / f'{n}.md').read_text().split()) for n in F},
       'cost_usd': round(cost, 4), 'rows': rows}
(D / 'j05-results.json').write_text(json.dumps(res, indent=1))
print({k: v for k, v in res.items() if k != 'rows'})
for r in rows: print(' ', r)
