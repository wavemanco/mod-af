"""Fetch an article page and extract its body as Markdown: paragraphs, h2/h3 headings and block quotations from the
<article> region (else <main>), after removing scripts, styles, figures, captions, asides, navigation, headers,
footers and forms. A block whose own class names a caption, byline, newsletter, promotion or the like is left out.
Usage: python3 -I extract.py <url> <out dir>. Writes page.html and text.md; prints words, signs of audio or video,
and how the text opens and ends."""
import hashlib, re, subprocess, sys, html
from pathlib import Path
url, out = sys.argv[1], Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
page = out / 'page.html'
if not page.exists() or len(sys.argv) < 4 or sys.argv[3] != 'cached':
    r = subprocess.run(['curl', '-sS', '-L', '--max-time', '60', '-A', 'Mozilla/5.0 (research script)', '-o', str(page), '-w', '%{http_code}', url], capture_output=True, text=True)
    code = r.stdout
else:
    code = 'cached'
s = page.read_text(encoding='utf-8', errors='replace')
raw = s
for tag in ('script', 'style', 'noscript', 'svg', 'figure', 'figcaption', 'aside', 'nav', 'footer', 'form', 'header', 'button'):
    s = re.sub(rf'<{tag}\b.*?</{tag}>', ' ', s, flags=re.S | re.I)
a, b = s.find('<article'), s.rfind('</article>')
if a >= 0 and b > a: s = s[a:b]
else:
    a, b = s.find('<main'), s.rfind('</main>')
    if a >= 0 and b > a: s = s[a:b]
SKIP_CLASS = re.compile(r'caption|byline|author|newsletter|subscribe|promo|signup|share|related|recommend|donate|credit|footnote|disclaimer', re.I)
def clean(x): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', x))).strip()
blocks, pos = [], 0
pat = re.compile(r'<(blockquote|h2|h3|p)\b([^>]*)>', re.I)
while True:
    m = pat.search(s, pos)
    if not m: break
    tag, attrs = m.group(1).lower(), m.group(2)
    end = s.find(f'</{tag}>', m.end())
    if end < 0: break
    inner = s[m.end():end]; pos = end + len(tag) + 3
    if SKIP_CLASS.search(attrs): continue
    t = clean(inner)
    if not t or (tag == 'p' and len(t.split()) < 3): continue
    blocks.append({'p': '', 'h2': '## ', 'h3': '### ', 'blockquote': '> '}[tag] + t)
text = '\n\n'.join(blocks) + '\n'
(out / 'text.md').write_text(text)
av = sorted({x.lower() for x in re.findall(r'<(audio|video)\b', raw, re.I)} | {'embedded player' for _ in re.findall(r'<iframe[^>]*(?:youtube|spotify|soundcloud|simplecast|megaphone)', raw, re.I)})
print(f'http {code} | words {len(text.split())} | blocks {len(blocks)} | audio/video: {av} | page sha256 {hashlib.sha256(page.read_bytes()).hexdigest()[:12]}')
print('  opens:', text[:220].replace('\n', ' '))
print('  ends:', text[-200:].replace('\n', ' '))
