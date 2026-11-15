"""Judge the long-form findings. J01 and J04: the reader explains each term, a checker marks the explanation
(the follow-up's prompts). J07: does the swap fit, and would it change the meaning (the first study's prompt).
Usage: python3 -I judge.py <lab checkout> <texts dir> <full findings.json> <out dir> <empty working dir>.
The model is named at run time (JUDGE_MODEL). Full outputs, which quote the articles, go to <out dir>, off the repo."""
import json, os, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
LAB, TEXTS, FIND, OUT, CWD = (Path(a) for a in sys.argv[1:6]); OUT.mkdir(parents=True, exist_ok=True)
READER = 'a curious adult with no background in the subject of this article'
P_EXPLAIN = (LAB / '2026-11-15-checks-everyday-followup/prompts/explain.txt').read_text()
P_VERIFY = (LAB / '2026-11-15-checks-everyday-followup/prompts/verify.txt').read_text()
P_SWAP = (LAB / '2026-11-10-wordlist-checks-everyday/prompts/findings.txt').read_text()
F = json.loads(FIND.read_text())
def call(prompt):
    cmd = ['claude', '-p', '--model', os.environ['JUDGE_MODEL'], '--output-format', 'json', '--no-session-persistence',
           '--strict-mcp-config', '--tools', '', '--session-id', str(uuid.uuid4()), '--', prompt]
    r = subprocess.run(cmd, cwd=CWD, capture_output=True, text=True, timeout=900)
    d = json.loads(r.stdout)
    return {k: d.get(k) for k in ('result', 'total_cost_usd', 'usage', 'duration_ms', 'is_error')}
def json_call(prompt, n):
    tries = []
    for _ in range(2):
        try:
            raw = call(prompt); tries.append(raw)
            m = re.search(r'\{.*\}', raw.get('result') or '', re.S)
            p = json.loads(m.group(0)) if m else None
            if p and isinstance(p.get('items'), list) and len(p['items']) == n: return {'tries': tries, 'parsed': p}
        except Exception as e:
            tries.append({'error': repr(e)})
    return {'tries': tries, 'parsed': None}
def around(line, term, width=450):
    i = line.find(term)
    if len(line) <= width or i < 0: return line[:width]
    a = max(0, i - width // 2); return ('…' if a else '') + line[a:a + width] + '…'
def run(name):
    text = (TEXTS / name).read_text(); fs = F[name]; out = {}
    terms = [f for f in fs if f['code'] in ('J01', 'J04')]
    if terms:
        items = [f'{n}. "{f["term"]}" (line {f["line"]}: {around(f["lineText"].strip(), f["term"])})' for n, f in enumerate(terms, 1)]
        e = json_call(P_EXPLAIN.replace('{reader}', READER).replace('{text}', text).replace('{items}', '\n'.join(items)), len(items))
        out['explain'] = e
        if e['parsed']:
            v_items = [f'{n}. "{f["term"]}" (line {f["line"]}: {around(f["lineText"].strip(), f["term"])})\n   Reader\'s explanation: {it.get("meaning")}' for n, (f, it) in enumerate(zip(terms, e['parsed']['items']), 1)]
            out['verify'] = json_call(P_VERIFY.replace('{text}', text).replace('{items}', '\n'.join(v_items)), len(items))
    swaps = [f for f in fs if f['code'] == 'J07']
    if swaps:
        items = [f'{n}. SWAP: "{f["term"]}" -> "{" or ".join(f.get("suggestion") or [])}" (line {f["line"]}: {around(f["lineText"].strip(), f["term"])})' for n, f in enumerate(swaps, 1)]
        out['swap'] = json_call(P_SWAP.replace('{reader}', READER).replace('{text}', text).replace('{items}', '\n'.join(items)), len(items))
    (OUT / f'{name}.json').write_text(json.dumps(out, indent=1))
    return name, {k: bool(v.get('parsed')) for k, v in out.items()}
with ThreadPoolExecutor(5) as ex:
    for r in ex.map(run, sorted(F)): print(r, flush=True)
