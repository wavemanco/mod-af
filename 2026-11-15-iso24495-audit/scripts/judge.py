"""Judge the iso-24495 audit's word findings as jargone's were judged. Group 1 (acronym-undefined, legalese,
legal-register doublets): the reader explains, a checker marks. Group 2 (complex-word, wordy-phrase, other
doublets): does the swap fit, and would it change the meaning. Usage: python3 -I judge.py <lab checkout> <texts dir>
<audit dir> <out dir> <empty working dir>; JUDGE_MODEL names the model. Full outputs go to <out dir>."""
import json, os, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
LAB, TEXTS, AUDIT, OUT, CWD = (Path(a) for a in sys.argv[1:6]); OUT.mkdir(parents=True, exist_ok=True)
READERS = {'f1': 'an hourly warehouse employee', 'f2': 'a retired homeowner who has fallen behind on her property taxes',
           'f3': 'the adult daughter of a Medicare patient', 'f4': 'a parent whose child rides a school bus',
           'f5': 'a parent applying for a local aid program that uses the guidelines'}
NAMES = {'f1': 'f1.md', 'f2': 'f2.md', 'f3': 'f3.md', 'f4': 'f4.md', 'f5': 'f5.txt'}
FU = LAB / '2026-11-15-checks-everyday-followup/prompts'; FIRST = LAB / '2026-11-10-wordlist-checks-everyday/prompts'
def term_of(f):
    m = re.search(r'"([^"]+)"', f['detail']); return m.group(1) if m else f['detail']
def group(f):
    if f['rule'] in ('acronym-undefined', 'legalese'): return 1
    if f['rule'] == 'doublet': return 1 if 'legal-register' in f['detail'] else 2
    if f['rule'] in ('complex-word', 'wordy-phrase'): return 2
    return 0
def swap_of(f):
    if f['rule'] == 'complex-word': m = re.search(r'"([^"]+)" where "([^"]+)"', f['detail'])
    elif f['rule'] == 'wordy-phrase': m = re.search(r'"([^"]+)" says what "([^"]+)"', f['detail'])
    else: m = re.search(r'phrase "([^"]+)"; consider "([^"]+)"', f['detail'])
    return m.group(1), m.group(2)
def call(prompt):
    cmd = ['claude', '-p', '--model', os.environ['JUDGE_MODEL'], '--output-format', 'json', '--no-session-persistence',
           '--strict-mcp-config', '--tools', '', '--session-id', str(uuid.uuid4()), '--', prompt]
    d = json.loads(subprocess.run(cmd, cwd=CWD, capture_output=True, text=True, timeout=900).stdout)
    return {k: d.get(k) for k in ('result', 'total_cost_usd', 'usage', 'duration_ms', 'is_error')}
def json_call(prompt, n):
    tries = []
    for _ in range(2):
        try:
            raw = call(prompt); tries.append(raw)
            m = re.search(r'\{.*\}', raw.get('result') or '', re.S); p = json.loads(m.group(0)) if m else None
            if p and isinstance(p.get('items'), list) and len(p['items']) == n: return {'tries': tries, 'parsed': p}
        except Exception as e: tries.append({'error': repr(e)})
    return {'tries': tries, 'parsed': None}
def run(fid):
    text = (TEXTS / NAMES[fid]).read_text(); lines = text.split('\n'); reader = READERS[fid]
    fs = json.loads((AUDIT / f'{fid}.json').read_text())['findings']; out = {}
    g1 = [f for f in fs if group(f) == 1]; g2 = [f for f in fs if group(f) == 2]
    if g1:
        items = [f'{k}. "{term_of(f)}" (line {f["line"]}: {lines[f["line"] - 1].strip()[:500]})' for k, f in enumerate(g1, 1)]
        e = json_call((FU / 'explain.txt').read_text().replace('{reader}', reader).replace('{text}', text).replace('{items}', '\n'.join(items)), len(items))
        out['explain'] = e
        if e['parsed']:
            vi = [f'{k}. "{term_of(f)}" (line {f["line"]}: {lines[f["line"] - 1].strip()[:500]})\n   Reader\'s explanation: {it.get("meaning")}' for k, (f, it) in enumerate(zip(g1, e['parsed']['items']), 1)]
            out['verify'] = json_call((FU / 'verify.txt').read_text().replace('{text}', text).replace('{items}', '\n'.join(vi)), len(items))
    if g2:
        items = [f'{k}. SWAP: "{swap_of(f)[0]}" -> "{swap_of(f)[1]}" (line {f["line"]}: {lines[f["line"] - 1].strip()[:500]})' for k, f in enumerate(g2, 1)]
        out['swap'] = json_call((FIRST / 'findings.txt').read_text().replace('{reader}', reader).replace('{text}', text).replace('{items}', '\n'.join(items)), len(items))
    (OUT / f'{fid}.json').write_text(json.dumps(out, indent=1))
    return fid, {k: bool(v.get('parsed')) for k, v in out.items()}
with ThreadPoolExecutor(5) as ex:
    for r in ex.map(run, sorted(READERS)): print(r, flush=True)
