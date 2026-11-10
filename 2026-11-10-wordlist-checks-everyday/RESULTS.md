# Results: jargone's word-list checks on everyday documents

Run on 2026-11-10 under the plan in [`PLAN.md`](./PLAN.md) (commit c2b92b5, fixed before any result). The
texts and their sources are in [`SOURCES.md`](./SOURCES.md). Every figure here comes from
[`results.json`](./results.json), which `scripts/score.py` builds from `findings.json` and `judge/`.

## The rule's verdict

| Check | Findings | True | False alarms | Rule | Verdict |
|---|---|---|---|---|---|
| J01, term used before it is defined | 29 | 9 (31%) | 20: 12 known, 8 names | at least half true | **drop** |
| J04, the opening uses only common words | 2 | 1 | 1 name | at least 5 findings | **not enough findings**: the maintainer decides |
| J07, a plainer word is available | 6 | 5 (5 swaps fit) | 1 does not fit | at least half fit, at most 1 in 10 change the meaning | **keep** (none would change the meaning) |

- **J07's five swaps that fit:** "prior to" to "before" (twice), "ascertain" to "find out", "for a period of" to
  "for", "In order to" to "to". The one that did not fit: "commences" to "start" or "begin".
- **How much the lists catch:** the reader listed 192 terms it would not understand across the five texts. J01
  and J04 flagged 30 of them. As in the 0.1 trial, the lists miss most of what a reader would not know.
- **Cost:** $0.41 for the ten judge calls, one try each.

## A caveat that bears on J01's verdict (found after the results; not part of the rule)

The judge disagrees with itself. Its first call listed the terms it would not understand, before it saw any
finding. Its second call ruled on each finding. 11 flagged terms appear word for word in its first list. For 7 of
those 11, the second call said it would understand them:
- 4 as terms it knows: FMLA, delinquent, beneficiary and RNHCIs;
- 3 as names: NTSB, NHTSA and OMB.

The second call's options let a term count as understood because it is "a name". A lay reader may see that NTSB
names an agency without knowing what it is. The 0.1 trial used the same options, so the two are comparable, but
the flaw was in both.

Read by the first call instead, 19 of J01's and J04's 31 flagged terms (61%) are terms the reader said it would not
understand, matching whole words. With exact matches only, it is 11 of 31. So J01's verdict depends on which of
the judge's answers is believed: the rule's answer drops it; the first call's answer would keep it.

## Compared with the 0.1 trial

| Check | Trial: software documents | This test: everyday documents |
|---|---|---|
| J01 | 10 of 59 true (17%) | 9 of 29 true (31%) |
| J04 | 0 of 5 true | 1 of 2 true |
| J07 | 5 of 18 swaps fit (28%) | 5 of 6 swaps fit (83%) |

J07's list is not the trial's: after the trial, 0.2 cut it from 336 entries to 39. So its better showing here
comes from the cut as well as from the kind of text. Formal government prose is also where its entries ("prior
to", "in order to") are most common.

## Limits

- One model judge, one call per question. Real readers may differ, as in the trial.
- Five texts, one reader each. J04 and J07 had few findings: 2 and 6.
- The match between the reader's first list and the findings is by whole words, so a listed phrase such as
  "forfeiture procedures" counts as listing "forfeiture".
