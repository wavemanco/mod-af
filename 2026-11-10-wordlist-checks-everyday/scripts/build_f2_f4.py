import re, html, sys
from pathlib import Path
DL, OUT = Path(sys.argv[1]), Path(sys.argv[2])

def reflow(lines, starts):
    """Join PDF lines into paragraphs; a new paragraph begins at each line starting with one of `starts`."""
    paras, cur = [], []
    for ln in lines:
        ln = ln.strip()
        if not ln: continue
        if cur and any(ln.startswith(s) for s in starts):
            paras.append(' '.join(cur)); cur = []
        cur.append(ln)
    if cur: paras.append(' '.join(cur))
    return paras

# f2: Tyler v. Hennepin County, opinion text from the Cornell LII copy (the court's PDF loses "fi" ligatures).
s = (DL / 'f2b/lii.html').read_text(encoding='utf-8', errors='replace')
P = [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', p))).strip() for p in re.findall(r'<p[^>]*>(.*?)</p>', s, re.S)]
P = [p for p in P if p]
assert P[18] == 'No. 22–166' and P[20].startswith('GERALDINE TYLER') and P[21].startswith('Chief Justice Roberts')
assert P[22].startswith('Hennepin County, Minnesota, sold') and P[27].startswith('We granted certiorari')
assert P[53].startswith('The Takings Clause “was designed') and P[55] == 'It is so ordered.'
f2 = ['# Tyler v. Hennepin County, Minnesota, et al.', P[18], P[20], P[21], P[22], 'I', *P[23:28], '[...]', *P[53:56]]
(OUT / 'f2.md').write_text('\n\n'.join(f2) + '\n')

# f3: Medicare Benefit Policy Manual, chapter 8, sections 20 and 20.1, up to 20.1.1.
L = (DL / 'f3/plain.txt').read_text().split('\n')
a = next(i for i, l in enumerate(L) if l.startswith('20 - Prior Hospitalization') and i > 100)
b = next(i for i, l in enumerate(L) if l.startswith('20.1.1 - Three-Day') and i > a)
starts = ['20 - ', '(Rev. ', 'A3-3131', 'In order to qualify', '20.1 - ', 'In accordance with section', 'Time spent in observation',
          'To be covered', 'In addition, the qualifying', 'Even if a beneficiary', 'The 3-day hospital stay need not', 'NOTE:']
paras = reflow(L[a:b], starts)
paras = [('# ' + p if p.startswith('20 - ') else '## ' + p if p.startswith('20.1 - ') else p) for p in paras]
(OUT / 'f3.md').write_text('\n\n'.join(paras) + '\n')

# f4: NTSB HIR-23-08: title and opening paragraph, section 2.2, section 3. Page headers, page numbers and footnotes removed.
L = (DL / 'f4/plain.txt').read_text().split('\n')
noise = re.compile(r'^(School Bus Run-Off-Road and Rollover Crash, Monaville, Texas|HIR-23-08|\d{1,2})$')
def block(first, last_exclusive, drop=()):
    i = next(k for k, l in enumerate(L) if l.startswith(first))
    j = next(k for k, l in enumerate(L) if k > i and l.startswith(last_exclusive))
    out = [l for l in L[i:j] if not noise.match(l.strip()) and not any(l.startswith(d) for d in drop)]
    return out
opening = block('On Friday, December 17, 2021', '(a) In this report')
s22 = block('2.2 Driver Assistance Systems', '2.3 Seat Belt Use',
            drop=('15 Given the general lack', 'if the bus driver exceeding'))
s3 = block('3. Conclusions', 'References',
           drop=('18 See Safety Recommendation', 'Association of State Directors', 'Association.'))
text = '\n'.join(opening)
text = text.replace('59-yearold', '59-year-old').replace('Waller County, Texas. 1 The posted', 'Waller County, Texas. The posted')
op = reflow(text.split('\n'), [])
p22 = reflow(s22, ['2.2 ', 'Given the lack', 'ESC is another', 'The NTSB has previously recommended that NHTSA require'])
p22 = [p.replace('rollover. 16', 'rollover.').replace('vehicles. 17 IC', 'vehicles. IC') for p in p22]
p3 = reflow(s3, ['3. Conclusions', '3.1 Probable', 'The National Transportation Safety Board determines', '3.2 Lessons', 'School buses are among', 'In addition to occupant'])
# The 3.2 heading wraps onto a second line ("School Buses"); reflow joins it back to the heading.
head = ['# School Bus Run-Off-Road and Rollover Crash', 'Monaville, Texas', 'December 17, 2021']
def h(p): return '## ' + p if re.match(r'^(2\.2|3\.|3\.1|3\.2) ', p) else p
f4 = head + op + ['[...]'] + [h(p) for p in p22] + ['[...]'] + [h(p) for p in p3]
(OUT / 'f4.md').write_text('\n\n'.join(f4) + '\n')
for n in ('f2.md', 'f3.md', 'f4.md'):
    print(n, len((OUT / n).read_text().split()), 'words')
