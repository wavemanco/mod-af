# Results: follow-up on the everyday texts

Run on 2026-11-15 under [`PLAN.md`](./PLAN.md) (commit c5c3c69, fixed before any result). Parts 1 and 3's figures
come from [`results.json`](./results.json), built by `scripts/score_followup.py`; part 2's from `j03/`.

## 1. J01 and J04, rejudged with a fixed question

| Check | Findings | Reader could not explain it (true) | Verdict |
|---|---|---|---|
| J01 | 29 | 5 (17%): CFR (twice), "Supp", "yaw", NHTSA | **drop** |
| J04 | 2 | 0 | **not enough findings** |

- **Every other explanation was marked right.** None was marked partly right or wrong, so reading "partly" as
  understood changes nothing.
- **Both runs drop J01.** The first run found 9 of 29 true, this one 5 of 29.
- **The first run's contradiction is explained.** Its first call listed as unknown many terms the reader could in
  fact explain, such as FMLA, NTSB and "beneficiary".
- **Limit:** the reader is a model, and it cannot forget what it knows. A real warehouse worker may not know what
  FMLA stands for. The checker confirms that an explanation is right, not that a real reader would give it.

## 2. J03: counting sentences in legal and government text

| Text | Sentences: as is / with the abbreviations | Longest sentence | J03 flags: as is / with |
|---|---|---|---|
| f1 | 30 / 30 | 69 | 13 / 13 |
| f2 | 69 / 49 | 39 | 3 / 3 |
| f3 | 41 / 30 | 78 | 9 / 12 |
| f4 | 41 / 41 | 42 | 6 / 6 |
| f5 | 68 / 67 | 48 | 9 / 9 |

Each difference, checked by hand against the text:
- **f3: three long sentences missed.** The checker as it is ends a sentence at "Pub." (as in "see Pub. 100-01").
  It missed three sentences over 30 words (43, 46 and 36 words). It undercounted two it did flag: 40 words for
  45, and 53 for 64.
- **f2: 20 false sentence breaks.** These come at citation abbreviations such as "Minn. Stat." and "F. Supp.".
  None changes a flag, but they lower the average sentence length in the readability scores (J06).
- **f5: one false break,** with no effect.

**Rule:** a fix is filed in jargone's backlog as JAR-003 (commit 8e74323 on `claude/jargone-spec`).

## 3. J05 on one-shot rewrites

J05 reported 75 losses: **54 lost and 21 restated (28%)**. More than 1 in 5 were restated, so a fix is filed as
JAR-004 (commit 8e74323 on `claude/jargone-spec`).

The 21 restated, by kind:
- **10: the number is still in the rewrite, but fewer times.** J05 counts each use; for example "75" appears
  three times in f1's original and twice in its rewrite.
- **7: dates in another format,** for example "10-01-03" written as "October 1, 2003".
- **3: list numbering,** where "(1)" became a numbered list.
- **1: a thousands separator,** "2300" written as "$2,300".

A count shortfall is not always harmless. Of J05's 24 findings about counts, 17 were restated and 7 were real
losses.

**What was lost, by text:** f1 3, f2 31, f3 9, f4 5, f5 6. Many are citation numbers that a plain rewrite drops,
for example the case reports and statute sections in f2. Catching that is J05's job: `/jargone` moves such
detail to a reference file instead of losing it.

## Cost

$1.15 for 20 model calls: 10 for part 1, 5 rewrites and 5 J05 judgments. Part 2 used no model.

## Departure from the plan

The `claude` command's default model had changed since the first study, and that model had reached its usage
limit. The calls name the first study's model at run time instead, so the judge is the same as in the first
study. The model's name is kept out of the files.

## Retest of part 3 after the J05 fix

Run under [`RETEST-PLAN.md`](./RETEST-PLAN.md) (commit 9f3ebe7, fixed before the run), with J05 from commit feb399c
on the same five rewrites. Figures from [`retest-results.json`](./retest-results.json), built by
`scripts/score_retest.py`.

**J05 now reports 64 findings: 51 lost and 13 restated (20%).** Before the fix it was 75: 54 lost and 21 restated.

| Kind of finding | Lost | Restated |
|---|---|---|
| A number used once, gone from the rewrite | 44 | 0 |
| A number used several times, none left | 6 | 2 |
| A number used several times, still there but fewer times | 1 | 11 |

**What changed, finding by finding:**
- **Gone, as expected:** 9 of the 11 restatements the fix aimed at: 6 date parts, 2 list numbers and the thousands
  separator ("2300").
- **Still reported, but now meaning something else:** f1's "2" and f3's "01". The fix took away their dates and
  list numbers. What is left are other uses of the same numbers: the cross-references "paragraph (b)(2)" and
  "(c)(2)" in f1, and "Pub. 100-01" in f3. Judged again, both are restated: the rewrites state the exceptions
  themselves, and name the manual instead of its number.
- **New:** "11-08-21", the same date twice in the original and once in the rewrite (restated), and "July 27, 1966",
  now one lost date instead of two lost numbers.
- **Gone that had been judged lost:**
  - f4's "3", heading numbering, as the plan expected.
  - f3's "1966" and "27", now the one lost date above.
  - f1's "4". This is the label "(4)" opening a paragraph. The plan named only headings here, but the fix treats a
    paragraph's opening numbering the same way. The paragraph's content is in the rewrite ("An employer may
    decide to count work from before a break of more than seven years"), so this is not a real loss. The plan's
    rule to reopen the fix is not triggered.

**What remains is one choice.** 11 of the 13 restatements are numbers still in the rewrite, used fewer times.
The fix kept these as errors, saying "it is still there". Made warnings instead:
- J05's errors would be 52, of which 50 are real losses (96%);
- the one real loss among the 12 would still be shown, as a warning.

That choice is the maintainer's.

**Cost:** $0.10 for two judge calls.
