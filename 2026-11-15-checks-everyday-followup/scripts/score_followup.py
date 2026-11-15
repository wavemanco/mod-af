"""Score parts 1 and 3 of the follow-up and apply the plan's rules. Usage: python3 -I score_followup.py <study dir>. Writes results.json."""
import json, re, sys
from collections import Counter
from pathlib import Path
D = Path(sys.argv[1]); IDS = ['f1', 'f2', 'f3', 'f4', 'f5']
out, cost = {'part1': {}, 'part3': {}}, 0.0
def add_cost(tries):
    global cost
    for t in tries: cost += t.get('total_cost_usd') or 0
# Part 1: a finding is true when the reader's explanation is not marked right.
rows = []
for fid in IDS:
    d = json.loads((D / 'explain' / f'{fid}.json').read_text())
    add_cost(d['explain']['tries']); add_cost(d['verify']['tries'])
    for f, e, v in zip(d['findings'], d['explain']['parsed']['items'], d['verify']['parsed']['items']):
        rows.append({'text': fid, 'code': f['code'], 'term': f['term'], 'meaning': e.get('meaning'), 'verdict': v.get('verdict')})
for code in ('J01', 'J04'):
    rs = [r for r in rows if r['code'] == code]
    strict = sum(r['verdict'] != 'right' for r in rs)
    lenient = sum(r['verdict'] in ('wrong', 'none') for r in rs)
    c = {'findings': len(rs), 'true': strict, 'true_with_partly_as_understood': lenient, 'verdicts': dict(Counter(r['verdict'] for r in rs))}
    c['decision'] = 'not enough findings' if len(rs) < 5 else ('keep as an optional hint for everyday audiences' if strict / len(rs) >= 0.5 else 'drop')
    c['decision_with_partly_as_understood'] = 'not enough findings' if len(rs) < 5 else ('keep as an optional hint for everyday audiences' if lenient / len(rs) >= 0.5 else 'drop')
    out['part1'][code] = c
out['part1']['rows'] = rows
# Part 3: a finding is true when the item is lost.
jrows = []
F = json.loads((D / 'j05-findings.json').read_text())
for fid in IDS:
    if not F[fid]: continue
    d = json.loads((D / 'j05-judge' / f'{fid}.json').read_text()); add_cost(d['tries'])
    for f, a in zip(F[fid], d['parsed']['items']):
        jrows.append({'text': fid, 'term': f['term'], 'count_based': bool(re.search(r'is in the original \d+ times', f['message'])), 'verdict': a.get('verdict'), 'quote': a.get('quote')})
lost = sum(r['verdict'] == 'lost' for r in jrows); rest = sum(r['verdict'] == 'restated' for r in jrows)
out['part3'] = {'findings': len(jrows), 'lost': lost, 'restated': rest, 'restated_share': round(rest / len(jrows), 3),
                'by_text': {fid: [sum(1 for r in jrows if r['text'] == fid), sum(1 for r in jrows if r['text'] == fid and r['verdict'] == 'restated')] for fid in IDS},
                'count_based': {'findings': sum(r['count_based'] for r in jrows), 'restated': sum(r['count_based'] and r['verdict'] == 'restated' for r in jrows)},
                'rewrite_words': {fid: len((D / 'rewrites' / f'{fid}.md').read_text().split()) for fid in IDS},
                'rule': 'more than 1 in 5 restated: file a fix', 'fix_due': rest / len(jrows) > 0.2, 'rows': jrows}
for fid in IDS:
    add_cost(json.loads((D / 'rewrites' / f'{fid}.call.json').read_text())['tries'])
out['cost_usd'] = round(cost, 4)
(D / 'results.json').write_text(json.dumps(out, indent=1))
for code in ('J01', 'J04'):
    print(code, {k: v for k, v in out['part1'][code].items()})
print('J05', {k: v for k, v in out['part3'].items() if k != 'rows'})
print('cost', out['cost_usd'])
for r in rows: print(' ', r['text'], r['code'], r['term'], '|', r['verdict'], '|', (r['meaning'] or '')[:90])
print('restated:', [(r['text'], r['term'], (r['quote'] or '')[:60]) for r in jrows if r['verdict'] == 'restated'])
