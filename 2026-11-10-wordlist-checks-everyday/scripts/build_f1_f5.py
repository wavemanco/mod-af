import re, html, sys
from pathlib import Path
DL, OUT = Path(sys.argv[1]), Path(sys.argv[2])
# f1: 29 CFR 825.110 from the eCFR renderer. One paragraph per <p>; (c)(2) and (c)(3) left out.
s = (DL / 'f1/raw.html').read_text(encoding='utf-8')
title = re.search(r'<h\d[^>]*>(.*?)</h\d>', s, re.S)
paras = [html.unescape(re.sub(r'<[^>]+>', '', p)) for p in re.findall(r'<p[^>]*>(.*?)</p>', s, re.S)]
paras = [re.sub(r'\(\s*(\w+)\s*\)', r'(\1)', re.sub(r'\s+', ' ', p)).strip() for p in paras]
paras = [p for p in paras if p]
head = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', title.group(1)))).strip() if title else '§ 825.110 Eligible employee.'
keep, skipping = [], False
for p in paras:
    if re.match(r'\(2\) ', p) and keep and any(k.startswith('(c)') for k in keep): skipping = True
    if re.match(r'\(d\) ', p): skipping = False
    if skipping:
        if keep[-1] != '[...]': keep.append('[...]')
        continue
    keep.append(p)
f1 = f'# {head}\n\n' + '\n\n'.join(keep) + '\n'
(OUT / 'f1.md').write_text(f1)
# f5: the govinfo copy of FR Doc 2026-00755. Plain text; the address and contact block left out.
t = html.unescape(re.sub(r'<[^>]+>', '', (DL / 'f5/raw.html').read_text(encoding='utf-8')))
t = t.replace('\r', '')
start = t.index('Annual Update of the HHS Poverty Guidelines')
end = t.index('[FR Doc.') if '[FR Doc.' in t else len(t)
body = t[start:end].rstrip()
a, b = body.index('ADDRESSES:'), body.index('SUPPLEMENTARY INFORMATION:')
body = body[:a] + '[...]\n\n' + body[b:]
(OUT / 'f5.txt').write_text(body + '\n')
for n in ('f1.md', 'f5.txt'):
    print(n, len((OUT / n).read_text().split()), 'words')
