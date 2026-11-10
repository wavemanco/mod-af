"""Score the checker's findings against the reader judge, and apply the plan's decision rule.
Usage: python3 -I score.py <study dir>. Writes results.json."""
import json, re, sys
from collections import Counter
from pathlib import Path
D = Path(sys.argv[1])
TEXTS = {'f1': 'f1.md', 'f2': 'f2.md', 'f3': 'f3.md', 'f4': 'f4.md', 'f5': 'f5.txt'}
F = json.loads((D / 'findings.json').read_text())
rows, unknown, cost, tok = [], {}, 0.0, Counter()
for fid, name in TEXTS.items():
    ju = json.loads((D / f'judge/{fid}-unknown.json').read_text())
    jf = json.loads((D / f'judge/{fid}-findings.json').read_text())
    for d in (ju, jf):
        for t in d['tries']:
            cost += t.get('total_cost_usd') or 0
            for k, v in (t.get('usage') or {}).items():
                if isinstance(v, int): tok[k] += v
    unknown[fid] = ju['parsed']['terms']
    answers = jf['parsed']['items']
    for n, (f, a) in enumerate(zip(F[name], answers), 1):
        assert a.get('n') in (n, None), (fid, n, a)
        if f['code'] == 'J07':
            true = a.get('fits') is True
            rows.append({'text': fid, 'code': 'J07', 'term': f['term'], 'suggestion': f.get('suggestion'), 'true': true,
                         'changes_meaning': a.get('changes_meaning') is True})
        else:
            true = a.get('understand') is False
            rows.append({'text': fid, 'code': f['code'], 'term': f['term'], 'true': true, 'kind': None if true else a.get('kind')})

def norm(s): return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()
def caught(term, fid):
    t = norm(term)
    for r in rows:
        if r['text'] == fid and r['code'] in ('J01', 'J04'):
            f = norm(r['term'])
            if f and (f == t or re.search(rf'\b{re.escape(f)}\b', t) or re.search(rf'\b{re.escape(t)}\b', f)): return True
    return False

out = {'checks': {}, 'unknown_terms': {}, 'cost_usd': round(cost, 4), 'tokens': dict(tok)}
for code in ('J01', 'J04', 'J07'):
    rs = [r for r in rows if r['code'] == code]
    t = sum(r['true'] for r in rs)
    c = {'findings': len(rs), 'true': t, 'false_alarms': len(rs) - t,
         'false_alarm_share': round((len(rs) - t) / len(rs), 3) if rs else None,
         'by_text': {fid: [sum(1 for r in rs if r['text'] == fid), sum(1 for r in rs if r['text'] == fid and r['true'])] for fid in TEXTS}}
    if code == 'J07':
        c['changes_meaning'] = sum(r['changes_meaning'] for r in rs)
        if len(rs) < 5: c['decision'] = 'not enough findings'
        else: c['decision'] = 'keep' if t / len(rs) >= 0.5 and c['changes_meaning'] / len(rs) <= 0.1 else 'drop'
    else:
        c['false_alarms_by_kind'] = dict(Counter(r['kind'] for r in rs if not r['true']))
        if len(rs) < 5: c['decision'] = 'not enough findings'
        else: c['decision'] = 'keep as an optional hint for everyday audiences' if t / len(rs) >= 0.5 else 'drop'
    out['checks'][code] = c
tot = sum(len(v) for v in unknown.values()); hit = sum(caught(u, fid) for fid, v in unknown.items() for u in v)
out['unknown_terms'] = {'listed_by_reader': tot, 'flagged_by_J01_or_J04': hit,
                        'by_text': {fid: [len(v), sum(caught(u, fid) for u in v)] for fid, v in unknown.items()},
                        'missed': {fid: [u for u in v if not caught(u, fid)] for fid, v in unknown.items()}}
out['rows'] = rows
(D / 'results.json').write_text(json.dumps(out, indent=1))
for code, c in out['checks'].items():
    print(code, {k: v for k, v in c.items() if k != 'by_text'})
print('unknown terms', tot, 'flagged by J01/J04', hit, '| cost $', out['cost_usd'])
for r in rows: print(r['text'], r['code'], r['term'], 'TRUE' if r['true'] else 'false:' + str(r.get('kind') or ('changes meaning' if r.get('changes_meaning') else 'no fit')))
