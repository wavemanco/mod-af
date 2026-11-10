"""Ask a model, playing each text's reader, (1) which terms it would not understand, then (2) about each finding.
Usage: python3 -I judge.py <study dir> <empty working dir>. Writes judge/<id>-unknown.json and judge/<id>-findings.json."""
import json, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
D, CWD = Path(sys.argv[1]), Path(sys.argv[2])
READERS = {
    'f1': 'an hourly warehouse employee', 'f2': 'a retired homeowner who has fallen behind on her property taxes',
    'f3': 'the adult daughter of a Medicare patient', 'f4': 'a parent whose child rides a school bus',
    'f5': 'a parent applying for a local aid program that uses the guidelines',
}
TEXTS = {'f1': 'f1.md', 'f2': 'f2.md', 'f3': 'f3.md', 'f4': 'f4.md', 'f5': 'f5.txt'}
P_UNKNOWN = (D / 'prompts/unknown-terms.txt').read_text()
P_FINDINGS = (D / 'prompts/findings.txt').read_text()
FINDINGS = json.loads((D / 'findings.json').read_text())
OUT = D / 'judge'; OUT.mkdir(exist_ok=True)

def call(prompt):
    cmd = ['claude', '-p', '--output-format', 'json', '--no-session-persistence', '--strict-mcp-config', '--tools', '',
           '--session-id', str(uuid.uuid4()), '--', prompt]
    r = subprocess.run(cmd, cwd=CWD, capture_output=True, text=True, timeout=600)
    d = json.loads(r.stdout)
    m = re.search(r'\{.*\}', d.get('result') or '', re.S)
    parsed = json.loads(m.group(0)) if m else None
    keep = {k: d.get(k) for k in ('result', 'total_cost_usd', 'usage', 'duration_ms', 'is_error')}
    return keep, parsed

def with_retry(prompt, check):
    tries = []
    for _ in range(2):
        try:
            raw, parsed = call(prompt)
            tries.append(raw)
            if parsed is not None and check(parsed): return {'tries': tries, 'parsed': parsed}
        except Exception as e:
            tries.append({'error': repr(e)})
    return {'tries': tries, 'parsed': None}

def items_for(fid):
    out = []
    for n, f in enumerate(FINDINGS[TEXTS[fid]], 1):
        line = f['lineText'].strip()
        if f['code'] == 'J07':
            out.append(f'{n}. SWAP: "{f["term"]}" -> "{" or ".join(f.get("suggestion") or [])}" (line {f["line"]}: {line})')
        else:
            out.append(f'{n}. TERM: "{f["term"]}" (line {f["line"]}: {line})')
    return out

def run(fid):
    text = (D / 'texts' / TEXTS[fid]).read_text()
    pu = P_UNKNOWN.replace('{reader}', READERS[fid]).replace('{text}', text)
    u = with_retry(pu, lambda p: isinstance(p.get('terms'), list))
    (OUT / f'{fid}-unknown.json').write_text(json.dumps({'reader': READERS[fid], 'prompt': pu, **u}, indent=1))
    items = items_for(fid)
    pf = P_FINDINGS.replace('{reader}', READERS[fid]).replace('{text}', text).replace('{items}', '\n'.join(items))
    f = with_retry(pf, lambda p: isinstance(p.get('items'), list) and len(p['items']) == len(items))
    (OUT / f'{fid}-findings.json').write_text(json.dumps({'reader': READERS[fid], 'prompt': pf, **f}, indent=1))
    return fid, u['parsed'] is not None, f['parsed'] is not None

with ThreadPoolExecutor(5) as ex:
    for fid, ok_u, ok_f in ex.map(run, sorted(READERS)):
        print(fid, 'unknown ok' if ok_u else 'unknown FAILED', '| findings ok' if ok_f else '| findings FAILED')
