# Results: the iso-24495 text audit on the five government texts

Run on 2026-11-15 under [`PLAN.md`](./PLAN.md) (commit 97396a4, fixed before the run). The audit's raw findings are in
`audit/`. Figures come from [`results.json`](./results.json), built by `scripts/score.py` from the judges' answers
(kept off this branch) into [`verdicts.json`](./verdicts.json), and from Claude's checks in
[`hand-checks.json`](./hand-checks.json).

The audit found 84 things on the five texts. By group, set beside jargone's checks on the same texts:

| Group | The audit's rules | Findings | True | jargone on the same texts |
|---|---|---|---|---|
| 1. A word the reader may not know | `acronym-undefined` | 15 | 2 (13%) | J01: 9 of 29 (31%), then 5 of 29 (17%) with the same judging |
| 2. A plainer word is available | `wordy-phrase`, `complex-word` | 10 | 7 fit (70%), none would change the meaning | J07: 5 of 6 fit, none would change the meaning |
| 3. Counting | `sentence-length` | 40 | 37 counts right; the other 3 are real long sentences counted short | J03: the same long sentences, with the same 3 short counts and misses |
| | `paragraph-length` | 10 | 3 counts right; 3 more are over the limit with a wrong count; 4 false | no such check |
| | `sentence-average` | 2 | 2 | J06 reports averages, for information |
| 4. Structure | `heading-style` | 7 | 3 | no such check |

**Group 1.** The reader explained 13 of the 15 acronyms. It could not explain "CFR" in the leave regulation or
"U.S.C." in the poverty notice. Two findings were names in capitals in the court opinion's caption ("TYLER",
"COUNTY"). One judge call can vary: NHTSA was explained here, but not in the J01 follow-up.

**Group 2.** The swaps that fit were "prior to" to "before" (three times), "ascertain" to "find", "terminate" to "end",
"in order to" to "to" and "commences" to "starts". The ones that did not fit were "for the purpose of" to "to" and
"thereof" to "its" (twice).

**Group 3: what went wrong.** The audit ends sentences at "Pub." and "U.S.C.", as jargone's checker does without the
added abbreviations. So:
- **Sentence length:** it counted two Medicare sentences short (40 for 45 words, 53 for 64) and one poverty-notice
  sentence short (35 for about 48). It missed 4 long sentences: 3 in the Medicare text, 1 in the poverty notice.
- **Paragraph length:** two Medicare paragraphs of 5 sentences were counted as 6 and 10. Two poverty-notice "paragraphs"
  are several short paragraphs run together. The notice marks paragraphs by indenting their first line, and the
  audit reads only blank lines.

On sentence length, the audit counts every word of a quotation, and jargone counts a quotation as one word. So one
32-word quotation in the court opinion is over the audit's limit and not over jargone's. That is a rule, not an
error.

**Group 4.** Three heading findings are true: a full stop at the end of a heading, and two titles of 13 words. Four
are false. One is the court opinion's title, read as two sentences because of "v.". Three are rows of the poverty
table, which the audit read as headings because of a line of dashes under them.

**Cost:** $0.45 for 7 model calls.

## What this says

- **Word lists fail as judges of what a reader knows, in both tools.** The audit's acronym rule, like jargone's J01,
  was mostly wrong about what this reader would not understand.
- **Swap lists work on formal government writing, in both tools.** Most of the suggestions were the same stock
  phrases.
- **Sentence counting works, and shares one weakness.** Both tools miss long sentences when a legal or government
  abbreviation ends with a full stop.
- **The audit claims no more than this.** It calls its findings "mechanical proxies, not an ISO judgement", and its
  code calls the 30-word cap "this project's own proxy". Those claims hold up. What fails is using such checks to
  judge what a particular reader understands, which neither tool can see.

## Addendum: is jargone's check on par? (2026-11-15, after the results)

At the maintainer's question, the audit was also run on the five long-form articles of
`../2026-11-15-checks-longform/` (no model calls, so no judging), and its long-sentence and plainer-word findings
were set beside J03's and J07's on the same articles.

**Long sentences.** The audit flagged 169 sentences over 30 words: L1 37, L2 21, L3 32, L4 41, L5 38. J03 flagged 145.
- **The audit ends a sentence at a full stop inside a closing quotation mark; J03 does not (JAR-005).** At the places
  the long-form test checked by hand, the audit splits L3's 91-word "sentence" into its real 36 and 55 words. It
  does not flag the three sentences J03 invented by joining two short ones: 31 words at L1 line 3, 51 at L3 line 55
  and 43 at L3 line 71.
- **The audit counts every word of a quotation; J03 counts a quotation as one word.** That accounts for most of the
  audit's extra flags. A long quoted sentence is still long to read, so the audit's rule is closer to the reader;
  J03's rule spares the writer quotations they cannot change.
- **On the government texts,** both tools miss the long sentences at "Pub.". J03 reads "U.S." and "U.S.C." correctly,
  so it caught one long sentence the audit missed and counted another right that the audit counted short.

**Plainer words.** Both lists are small: the audit has 25 wordy phrases and 25 complex words; J07's trimmed list has
39 entries. On the government texts, the audit made 10 suggestions with 7 fitting, and J07 made 6 with 5 fitting. On
the long-form articles, the audit made 4 (among them "expedite" to "hasten", which is not plainer) and J07 made 3.
The long-form suggestions were not judged.
