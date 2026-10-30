"""Score the dynamics README before and after its plain-language rewrite.

Run from the repository root: python3 jargone/research/readability.py
Reads the two versions from git (fab4b7a = before, 0ef8262 = after). The syllable count is a rough
vowel-group heuristic, so other counting rules give other numbers for the same files.
"""
import re
import subprocess


def show(rev, path):
    return subprocess.run(['git', 'show', f'{rev}:{path}'], capture_output=True, text=True, check=True).stdout


def prose(md, stop='## Where it comes from'):
    md = md.split(stop)[0]
    md = re.sub(r'```.*?```', ' ', md, flags=re.S)
    lines = [l for l in md.splitlines() if not l.startswith('|') and not l.startswith('#')]
    t = ' '.join(lines)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'`[^`]*`', 'code', t)
    return re.sub(r'[*_]', '', t)


def syllables(word):
    w = re.sub(r'e$', '', re.sub(r'[^a-z]', '', word.lower()))
    return max(1, len(re.findall(r'[aeiouy]+', w))) if w else 0


def stats(t):
    sentences = [s for s in re.split(r'(?<=[.!?;:])\s+', t) if re.search(r'[A-Za-z]', s)]
    words = re.findall(r"[A-Za-z][A-Za-z'’-]*", t)
    W, S = len(words), len(sentences)
    syl = sum(syllables(w) for w in words)
    longest = max(len(re.findall(r'[A-Za-z]+', s)) for s in sentences)
    ease = 206.835 - 1.015 * W / S - 84.6 * syl / W
    grade = 0.39 * W / S + 11.8 * syl / W - 15.59
    return f'words {W:5d}  avg sentence {W / S:4.1f}  longest {longest:3d}  Flesch ease {ease:5.1f}  FK grade {grade:4.1f}'


def entry(md):
    return prose(re.search(r'### `dynamics`[^\n]*\n([^\n]+)', md).group(1))


print('plugin README, before', stats(prose(show('fab4b7a', 'dynamics/README.md'))))
print('plugin README, after ', stats(prose(show('0ef8262', 'dynamics/README.md'))))
print('repo entry, before   ', stats(entry(show('fab4b7a', 'README.md'))))
print('repo entry, after    ', stats(entry(show('0ef8262', 'README.md'))))
