"""Model calls for the follow-up. Usage: python3 -I followup.py <step> <study dir> <first study dir> <empty working dir> [prompt.md at 7eb9cac]
Steps: explain (part 1: the reader explains, a checker marks), rewrite (part 3: one-shot rewrites), judge-j05 (part 3: each J05 finding)."""
import json, os, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
STEP, D, FIRST, CWD = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
READERS = {
    'f1': 'an hourly warehouse employee', 'f2': 'a retired homeowner who has fallen behind on her property taxes',
    'f3': 'the adult daughter of a Medicare patient', 'f4': 'a parent whose child rides a school bus',
    'f5': 'a parent applying for a local aid program that uses the guidelines',
}
TEXTS = {'f1': 'f1.md', 'f2': 'f2.md', 'f3': 'f3.md', 'f4': 'f4.md', 'f5': 'f5.txt'}
P = lambda name: (D / 'prompts' / name).read_text()

def call(prompt, system=None):
    # The model is named at run time (JUDGE_MODEL), as the one the first study's calls used; the CLI's default had changed since.
    cmd = ['claude', '-p', '--model', os.environ['JUDGE_MODEL'], '--output-format', 'json', '--no-session-persistence',
           '--strict-mcp-config', '--tools', '', '--session-id', str(uuid.uuid4())]
    if system: cmd += ['--append-system-prompt', system]
    r = subprocess.run(cmd + ['--', prompt], cwd=CWD, capture_output=True, text=True, timeout=900)
    d = json.loads(r.stdout)
    return {k: d.get(k) for k in ('result', 'total_cost_usd', 'usage', 'duration_ms', 'is_error')}

def json_call(prompt, n_items):
    tries = []
    for _ in range(2):
        try:
            raw = call(prompt); tries.append(raw)
            m = re.search(r'\{.*\}', raw.get('result') or '', re.S)
            parsed = json.loads(m.group(0)) if m else None
            if parsed and isinstance(parsed.get('items'), list) and len(parsed['items']) == n_items:
                return {'tries': tries, 'parsed': parsed}
        except Exception as e:
            tries.append({'error': repr(e)})
    return {'tries': tries, 'parsed': None}

def explain(fid):
    text = (FIRST / 'texts' / TEXTS[fid]).read_text()
    fs = [f for f in json.loads((FIRST / 'findings.json').read_text())[TEXTS[fid]] if f['code'] in ('J01', 'J04')]
    items = [f'{n}. "{f["term"]}" (line {f["line"]}: {f["lineText"].strip()})' for n, f in enumerate(fs, 1)]
    pe = P('explain.txt').replace('{reader}', READERS[fid]).replace('{text}', text).replace('{items}', '\n'.join(items))
    e = json_call(pe, len(items))
    out = {'reader': READERS[fid], 'findings': [{'code': f['code'], 'term': f['term'], 'line': f['line']} for f in fs], 'explain_prompt': pe, 'explain': e}
    if e['parsed']:
        means = [it.get('meaning') for it in e['parsed']['items']]
        vitems = [f'{n}. "{f["term"]}" (line {f["line"]}: {f["lineText"].strip()})\n   Reader\'s explanation: {m}' for n, (f, m) in enumerate(zip(fs, means), 1)]
        pv = P('verify.txt').replace('{text}', text).replace('{items}', '\n'.join(vitems))
        out['verify_prompt'] = pv
        out['verify'] = json_call(pv, len(items))
    (D / 'explain').mkdir(exist_ok=True)
    (D / 'explain' / f'{fid}.json').write_text(json.dumps(out, indent=1))
    return fid, bool(e['parsed']), bool(out.get('verify', {}).get('parsed'))

def rewrite(fid):
    text = (FIRST / 'texts' / TEXTS[fid]).read_text()
    pm = Path(sys.argv[5]).read_text()
    voice = pm.split('<!-- voice:start -->')[1].split('<!-- voice:end -->')[0].strip().replace('{reader}', READERS[fid])
    pr = P('rewrite.txt').replace('{reader}', READERS[fid]).replace('{text}', text)
    tries = []
    for _ in range(2):
        try:
            raw = call(pr, system=voice); tries.append(raw)
            body = (raw.get('result') or '').strip()
            body = re.sub(r'^```(?:markdown|md)?\n(.*)\n```$', r'\1', body, flags=re.S)
            if len(body.split()) > 100: break
        except Exception as e:
            tries.append({'error': repr(e)}); body = ''
    (D / 'rewrites').mkdir(exist_ok=True)
    (D / 'rewrites' / f'{fid}.md').write_text(body + '\n')
    (D / 'rewrites' / f'{fid}.call.json').write_text(json.dumps({'reader': READERS[fid], 'system_appended': voice, 'prompt': pr, 'tries': tries}, indent=1))
    return fid, len(body.split())

def judge_j05(fid):
    original = (FIRST / 'texts' / TEXTS[fid]).read_text()
    rew = (D / 'rewrites' / f'{fid}.md').read_text()
    fs = json.loads((D / 'j05-findings.json').read_text())[fid]
    if not fs: return fid, 'no findings'
    olines = original.split('\n')
    items = [f'{n}. "{f["term"]}" (original line {f["line"]}: {olines[f["line"] - 1].strip()[:600]})' for n, f in enumerate(fs, 1)]
    pj = P('j05.txt').replace('{original}', original).replace('{rewrite}', rew).replace('{items}', '\n'.join(items))
    j = json_call(pj, len(items))
    (D / 'j05-judge').mkdir(exist_ok=True)
    (D / 'j05-judge' / f'{fid}.json').write_text(json.dumps({'prompt': pj, **j}, indent=1))
    return fid, bool(j['parsed'])

def judge_j05_retest(fid):
    # The retest after the JAR-004 fix: only the findings that are new or now mean something else.
    todo = json.loads((D / 'j05-retest-tojudge.json').read_text())
    if fid not in todo: return fid, 'nothing to judge'
    original = (FIRST / 'texts' / TEXTS[fid]).read_text()
    rew = (D / 'rewrites' / f'{fid}.md').read_text()
    olines = original.split('\n')
    items = [f'{n}. "{f["term"]}" (original line {f["line"]}: {olines[f["line"] - 1].strip()[:600]})' for n, f in enumerate(todo[fid], 1)]
    pj = P('j05.txt').replace('{original}', original).replace('{rewrite}', rew).replace('{items}', '\n'.join(items))
    j = json_call(pj, len(items))
    (D / 'j05-retest-judge').mkdir(exist_ok=True)
    (D / 'j05-retest-judge' / f'{fid}.json').write_text(json.dumps({'prompt': pj, **j}, indent=1))
    return fid, bool(j['parsed'])

fn = {'explain': explain, 'rewrite': rewrite, 'judge-j05': judge_j05, 'judge-j05-retest': judge_j05_retest}[STEP]
with ThreadPoolExecutor(5) as ex:
    for r in ex.map(fn, sorted(READERS)):
        print(STEP, r)
