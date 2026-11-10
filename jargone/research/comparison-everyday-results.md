# jargone against a one-line instruction: everyday set, results

> **Recovered record.** This is the report the everyday run wrote on 2026-11-05. The working machine was
> later replaced and the run's files were lost: the tasks, outputs, judges' files, scripts, `aggregate.json`
> and the pair key `human/key.json`. The report was recovered word for word from the session record, with
> only the model names removed. The files it names no longer exist, so its figures cannot be recomputed.

This report covers the everyday, non-coding extension of the comparison: the plan's addendum, written before any of
this set's output existed (mod-af commit fd90e02, `jargone/research/comparison-plan.md`). Every number below is read
from `aggregate/aggregate.json`, which is recomputed from the generators' and judges' per-output files, or from
`human/key.json`. The first run's numbers come from its `compare/aggregate/aggregate.json`, copied into this
`aggregate.json` (`first_run_comparison`). Tables round, mostly to one decimal. The maintainer's ratings are still to
come, so this is the verdict on the model measures only.

## Verdict on the model measures (maintainer's ratings pending)

**The best simple instruction is C3**, jargone's own standing instruction alone, by the pooled rate (the first run's
aggregation) and by the mean: pooled, 4.555 against 4.559 for C4 and 15.2 for C2. **The median picks C4** (2.4 against 3.1).
The first run had all three agree; here they do not. Pooled, it is a near tie: C3 has 40 terms in 8,781 words, C4 has
43 in 9,432, so one term more for C3, or one fewer for C4, would flip the pick. The rule was also applied against C4,
and its verdict is the same for replies and for documents (see `decision.*_against_C4_for_information` in
`aggregate.json`).

jargone made no rewrite of f1, f2 (the regulation and the court opinion). It declined them as legal text, as its
method says to. So the like-for-like document comparison covers the three documents every condition rewrote
(f3, f4, f5). It is the one shown here. The other reading is under **Documents** below.

| Part of the rule | Replies: C5 (session mode) vs C3 | | Documents f3–f5: `/jargone` vs one-shot C3 | |
|---|---|---|---|---|
| At least a third fewer unknown terms per 1,000 words | 1.7 vs 4.6: 62.7% fewer (mean: 64.8% fewer; median: 100.0% fewer) | **holds** | 5.1 vs 7.1: 28.7% fewer (mean: 19.9% fewer; median: 83.4% fewer) | **fails** |
| Key-point score no more than 5 points lower | 90.4 vs 91.2: 0.8 lower (pooled 0.7) | **holds** | 95.8 vs 100.0: 4.2 lower (pooled 4.2) | **holds** |
| No more accuracy errors | 30 vs 32 (false: 6 vs 3) | **holds** | 0 vs 1 (false: 0 vs 0) | **holds** |
| Maintainer prefers it in at least 7 of 10 pairs | pending: `human/pairs.md`, pairs 2, 3, 4, 6, 8 | – | pending: pairs 1, 5, 7, 9, 10 (in 5 and 10 jargone's side is not a rewrite; see below) | – |
| Documents only: rewrites produced | – | – | `/jargone` 3 of 5 (f1, f2 declined); each one-shot 5 of 5 | reported |
| Documents only: "nothing lost" (J05) | – | – | `/jargone` 0 with its reference file, 49 with it hidden; C3 9 (restated numbers, not losses, by the generator's hand check) | reported |
| Documents only: meaning changes (false claims against the original) | – | – | `/jargone` 0, C3 0 | reported |

Task by task, against C3, C5 had:
- fewer unknown terms on 13 of 20 replies, the same on 3, and more on 4;
- a lower key-point score on 4, a higher one on 4, and the same on 12;
- more accuracy errors on 7, fewer on 6, and the same number on 7.

**Replies: all three model measures hold.** C5 has 62.7% fewer unknown terms than C3 pooled, and it clears a third by
mean and median too. Its key-point score is 0.8 points lower, inside the 5-point margin. It has 30 accuracy errors against
32. Against C4 the result is the same: 62.7% fewer pooled, 2.9 key points lower,
and 30 errors against 34. Three things temper this:
- **The counts are small.** C3 already has only 40 unknown terms across 20 replies. C5 has
  17.
- **C5 has the most false claims of any condition** (6, against 3 for C3). The rule counts
  false and unsupported claims together, so it still passes.
- **The person reads two texts.** In use, the person reads the first reply and then the rewrite. Counted that way, C5's rate is
  3.7, 19.4% below C3, short of a third (post hoc; see Diagnostics).

**Documents: the unknown-terms part fails, like for like.** On f3, f4, f5, `/jargone`'s reader-facing file has
28.7% fewer unknown terms than C3's one-shot pooled and 19.9% fewer by mean, so it fails. By median it has 83.4% fewer.
Its key-point score is 4.2 points lower, inside the margin, and it has 0 accuracy errors against 1. Both hold.
Against C4, the one-shot with the fewest unknown terms on these documents, jargone has **more** unknown terms
(5.07 against 3.98 pooled). Three documents are few: 13 of jargone's 14 terms are
in f3 alone.
- **The other reading passes, but it compares different documents.** It scores each condition over its own rewrites:
  jargone over 3 documents, C3 over 5. Read that way, jargone has 44.6% fewer pooled, 40.0% fewer by mean and
  92.2% fewer by median, and every part holds (`decision.documents_own_rewrites_for_information`).
- **Why I did not use it:** that comparison counts C3 on the two legal texts and leaves them out for jargone.
  C3 scored 12.4 on those two, against 7.1 on the other three. Leaving them out flatters jargone, and it ignores
  that jargone gave those two readers no rewrite. I read the like-for-like comparison as the rule's. The maintainer
  should confirm this (Departures, item 2).

**What the maintainer's ratings can still change.** The plan says: "If the maintainer's ratings and the model measures
disagree, the maintainer's ratings decide, and the disagreement is reported."
- **The plan sets one count, 7 of 10, over a mixed set.** Pairs 2, 3, 4, 6, 8 are replies and pairs 1, 5, 7, 9, 10 are documents. The plan does
  not say how to split the count when the rule is applied to replies and documents separately.
  - With no real preference, one side gets 7 or more of 10 picks with probability 0.172.
  - It gets 4 or more of 5 with probability 0.188 (binomial, in `aggregate.json`).
- **In pairs 5 and 10 (f1, f2), jargone's side is not a rewrite.** It is the separate plain-language file jargone wrote after
  declining. The original was left unchanged. Count those two either way; `human/key.json` marks them.
- **The addendum's decision does not name this outcome.** It says: "If jargone fails on both sets, the best simple
  instruction ships everywhere. If it passes only on everyday documents, the recommendation is a document tool (the chat
  Skill) plus the instruction for sessions. If it passes on both, it stays a plugin."
  - On the model measures so far, jargone fails on the first set, on replies and on documents.
  - On this set it passes on replies and fails on documents (like for like).
  - "Passes only on everyday replies" is none of the three cases. Both sets' human ratings are still pending.

## The numbers

Pooled = all terms ÷ all words × 1,000 for the condition. Middle half = the 25th to 75th percentile of the per-output
values. Accuracy errors are false or unsupported claims; correct general knowledge the task did not give is listed
separately and not scored (judge's rule, fixed before the run). Seconds are the CLI's own `duration_ms`, so a
background reviewer's time is left out; wall-clock time includes it. C5's tokens, seconds and cost include its check
and rewrite. Each output was judged as written for its own task's reader (25 different readers).

### Replies, all 20 everyday tasks

| | C1 | C2 | C3 | C4 | C5 |
|---|---:|---:|---:|---:|---:|
| **Unknown terms per 1,000 words** (pooled) | **16.6** | **15.2** | **4.6** | **4.6** | **1.7** |
| … per reply: mean | 16.1 | 15.3 | 4.2 | 4.7 | 1.5 |
| … per reply: median (middle half) | 16.5 (9.3–20.6) | 16.2 (10.1–19.3) | 3.1 (0.0–6.4) | 2.4 (1.1–6.0) | 0.0 (0.0–2.2) |
| … per reply: lowest–highest | 0.0–40.1 | 0.0–35.4 | 0.0–15.5 | 0.0–19.5 | 0.0–8.6 |
| … terms / words | 149 / 8,958 | 125 / 8,239 | 40 / 8,781 | 43 / 9,432 | 17 / 9,997 |
| **Key-point score** (mean; pooled) | **89.8**; 89.6 | **91.7**; 91.0 | **91.2**; 91.0 | **93.3**; 93.3 | **90.4**; 90.3 |
| … got / partly / missed | 56 / 8 / 3 | 56 / 10 / 1 | 56 / 10 / 1 | 60 / 5 / 2 | 57 / 7 / 3 |
| … replies at 100; lowest | 11; 66.7 | 11; 62.5 | 11; 66.7 | 13; 66.7 | 12; 66.7 |
| **Accuracy errors** (of which false) | **27** (3) | **32** (4) | **32** (3) | **34** (2) | **30** (6) |
| … per reply: median (lowest–highest) | 1 (0–6) | 1 (0–8) | 1 (0–8) | 2 (0–6) | 1 (0–9) |
| … replies with any error | 12 of 20 | 16 of 20 | 11 of 20 | 15 of 20 | 13 of 20 |
| … correct general claims (not scored) | 160 | 107 | 135 | 153 | 175 |
| **Words** (total) | 8,958 | 8,239 | 8,781 | 9,432 | 9,997 |
| … per reply: median (lowest–highest) | 436 (248–670) | 404 (190–604) | 448 (232–635) | 466 (256–687) | 508 (255–742) |
| **Tokens** in / out | 206,097 / 23,564 | 210,730 / 22,175 | 207,973 / 21,369 | 220,010 / 22,326 | 614,233 / 62,468 |
| **Seconds** (CLI run time), total; median | 326; 15.1 | 313; 14.8 | 315; 15.1 | 299; 14.8 | 747; 36.6 |
| … wall-clock seconds, total | 439 | 437 | 431 | 428 | 1,067 |
| **Cost, USD** | 0.92 | 0.93 | 0.93 | 0.97 | 1.88 |

### C5: the check and the rewrite

| | All 20 |
|---|---:|
| Replies rewritten | 19 of 20 |
| Not rewritten (no term left) | e01 |
| Terms the check listed / kept after the filter | 195 / 94 |
| Terms kept per reply: median (lowest–highest) | 4.5 (0–9) |
| First reply: tokens in / out; seconds; USD | 218,731 / 22,028; 311; 0.96 |
| Check (small model): tokens in / out; seconds; USD | 144,372 / 20,293; 172; 0.024 |
| Rewrite: tokens in / out; seconds; USD | 251,130 / 20,147; 263; 0.90 |
| Check + rewrite: tokens in / out; seconds; USD | 395,502 / 40,440; 435; 0.92 |
| Check + rewrite: share of C5's cost | 49.0% |
| Words: first replies / final replies | 8,867 / 9,997 |
| Words the person reads (first reply + rewrite) | 18,530 |
| C5 cost, USD (net of the resumed reply) | 1.88 |

The person reads the first reply and then the rewrite. Counting both, C5's rate is 3.7 unknown terms per 1,000
words (68 terms in 18,530 words), 19.4% below C3.
- The term filter dropped 88 of the 195 listed terms as already in the task's prompt, and 13 as defined in the reply.
- 66 of those 88 occur only in the prompt's `Context (from …)` block of agency text. They are not in the
  person's own words: the generator's open question, recounted here with its own matcher.
- Under a request-only rule, those terms could also have gone to the rewrite.

### Documents, like for like (f3, f4, f5: the documents every condition rewrote)

| | C2 | C3 | C4 | jargone |
|---|---:|---:|---:|---:|
| Documents | f3, f4, f5 | f3, f4, f5 | f3, f4, f5 | f3, f4, f5 |
| **Unknown terms per 1,000 words** (pooled) | **18.7** | **7.1** | **4.0** | **5.1** |
| … per document: mean | 18.1 | 6.9 | 4.0 | 5.5 |
| … per document: median (middle half) | 18.6 (11.3–25.2) | 4.8 (3.7–9.0) | 2.5 (2.1–5.2) | 0.8 (0.4–8.3) |
| … per document: lowest–highest | 4.0–31.8 | 2.7–13.2 | 1.7–7.8 | 0.0–15.8 |
| … terms / words | 61 / 3,263 | 24 / 3,375 | 14 / 3,518 | 14 / 2,763 |
| **Key-point score** (mean; pooled) | **100.0**; 100.0 | **100.0**; 100.0 | **100.0**; 100.0 | **95.8**; 95.8 |
| … got / partly / missed | 12 / 0 / 0 | 12 / 0 / 0 | 12 / 0 / 0 | 11 / 1 / 0 |
| … documents at 100; lowest | 3; 100.0 | 3; 100.0 | 3; 100.0 | 2; 87.5 |
| **Accuracy errors** (of which false) | **0** (0) | **1** (0) | **1** (0) | **0** (0) |
| … per document: median (lowest–highest) | 0 (0–0) | 0 (0–1) | 0 (0–1) | 0 (0–0) |
| … documents with any error | 0 of 3 | 1 of 3 | 1 of 3 | 0 of 3 |
| … correct general claims (not scored) | 7 | 36 | 36 | 14 |
| **Words** (total) | 3,263 | 3,375 | 3,518 | 2,763 |
| … per document: median (lowest–highest) | 1,131 (999–1,133) | 1,131 (1,034–1,210) | 1,171 (1,153–1,194) | 824 (694–1,245) |
| **Tokens** in / out | 39,511 / 10,673 | 34,616 / 9,043 | 34,678 / 9,514 | 3,090,486 / 86,134 |
| **Seconds** (CLI run time), total; median | 101; 31.7 | 91; 32.9 | 92; 29.4 | 194; 64.0 |
| … wall-clock seconds, total | 115 | 107 | 109 | 762 |
| **Cost, USD** | 0.33 | 0.29 | 0.30 | 4.14 |
| Original words | 2,626 | 2,626 | 2,626 | 2,626 |
| Reference-file words (moved out) | 0 | 0 | 0 | 1,268 |
| J05 losses (with the reference file) | 10 | 9 | 6 | 0 |
| J05 losses with the reference file hidden | – | – | – | 49 |

### Documents, each condition's own rewrites (for information: jargone has 3, the others 5)

| | C2 | C3 | C4 | jargone |
|---|---:|---:|---:|---:|
| Documents | f1, f2, f3, f4, f5 | f1, f2, f3, f4, f5 | f1, f2, f3, f4, f5 | f3, f4, f5 |
| **Unknown terms per 1,000 words** (pooled) | **22.5** | **9.1** | **8.0** | **5.1** |
| … per document: mean | 22.2 | 9.2 | 8.6 | 5.5 |
| … per document: median (middle half) | 22.8 (18.6–31.8) | 10.3 (4.8–13.2) | 7.8 (2.5–10.6) | 0.8 (0.4–8.3) |
| … per document: lowest–highest | 4.0–33.6 | 2.7–15.1 | 1.7–20.2 | 0.0–15.8 |
| … terms / words | 116 / 5,153 | 50 / 5,469 | 45 / 5,592 | 14 / 2,763 |
| **Key-point score** (mean; pooled) | **100.0**; 100.0 | **100.0**; 100.0 | **100.0**; 100.0 | **95.8**; 95.8 |
| … got / partly / missed | 20 / 0 / 0 | 20 / 0 / 0 | 20 / 0 / 0 | 11 / 1 / 0 |
| … documents at 100; lowest | 5; 100.0 | 5; 100.0 | 5; 100.0 | 2; 87.5 |
| **Accuracy errors** (of which false) | **0** (0) | **2** (1) | **2** (0) | **0** (0) |
| … per document: median (lowest–highest) | 0 (0–0) | 0 (0–1) | 0 (0–1) | 0 (0–0) |
| … documents with any error | 0 of 5 | 2 of 5 | 2 of 5 | 0 of 3 |
| … correct general claims (not scored) | 21 | 54 | 66 | 14 |
| **Words** (total) | 5,153 | 5,469 | 5,592 | 2,763 |
| … per document: median (lowest–highest) | 1,101 (789–1,133) | 1,131 (929–1,210) | 1,153 (941–1,194) | 824 (694–1,245) |
| **Tokens** in / out | 59,613 / 18,409 | 55,067 / 13,468 | 60,581 / 13,819 | 3,090,486 / 86,134 |
| **Seconds** (CLI run time), total; median | 176; 31.7 | 140; 25.4 | 137; 26.6 | 194; 64.0 |
| … wall-clock seconds, total | 211 | 169 | 165 | 762 |
| **Cost, USD** | 0.55 | 0.45 | 0.46 | 4.14 |
| Original words | 4,194 | 4,194 | 4,194 | 2,626 |
| Reference-file words (moved out) | 0 | 0 | 0 | 1,268 |
| J05 losses (with the reference file) | 11 | 10 | 7 | 0 |
| J05 losses with the reference file hidden | – | – | – | 49 |

Unknown terms per 1,000 words by document (terms / words):

| Document | C2 | C3 | C4 | jargone |
|---|---:|---:|---:|---:|
| f1 | 22.8 (18 / 789) | 15.1 (14 / 929) | 20.2 (19 / 941) | no rewrite |
| f2 | 33.6 (37 / 1,101) | 10.3 (12 / 1,165) | 10.6 (12 / 1,133) | no rewrite |
| f3 | 31.8 (36 / 1,133) | 13.2 (16 / 1,210) | 7.8 (9 / 1,153) | 15.8 (13 / 824) |
| f4 | 4.0 (4 / 999) | 4.8 (5 / 1,034) | 1.7 (2 / 1,171) | 0.8 (1 / 1,245) |
| f5 | 18.6 (21 / 1,131) | 2.7 (3 / 1,131) | 2.5 (3 / 1,194) | 0.0 (0 / 694) |

- **jargone's cost includes the declined runs.** Its runs on f1, f2 did work too: each ran one review round and wrote a
  separate file. With those runs, jargone's five runs cost 6.27 USD, 4,665,648 tokens in and
  133,971 out, and 1,233 wall-clock seconds. The two declined runs account for 2.13 USD of that.
  The one-shot C3 rewrites of all five cost 0.45 USD.
- **jargone's tokens include its reviewer subagents.** Its seconds leave out reviewers that ran in the background, so
  its wall-clock time is the fairer cost figure.
- **The companion files** for f1, f2 are supplementary and never in a figure above. Their figures:
  - unknown terms: 10.1 (f1) and 10.3 (f2) per 1,000 words, 10.2 pooled. C3's rewrites of the same two score
    12.4.
  - key points: 100 and 100.
  - accuracy errors: 1 and 0.

### Checks behind the numbers

- `aggregate/aggregate.py` recomputes every figure from the per-output files and runs 1,859 checks. All passed:
  - word counts agree between generators, judges and the texts on disk;
  - every output's sha256 matches;
  - every output has all three scores;
  - each score recomputes from its parts;
  - each judge used the task's own reader;
  - each C5 rewrite's cost is net of its resumed reply, checked against the raw calls;
  - every term the filter dropped as "in the prompt" is in the prompt;
  - the per-condition figures equal each judge's and generator's own summary;
  - the documents not rewritten agree across all three judges.
- **The checks have teeth.** `aggregate/selfcheck/selfcheck.py` runs the aggregator on three tampered copies, and
  each one fails (3, 2 and 2 checks); the untampered copy passes (`selfcheck.json`):
  - one more unknown term on e05-C3, with its rate kept consistent. That alone moves the pooled pick to
    C4;
  - e02's rewrite cost made gross, as the first run's coding file recorded it;
  - f4-jargone's partly key point turned into got.
- **No cost seam this time.** `gen/everyday` already nets each rewrite, and `gen/docs` nets each resumed jargone turn
  (its README, item 4). In the first run, the aggregation had to correct the coding C5 rows.
- **The pairs page round-trips.** `aggregate/verify_pairs.py` runs 56 checks on `human/pairs.md`, and all pass
  (`human/verify-pairs.json`):
  - all 20 texts unquote back to their source files byte for byte, on the sides the key gives;
  - each question line is the task's own;
  - the draw reproduces from its seed;
  - no condition name appears on the page.

## Diagnostics added after the results (not part of the plan's rule)

- **How sure is "a third fewer" on replies?** Resampling the 20 reply tasks (10,000 draws, the first run's seed 20261031)
  puts C5's reduction against C3 between 24.4% and 86.9% (95% of draws). 94.9% of draws reach a third.
- **Two samples of one instruction differ by almost the plan's margin.** C5's first reply was written under C3's
  `CLAUDE.md` text, so it is a second sample of C3. It scored 5.9 against C3's 4.6, 28.7% more, and was
  lower on only 9 of 20 tasks. In the first run the two samples were 3.4% apart.
- **So the gain comes from the check and rewrite.** In the same conversations, the rewrite took the 19 rewritten
  replies from 51 terms to 16 (6.0 to 1.7 per 1,000 words). It lowered the rate on 14 of 19 and left 3 the same.
- **The accuracy gaps are no bigger than two samples of one instruction.** On the 19 rewritten tasks:
  - C5's first reply had 30 errors, C3 had 30 and the rewrite had 29.
  - Task by task, the first reply had more errors than C3 on 4, fewer on 6 and the same on 9.
  - False claims: the first reply 7, C3 2, the rewrite 6. So C5's extra false claims were
    already in the first reply, which used the same instruction as C3.
- **One task carries a lot.** e19 has 34 of the 155 reply errors across all conditions. Without it, C5 has
  21 and C3 24, so the accuracy part holds either way.
- **The first run's tool scan finds nothing here.** It looks for replies that say they lack a tool or a permission:
  0 hits in 100 final replies and 19 first replies.

## Compared with the first run

The first run had 30 replies from software work (15 coding, 15 not) for one reader, "a non-specialist maintainer", and
five software project documents (READMEs, a handover, a details file). This set has different tasks, different readers and different documents. So the
two runs are not two samples of one population, and the gaps below describe the two sets, not a trend.

| | First run: all 30 replies | First run: non-coding 15 | Everyday: 20 replies |
|---|---:|---:|---:|
| No instruction (C1), pooled | 31.4 | 33.8 | 16.6 |
| Karpathy's line (C2), pooled | 31.3 | 30.4 | 15.2 |
| jargone's standing instruction (C3), pooled | 23.5 | 23.9 | 4.6 |
| C2 and C3 together (C4), pooled | 23.8 | 23.9 | 4.6 |
| Session mode (C5), pooled | 17.9 | 17.4 | 1.7 |
| C5 against C3, pooled | 23.8% fewer | 27.5% fewer | 62.7% fewer |
| … 95% of bootstrap draws | 10.3%–35.9% | – | 24.4%–86.9% |
| Key points, C5 below C3 (mean) | 3.2 | 2.8 | 0.8 |
| Accuracy errors, C5 vs C3 | 85 vs 74 | 42 vs 34 | 30 vs 32 |
| Model measures on replies | fail (unknown terms, accuracy) | – | all hold |
| Cost, C3 / C5, USD | 1.50 / 2.69 | 0.80 / 1.48 | 0.93 / 1.88 |

| Documents | First run (5) | Everyday, like for like (3) |
|---|---:|---:|
| jargone rewrites produced | 5 of 5 | 3 of 5 |
| Unknown terms, jargone vs C3, pooled | 9.3 vs 10.5 (11.1% fewer) | 5.1 vs 7.1 (28.7% fewer) |
| Accuracy errors, jargone vs C3 (jargone's false) | 28 vs 13 (3) | 0 vs 1 (0) |
| Key points, jargone vs C3 (mean) | 4.0 higher | 4.2 lower |
| jargone's reference files, pooled | 49.2 | 41.0 |
| Model measures on documents | fail (unknown terms, accuracy) | fail (unknown terms) |

- **Every condition scored far plainer on everyday tasks.** The ratio of everyday to first-run pooled rates runs from
  0.53 (C1) to 0.095 (C5).
  - One likely reason: each everyday request names its reader in the person's own words, so even C1 has a reader
    to write for, and the judge reads as that same person. This run cannot separate the reader from the topics.
  - So compare the conditions within a run, not the rates across runs.
- **jargone's standing instruction did much more here.** C3 cut unknown terms by 72.6% against no instruction, against
  25.0% in the first run. C5 reached 89.8%, against 42.9%.
- **Karpathy's line again did little.** C2 is 8.8% below C1 here and 0.2% in the first run.
- **C3 and C4 nearly tie in both runs** (23.5 and 23.8 in the first; 4.555 and 4.559 here). Adding
  Karpathy's line to C3 again changed little.
- **The replies verdict flipped.** The first run failed on unknown terms (about a quarter fewer, not a third) and on
  accuracy. This set passes all three, with a bootstrap interval that sits mostly above a third.
  - The accuracy part is the least stable. In the first run, C5's first reply (a second sample of C3's instruction) had
    78 errors on the rewritten tasks against C3's 71. Here the two samples tie on errors
    (30 and 30) but have 7 and 2 false claims.
- **On documents, jargone was more accurate here but had less to show.** The first run's jargone made the only false
  claims (3). Here it made none on its three rewrites. Among the one-shots, C3 made 1 false claim (f2). But jargone declined
  two of five everyday documents, where the first run's jargone rewrote all five. On the three it rewrote, it still
  missed a third.
- **The key-point measure is at its ceiling in both runs.** 75 of 118 outputs scored 100 here, against 106 of 170
  in the first run. On documents it cannot tell the one-shots apart: all 15 scored 100.
- **The first run's document cost may be overstated.** This run's documents generator found a seam that may affect the
  first run (`gen/docs/README.md`, item 4). When a run is resumed, the second turn's reported tokens and cost already
  include the first turn's, and the first run's documents generator added the two.
  - If so, the first run's trial d1 jargone row counts turn 1 twice (362,496 tokens in, 1,888 out, $0.384077, as that
    README gives them).
  - That would make the first run's jargone document cost of 9.26 USD too high by that amount.
  - It was not verified, and the first run's files were not changed.
- **How the method differed from the first run:**
  - Each task has its own reader, named in the request. The judges and C5's check use that reader.
  - There is no coding/non-coding split.
  - C5 used one phrase-matching term filter for all tasks; the first run used two.
  - Every jargone run is new, in a folder that holds only the document; the first run reused the trial for d1–d3 and
    could read the repository.
  - The CLI is version 2.1.318; the first run used 2.1.316.

## What surprised me

1. **Everyday replies were plain even with no instruction.** C1 scored 16.6 unknown terms per 1,000 words, about half
   the first run's 31.4. The named reader in each request may be why; this run cannot tell.
2. **jargone's standing instruction cut that by 72.6%** at about the same cost (0.93 against 0.92 USD).
   C5's check and rewrite then cut most of what was left. They took 49.0% of C5's
   cost, nearly all of it the rewrite; the small-model checks cost 0.024 USD for all 20.
3. **The same instruction, run twice, gave 28.7% more unknown terms the second time.** That gap is almost the
   size of the plan's margin. A one-third rule on 20 tasks is coarser than it looks.
4. **jargone refused two of the five everyday documents.** These were the regulation excerpt and the court opinion
   excerpt, two of the five kinds of text the addendum chose for everyday readers. Its method says legal text is not
   covered. Every one-shot rewrote both, with every key point and at most 1 accuracy error each.
5. **Rewrites made replies longer, again.** The rewrites added 1,130 words over 19 replies. Every
   one-shot document rewrite of C3 and C4 was longer than its original (5 of 5 and 5 of 5). jargone's was longer on 1 of 3.
6. **jargone's documents again look plain partly because the hard parts moved out.** Its reference files score
   41.0 unknown terms per 1,000 words. Counting them, jargone's documents score 16.4.

## Limits

- **One writer model.** Every reply and rewrite came from one large model, and the C5 check from one small, fast model.
- **Model judges.** All three measures were judged by the writer's own model, once per output. Their
  run-to-run variation was not measured. One unknown-terms item (e15-C5) answered differently on a retry; see
  `judge/README-unknown-terms.md`.
- **The primary judge's brief is close to C5's own check brief, more so than in the first run.** Both name the same
  per-task reader and both list words "you would not understand". C5 was rewritten against a near copy of the measure,
  which favours it.
- **C5 was emulated by script, not run as the jargone 0.2 plugin.** Its filter counts the prompt's agency-text
  `Context` block as words the reader already has (66 of 88 drops), which a 10-year-old or a retired reader may not.
- **Small counts.** C3 has 40 unknown terms over 20 replies and C5 17. The like-for-like document comparison has 3 documents, and
  13 of jargone's 14 terms are in one of them.
- **Words** are counted by splitting on spaces, so Markdown marks count as words.
- **The declined documents.** After jargone declined, the first run's scripted resume ("Confirmed: use those key points
  as drafted, and run 1 review round.") did not answer its offer to write a separate file. The model took it as a yes.
  - The companion files exist only because of that.
  - In chat, a person might have said no, or asked for a rewrite anyway.
- **The human pairs show C5's final text only.** In use, the person would also see the first reply above the rewrite.
- **Hints in the texts.** jargone's f3 and f5 rewrites link to a reference file. Its companion files link to the original.
  C3's rewrites have no links (`human/key.json`, notes).
- **Seconds include shared load.** Several generators and judges ran at once.
- **No independent review of these scripts.** The checks above are my own. No independent adversarial pass was run on
  `aggregate/*.py`. Every step before this one says the same of its own scripts.

## Departures and choices in this step

1. **Best simple instruction.** The aggregations disagree: pooled and mean pick C3, the median picks C4. The pick
   stays pooled, the first run's aggregation, and the rule was also applied against C4. The first run's script asserted
   that they agree; that assertion became a recorded disagreement.
2. **Documents: like for like (f3, f4, f5) is read as the rule's comparison.** Each condition over its own rewrites is
   given for information. f1, f2 are never scored as 0 and never as the unchanged original, which no judge scored.
   **For the maintainer to confirm.**
3. **"Best one-shot" for documents is C3**, the best simple instruction chosen on replies, as in the first run. C4,
   the lowest on these documents, is shown for information.
4. **"Meaning changes found"** (documents) is read as the accuracy judge's false claims, as in the first run.
5. **Key-point part:** both the mean and the pooled score were checked; both pass on both sets.
6. **Human pairs.** These choices are fixed in `aggregate/pick_pairs.py`'s method, and the draw happened once (seed 902564499):
   - Replies and documents were shuffled together.
   - For f1, f2, jargone's side is its companion file, its only reader-facing text for those documents. This is the
     closest thing to "the reader-facing text" that exists; the key marks the pairs.
   - A text over 600 words is flagged as long, never cut.
   - A reply's question is the prompt up to `Context (from …)`; the first run split at `Context:`.
   - The page was scanned for condition names before the draw, over every candidate text, and again after.
7. **Human count.** The plan's "7 of 10" is reported over all ten pairs. How to split it between replies and documents
   is left to the maintainer (see the verdict).
8. **Diagnostics:** the first run's n05 sensitivity is dropped (there is no such task). New: the Context-only filter
   drops, the largest task's share of accuracy errors, the companion files, and the comparison with the first run. All
   are post hoc.

## The human pairs

`human/pairs.md` holds 10 pairs:
- **5 replies** (e02, e03, e06, e14, e20): C3 against C5's final reply.
- **5 documents** (f1, f2, f3, f4, f5): C3's one-shot rewrite against `/jargone`'s reader-facing text. In pairs
  5 and 10 that text is a companion file.

jargone's condition is on side A in 5 of the 10. The key is `human/key.json`. When the ratings are in:
- count the pairs where the maintainer picked jargone's side, over all 10 and over the 8 that are not companion files;
- apply the last part of the rule.

## Files

- `aggregate/aggregate.py` → `aggregate/aggregate.json`: every figure, the checks, the rule, per-output rows, and the
  first run's figures for comparison.
- `aggregate/pick_pairs.py` → `human/pairs.md`, `human/key.json`; `aggregate/verify_pairs.py` → `human/verify-pairs.json`.
- `aggregate/render_summary.py` → this file.
- `aggregate/selfcheck/selfcheck.py` → `aggregate/selfcheck/selfcheck.json`: the tamper self-check.
- `aggregate/*.diff-vs-first-run.txt`: each script against the first run's.
