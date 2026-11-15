"""Score the model-judged groups of the iso-24495 audit and combine them with the hand checks.
Usage: python3 -I score.py <judge out dir> <study dir>. Writes verdicts.json and results.json."""
import json, re, sys
from collections import Counter
from pathlib import Path
JD, D = Path(sys.argv[1]), Path(sys.argv[2])
def term_of(f): m = re.search(r'"([^"]+)"', f['detail']); return m.group(1) if m else f['detail']
def group(f):
    if f['rule'] in ('acronym-undefined', 'legalese'): return 1
    if f['rule'] == 'doublet': return 1 if 'legal-register' in f['detail'] else 2
    if f['rule'] in ('complex-word', 'wordy-phrase'): return 2
    return 0
terms, swaps, cost = [], [], 0.0
for fid in ['f1', 'f2', 'f3', 'f4', 'f5']:
    fs = json.loads((D / 'audit' / f'{fid}.json').read_text())['findings']; j = json.loads((JD / f'{fid}.json').read_text())
    for part in j.values():
        for t in part['tries']: cost += t.get('total_cost_usd') or 0
    g1 = [f for f in fs if group(f) == 1]; g2 = [f for f in fs if group(f) == 2]
    if g1:
        for f, e, v in zip(g1, j['explain']['parsed']['items'], j['verify']['parsed']['items']):
            terms.append({'text': fid, 'rule': f['rule'], 'term': term_of(f), 'line': f['line'], 'meaning': e.get('meaning'), 'verdict': v.get('verdict')})
    if g2:
        for f, a in zip(g2, j['swap']['parsed']['items']):
            swaps.append({'text': fid, 'rule': f['rule'], 'detail': f['detail'], 'line': f['line'], 'fits': a.get('fits') is True, 'changes_meaning': a.get('changes_meaning') is True})
hand = json.loads((D / 'hand-checks.json').read_text())
t_true = sum(r['verdict'] != 'right' for r in terms)
res = {
 'group1_words_reader_may_not_know': {'findings': len(terms), 'true': t_true, 'verdicts': dict(Counter(r['verdict'] for r in terms)), 'by_rule': dict(Counter(r['rule'] for r in terms))},
 'group2_plainer_word': {'findings': len(swaps), 'fit': sum(s['fits'] for s in swaps), 'changes_meaning': sum(s['changes_meaning'] for s in swaps), 'by_rule': dict(Counter(s['rule'] for s in swaps))},
 'group3_counting': {'sentence-length': {k: hand['sentence-length'][k] for k in ('findings', 'count_right')}, 'paragraph-length': {k: hand['paragraph-length'][k] for k in ('findings', 'count_right')},
                     'paragraph-length_over_the_limit_holds': hand['paragraph-length']['count_right'] + len(hand['paragraph-length']['over_the_limit_but_count_wrong']),
                     'sentence-average': {k: hand['sentence-average'][k] for k in ('findings', 'true')}},
 'group4_structure': {'heading-style': {k: hand['heading-style'][k] for k in ('findings', 'true')}},
 'cost_usd': round(cost, 4)}
(D / 'verdicts.json').write_text(json.dumps({'terms': terms, 'swaps': swaps}, indent=1))
(D / 'results.json').write_text(json.dumps(res, indent=1))
print(json.dumps(res, indent=1))
print([(r['text'], r['term'], r['verdict']) for r in terms])
print([(s['text'], s['detail'][:45], s['fits'], s['changes_meaning']) for s in swaps])
