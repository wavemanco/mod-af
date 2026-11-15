"""Remove what is not article body from each chosen text, by explicit rules: a byline or bio, a date line, a site
prompt, a subscription line, related links. Usage: python3 -I clean.py <candidates dir> <out dir>."""
import sys
from pathlib import Path
C, OUT = Path(sys.argv[1]), Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
def blocks(name): return (C / name / 'text.md').read_text().strip().split('\n\n')
def cut_from(bs, start): i = next(k for k, b in enumerate(bs) if b.startswith(start)); return bs[:i]
rules = {
 'L1': ('noema-2', lambda bs: bs[1:] if bs[0].startswith('John Last is a freelance journalist') else bs),
 'L2': ('wip-3', lambda bs: cut_from(bs, 'Subscribe for $100')),
 'L3': ('asterisk-1', lambda bs: cut_from(bs, '## Further Reading')),
 'L4': ('quanta-3', lambda bs: cut_from([b for b in bs if b != 'November 12, 2026' and not b.startswith('Click to tell Google to prioritize Quanta')], '## Also in Biology')),
 'L5': ('hakai-2', lambda bs: [b for b in bs if b != '### Article body copy']),
}
for lid, (src, rule) in rules.items():
    before = blocks(src); after = rule(before)
    assert len(after) < len(before), (lid, 'rule removed nothing')
    (OUT / f'{lid}.md').write_text('\n\n'.join(after) + '\n')
    print(lid, src, 'removed', len(before) - len(after), 'blocks;', len('\n\n'.join(after).split()), 'words; opens:', after[0][:70])
