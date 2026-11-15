"""J05 on the long-form articles. Steps: rewrite (one-shot rewrites under the standing instruction) and judge (each
J05 finding, lost or restated). Usage: python3 -I j05.py <step> <lab checkout> <texts dir> <work dir> <empty
working dir> <prompt.md at feb399c>. The model is named at run time (JUDGE_MODEL). Everything written goes to
<work dir>, off the repo: the rewrites and prompts hold the articles' text."""
import json, os, re, subprocess, sys, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
STEP = sys.argv[1]; LAB, TEXTS, WORK, CWD, PROMPT_MD = (Path(a) for a in sys.argv[2:7])
READER = 'a curious adult with no background in the subject of this article'
FU = LAB / '2026-11-15-checks-everyday-followup/prompts'
NAMES = ['L1', 'L2', 'L3', 'L4', 'L5']
def call(prompt, system=None):
    cmd = ['claude', '-p', '--model', os.environ['JUDGE_MODEL'], '--output-format', 'json', '--no-session-persistence',
           '--strict-mcp-config', '--tools', '', '--session-id', str(uuid.uuid4())]
    if system: cmd += ['--append-system-prompt', system]
    r = subprocess.run(cmd + ['--', prompt], cwd=CWD, capture_output=True, text=True, timeout=1500)
    d = json.loads(r.stdout)
    return {k: d.get(k) for k in ('result', 'total_cost_usd', 'usage', 'duration_ms', 'is_error')}
def rewrite(n):
    text = (TEXTS / f'{n}.md').read_text()
    voice = PROMPT_MD.read_text().split('<!-- voice:start -->')[1].split('<!-- voice:end -->')[0].strip().replace('{reader}', READER)
    pr = (FU / 'rewrite.txt').read_text().replace('{reader}', READER).replace('{text}', text)
    tries, body = [], ''
    for _ in range(2):
        try:
            raw = call(pr, system=voice); tries.append(raw)
            body = re.sub(r'^```(?:markdown|md)?\n(.*)\n```$', r'\1', (raw.get('result') or '').strip(), flags=re.S)
            if len(body.split()) > 100: break
        except Exception as e:
            tries.append({'error': repr(e)})
    (WORK / 'rewrites').mkdir(parents=True, exist_ok=True)
    (WORK / 'rewrites' / f'{n}.md').write_text(body + '\n')
    (WORK / 'rewrites' / f'{n}.call.json').write_text(json.dumps({'tries': tries}, indent=1))
    return n, len(body.split())
def judge(n):
    original = (TEXTS / f'{n}.md').read_text(); rew = (WORK / 'rewrites' / f'{n}.md').read_text()
    fs = json.loads((WORK / 'j05-findings.json').read_text())[n]
    if not fs: return n, 'no findings'
    ol = original.split('\n')
    def around(line, term, width=450):
        i = line.find(term)
        if len(line) <= width or i < 0: return line[:width]
        a = max(0, i - width // 2); return ('…' if a else '') + line[a:a + width] + '…'
    items = [f'{k}. "{f["term"]}" (original line {f["line"]}: {around(ol[f["line"] - 1].strip(), f["term"])})' for k, f in enumerate(fs, 1)]
    pj = (FU / 'j05.txt').read_text().replace('{original}', original).replace('{rewrite}', rew).replace('{items}', '\n'.join(items))
    tries = []
    for _ in range(2):
        try:
            raw = call(pj); tries.append(raw)
            m = re.search(r'\{.*\}', raw.get('result') or '', re.S); p = json.loads(m.group(0)) if m else None
            if p and isinstance(p.get('items'), list) and len(p['items']) == len(items): break
            p = None
        except Exception as e:
            tries.append({'error': repr(e)}); p = None
    (WORK / 'j05-judge').mkdir(parents=True, exist_ok=True)
    (WORK / 'j05-judge' / f'{n}.json').write_text(json.dumps({'tries': tries, 'parsed': p}, indent=1))
    return n, p is not None
fn = {'rewrite': rewrite, 'judge': judge}[STEP]
with ThreadPoolExecutor(5) as ex:
    for r in ex.map(fn, NAMES): print(STEP, r, flush=True)
