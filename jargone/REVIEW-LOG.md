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

## Added after round 3 (2026-10-31): not reviewed

At the maintainer's request, after the word-list research:
- the data files: the familiarity list as the common-word gate, the replacement list, and the
  technical-exceptions list, with their licences;
- check J07, a plainer word is available;
- session mode, section 13;
- the trial in build step 5: documents and sessions, coding and not.

No review round has run on these additions.

## The build (2026-10-31): version 0.1.0

Built from the specification by five builders (data; checker; method and docs; wiring and session
mode; integration), each checking its own work.
- **Tests:** 217 pass (112 plugin, 85 checker, 19 data, 1 word-list smoke test). Both validators
  pass.
- **Every test guards something.** Each part of the code was broken on purpose in a scratch copy, and
  at least one test failed each time:
  - the checker: 122 breaks;
  - the wiring: 199 breaks, 198 caught (the one left changes nothing);
  - the data build: 20 breaks;
  - integration: 42 breaks across J01–J07, the findings cap, the block-once rule and the system
    prompt section, after it added tests for 3 that first went uncaught.
- **Checked in the real engine** (`claude -p` with the plugin loaded): `/jargone-check` wrote its
  report; J05 found a broken link and a lost number; the model called the check tool; with
  `--rewrite` the rewrite request went back once, and the rewrite itself got a note, not a second
  request.

**Changes from the specification,** now reflected in it:
- the instant commands are `/jargone-check` and `/jargone-voice`, because a slash command is either a
  skill or answered by code, not both;
- the word lists ship as the generated module `hooks/data.ts`, since the loader reads code only;
- J05 counts content as moved only into `<name>-reference.md` listed in the moves file, so listing
  the saved original cannot hide a loss.

**Open for the maintainer:** what makes a reply "fail" in `--rewrite`. Today any finding does,
warnings included, while the method says a check passes when it has no errors.

**False alarms the builders saw,** for the trial: licence and standard names shaped like acronyms
(MIT, CC0); a hyphenated name such as ASD-STE100 that no definition form accepts; "plugin" and
"chose" missing from the familiarity list; J07's "it is" firing where it cannot be cut; J04 flagging
"Claude" and "/jargone".

**Not reviewed yet.** The integrator's own corrections, and the build as a whole, are owed an
independent review.
