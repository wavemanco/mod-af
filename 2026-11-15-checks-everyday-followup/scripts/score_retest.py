"""Score the retest after the JAR-004 fix: part 3's verdicts carried over by text and item, the re-judged and new
findings' verdicts from j05-retest-judge/. Usage: python3 -I score_retest.py <study dir>. Writes retest-results.json."""
import json, re, sys
from collections import Counter
from pathlib import Path
D = Path(sys.argv[1])
before = json.loads((D / 'j05-findings.json').read_text()); after = json.loads((D / 'j05-findings-after-fix.json').read_text())
rows = json.loads((D / 'results.json').read_text())['part3']['rows']
old = {}
for fid in before:
    for f, r in zip(before[fid], [r for r in rows if r['text'] == fid]): old[(fid, f['term'])] = r['verdict']
rej = {}
for fid, fs in json.loads((D / 'j05-retest-tojudge.json').read_text()).items():
    for f, it in zip(fs, json.loads((D / 'j05-retest-judge' / f'{fid}.json').read_text())['parsed']['items']): rej[(fid, f['term'])] = it['verdict']
out = []
for fid, fs in after.items():
    for f in fs:
        m = re.search(r'is in the original (\d+) times .*?, but (not at all|once|\d+ times) in the rewrite', f['message'])
        kind = 'one use, gone' if not m else ('several uses, none left' if m.group(2) == 'not at all' else 'several uses, still there')
        out.append({'text': fid, 'term': f['term'], 'kind': kind, 'verdict': rej.get((fid, f['term'])) or old[(fid, f['term'])], 'rejudged': (fid, f['term']) in rej})
bt = {(fid, f['term']) for fid in before for f in before[fid]}; at = {(r['text'], r['term']) for r in out}
res = {'findings': len(out), 'verdicts': dict(Counter(r['verdict'] for r in out)),
       'by_kind': {k: dict(Counter(r['verdict'] for r in out if r['kind'] == k)) for k in sorted({r['kind'] for r in out})},
       'gone': [{'text': f, 'term': t, 'verdict_before': old[(f, t)]} for f, t in sorted(bt - at)],
       'new': sorted([list(x) for x in at - bt]), 'rows': out}
(D / 'retest-results.json').write_text(json.dumps(res, indent=1))
print({k: v for k, v in res.items() if k != 'rows'})
