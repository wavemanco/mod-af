"""Score the long-form judging and apply the plan's rules. Usage: python3 -I score.py <judge out dir> <study dir>.
Writes verdicts.json (the parsed verdicts and the reader's explanations, no article text) and results.json."""
import json, sys
from collections import Counter
from pathlib import Path
JD, D = Path(sys.argv[1]), Path(sys.argv[2])
F = json.loads((D / 'findings.json').read_text())
rows, swaps, cost = [], [], 0.0
for name in sorted(F):
    j = json.loads((JD / f'{name}.json').read_text())
    for part in j.values():
        for t in part['tries']: cost += t.get('total_cost_usd') or 0
    terms = [f for f in F[name] if f['code'] in ('J01', 'J04')]
    if terms:
        for f, e, v in zip(terms, j['explain']['parsed']['items'], j['verify']['parsed']['items']):
            rows.append({'text': name[:-3], 'code': f['code'], 'term': f['term'], 'line': f['line'], 'meaning': e.get('meaning'), 'verdict': v.get('verdict')})
    if 'swap' in j:
        for f, a in zip([f for f in F[name] if f['code'] == 'J07'], j['swap']['parsed']['items']):
            swaps.append({'text': name[:-3], 'term': f['term'], 'suggestion': f.get('suggestion'), 'fits': a.get('fits') is True, 'changes_meaning': a.get('changes_meaning') is True})
res = {'checks': {}, 'cost_usd': round(cost, 4)}
for code in ('J01', 'J04'):
    rs = [r for r in rows if r['code'] == code]
    strict = sum(r['verdict'] != 'right' for r in rs); lenient = sum(r['verdict'] in ('wrong', 'none') for r in rs)
    dec = lambda t: 'not enough findings' if len(rs) < 5 else ('keep as an optional hint for long-form writing' if t / len(rs) >= 0.5 else 'drop for long-form writing')
    res['checks'][code] = {'findings': len(rs), 'true': strict, 'true_with_partly_as_understood': lenient, 'verdicts': dict(Counter(r['verdict'] for r in rs)),
                           'by_text': {t: [sum(1 for r in rs if r['text'] == t), sum(1 for r in rs if r['text'] == t and r['verdict'] != 'right')] for t in sorted({r['text'] for r in rs})},
                           'decision': dec(strict), 'decision_with_partly_as_understood': dec(lenient)}
fit = sum(s['fits'] for s in swaps); chg = sum(s['changes_meaning'] for s in swaps)
res['checks']['J07'] = {'findings': len(swaps), 'fit': fit, 'changes_meaning': chg,
                        'decision': 'not enough findings' if len(swaps) < 5 else ('keep for long-form writing' if fit / len(swaps) >= 0.5 and chg / len(swaps) <= 0.1 else 'drop for long-form writing')}
(D / 'verdicts.json').write_text(json.dumps({'terms': rows, 'swaps': swaps}, indent=1))
(D / 'results.json').write_text(json.dumps(res, indent=1))
for k, v in res['checks'].items(): print(k, v)
print('cost', res['cost_usd'])
print('true J01/J04:', [(r['text'], r['code'], r['term'], r['verdict']) for r in rows if r['verdict'] != 'right'])
