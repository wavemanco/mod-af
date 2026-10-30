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

All were applied, and the round-1 items left partly done were finished, except the copyright detail,
which stays at its fuller reading (now one sentence shorter). The Diátaxis section was cut
to three sentences, and the review history moved here from the spec. The readability numbers in the
spec's section 8 were re-run by the reviewer and match `research/readability-output.txt`.

**Not reviewed.** Two rounds were agreed and both ran, so the round-2 fixes have not been reviewed
again.
