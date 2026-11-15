# Results: jargone's checks on general-interest long-form articles

Run on 2026-11-15 under [`PLAN.md`](./PLAN.md) (commit 1ab8a37, fixed before any article was chosen), on the five
articles in [`SOURCES.md`](./SOURCES.md), about 20,000 words in all. Figures for J01, J04 and J07 come from
[`results.json`](./results.json), built by `scripts/score.py` from the judges' answers (kept off this branch,
since they quote the articles) into [`verdicts.json`](./verdicts.json). J03's come from [`j03.json`](./j03.json)
and [`j03-check.json`](./j03-check.json). No article text is kept here.

## The rules' verdicts

| Check | Findings | True | Verdict |
|---|---|---|---|
| J01, term used before it is defined | 100 | 2 (2%): the reader could not explain "MRC" or "RHIOT" | **drop** for long-form |
| J04, the opening uses only common words | 30 | 0 | **drop** for long-form |
| J07, a plainer word is available | 3 | 3 swaps fit, none would change the meaning | **not enough findings** |

- **J01's findings by article:** L1 9, L2 17, L3 10, L4 40 (the science article), L5 24. Every explanation but
  the two above was marked right; none partly right or wrong.
- **J07's three swaps** were all "numerous" to "many" (twice) or "expedite" to "speed up".
- **Cost:** $1.43 for 13 model calls.

**A caveat, strongest here.** The reader is a model playing "a curious adult with no background in the subject".
It explained 98 of 100 terms, including science words such as "nucleobases" and "lipids" that a real reader of
that kind may not know. A model cannot forget what it knows. It also reads the whole article, so it can take a
term's meaning from a later paragraph. Every test so far shares this limit, but these articles test it hardest.
So J01's and J04's verdicts here say the terms are explainable from the article and general knowledge, not that
a real reader knows them.

## J03

J03 flagged 145 sentences over 30 words: L1 32, L2 19, L3 32, L4 30, L5 32. There is no cap; the three 32s are a
coincidence.

**As the plan asked.** Of 658 sentence breaks inside paragraphs, 15 came after a short capitalised word or a
single letter, or at the end of a quotation. Claude checked each against the text. 14 are real ends of sentences.
1 is a false break at an initial ("As philosopher C. | Thi Nguyen…"). Joined, it is 17 words, so no flag
changes. The plan's rule for JAR-003 is not triggered.

**Found after, beyond the plan: sentence ends inside a closing quotation mark.** In 21 places a full stop,
question mark or exclamation mark sits inside a closing quotation mark, with a capital after it on the same line.
This is common in American punctuation. The checker starts no new sentence at 18 of them. Claude checked each by
hand: 17 are real ends of sentences the checker missed; 1 is not, since a speech tag follows ("… you know?" Dick
says.). What the 17 misses do to J03:
- **3 invent a sentence over the limit** from two that are not: 31 words (15 + 16), 51 (27 + 24) and 43
  (13 + 30).
- **1 hides a flag:** two sentences over the limit (36 and 55 words) are reported as one of 91.
- **3 give a wrong length** to a right flag: 60 for 39, 38 for 31, and 42 for 40.
- **10 change nothing.**

This is filed in jargone's backlog as its own item, JAR-005.

## Across the kinds of text tested so far

| Check | Software documents | Software-session replies | US government texts | Long-form articles |
|---|---|---|---|---|
| J01 | 17% true | 3% true | 31%, then 17% with the fixed question | 2% true |
| J04 | 0 of 5 | not run | too few (2) | 0 of 30 |
| J07 | 28% fit (0.1's list) | 0% fit (0.1's list) | 5 of 6 fit (0.2's list) | 3 of 3 fit, too few (0.2's list) |

By the maintainer's rule, a check that fails on every kind of text tested is proposed for dropping from jargone
altogether. J01 now fails on all four kinds. J04 fails wherever it had enough findings to judge. J07 with 0.2's
list has not failed anywhere it was judged, and it has not been run on software text. The maintainer decides.
