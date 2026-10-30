# jargone — review log

How the specification (`SPEC.md`) was reviewed. Each round used two reviewers, both model runs,
read-only. One checked facts against the saved sources and the maintainer's decisions. The other read
it cold, as the maintainer and as the coder who will build it.

## Round 1 (2026-10-30): the whole draft

35 findings: 4 high, 19 medium, 12 low. The highs:
- it did not say what runs (a slash command, a model writing, reviewers that are model runs);
- it claimed to "prove" understanding;
- the pass mark relied on key points that no step collected;
- the nothing-lost check would have failed any heading reworded to remove jargon.

Most were applied as asked; some went in a different form. Two were not applied as asked:
- **Shortening the STE copyright detail** was set aside for the other reviewer's fuller and more
  accurate reading of the notice.
- **Cutting the Diátaxis section** was done only in part.

## Round 2 (2026-10-30): only the round-1 fixes

The maintainer asked for a second round on the fixes only.
- **Round-1 fixes:** 28 of 35 verdicts held, 6 partly, 1 not.
- **New problems the fixes caused or left:** 26, all medium or low, none high. Most were sections
  that one fix had made disagree with another:
  - the glossary allowed known acronyms, but J01 and J04 still refused them;
  - the table gave reviewers checks that their briefs in section 5 never mentioned;
  - the cold reader was never asked what it took away, so the key-point pass mark could not be met;
  - check mode ran checks that need a rewrite;
  - the paste form would have produced made-up readability scores;
  - "fresh reader" and "cold reader" named one thing twice;
  - J05 let a reworded heading break a link inside the same document;
  - this log's first version (then inside the spec) overstated what round 1 applied.

All were applied, and the round-1 items left partly done were finished, with two exceptions:
- **The copyright detail** stays at its fuller reading. A repeated sentence was cut, but the fuller
  list of groups keeps it the same length.
- **The Diátaxis section** was cut to three sentences, not the two asked. It keeps a sentence on the
  licence, which records the maintainer's decision.

The review history moved here from the spec. The readability numbers in the
spec's section 8 were re-run by the reviewer and match `research/readability-output.txt`.

## Round 3 (2026-10-30): only the round-2 fixes

The maintainer asked for a third round on the round-2 fixes only.
- **Round-2 fixes:** 29 of 33 verdicts held, 3 partly and 1 not. All four concern the two exceptions
  above; the log now states them accurately.
- **New problems:** 10, which come to 6 distinct, since both reviewers reported four of them. All are
  medium or low, none high. Only one was the "sections disagree" kind that dominated round 2:
  - a check run after a rewrite would overwrite the rewrite's report. Check now writes its own
    report;
  - "jargone ships no text from any of them" was false for the `dynamics` fixtures and Karpathy's
    phrase. It is now limited to the ISO, IPLF, ASD-STE100 and Diátaxis sources;
  - this log again overstated what was applied;
  - shortening the STE bullet dropped the "free to request" fact, and it promised eight groups but
    listed fewer;
  - in J04, "defined there" could be read as "defined in the glossary";
  - the checker's fix-and-recheck loop had no limit. It now stops after 3 tries. That number is a
    proposal for the maintainer to confirm.

All 6 were applied.

| Round | Checked | Findings (distinct) | High | Medium | Low |
|---|---|---|---|---|---|
| 1 | Whole draft | 35 (about 29) | 4 | 19 | 12 |
| 2 | Round-1 fixes | 26 (about 19) | 0 | 17 | 9 |
| 3 | Round-2 fixes | 10 (6) | 0 | 3 | 3 |

**Not reviewed.** Three rounds ran, each agreed by the maintainer. The round-3 fixes have not been
reviewed again.
