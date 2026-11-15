# Does another plain-language tool's audit do better than jargone's lists? (plan, fixed before the run)

Written 2026-11-15, at the maintainer's request, before the audit was run on any of these texts. The question is
whether word-list and rule checks fail only in jargone's version, or as a kind. The tool tested is the text audit
in GaZmagik/iso-24495 (the `iso-24495-text-audit` skill, `scripts/audit-text-cli.ts`, at commit 5951eb7), the
project jargone's design took as prior work. Its own documentation calls its findings "mechanical proxies, not an
ISO judgement", and its code calls the 30-word sentence cap "this project's own proxy". So this test asks how often
its proxies point at a real problem, as jargone's were asked. It does not test any claim the tool makes.

## What runs

- **The texts:** the five US government texts of `../2026-11-10-wordlist-checks-everyday/`, the same files, each
  with the same reader.
- **The audit** with Bun, on each text, with its defaults and a project folder that is empty (so it reads no
  acronym list), from an empty working folder. Its JSON output is kept.

## How each finding is judged

The rules fall into four groups:

1. **A word the reader may not know:** `acronym-undefined`, `legalese`, and `doublet` findings in the legal
   register (which name no plainer phrase). Judged as jargone's J01 was in the follow-up: the reader explains each
   term in its own words, and a checker marks the explanation (the follow-up's `prompts/explain.txt` and
   `prompts/verify.txt`). True when the explanation is not marked right.
2. **A plainer word is available:** `complex-word`, `wordy-phrase`, and the other `doublet` findings. Judged as
   jargone's J07 was: does the plainer word fit, keeping the meaning, and would the swap change the meaning (the
   first test's `prompts/findings.txt`, swap items only). True when it fits.
3. **Counting:** `sentence-length` (over 30 words), `paragraph-length` (over 5 sentences) and `sentence-average`.
   Each finding is compared with jargone's checker at feb399c, with the legal abbreviations of the follow-up's
   part 2 added. Where the two disagree, Claude checks the text by hand. True when the count is right as written.
4. **Everything else** (headings, link text, image text, tables, filler openings, double negatives, lists in
   prose): Claude checks each by hand. True when what the finding says is so. Whether it matters to the reader is
   not judged.

Model calls run as before: one call each, from an empty folder, with no tools and no project instructions, with the
earlier studies' model named at run time; a failed call is retried once.

## What is reported

For each group and each rule: findings, true, and the share true, set beside jargone's results on the same texts.
There is no keep-or-drop rule: this is not jargone's tool. The 50% bar the earlier tests used is reported as a
reference line only.

## Limits

- Five texts, one model reader each, one call per question, as before.
- Groups 3 and 4 are checked by Claude, not by a model judge.
