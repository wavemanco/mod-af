# Do jargone's word-list checks work on everyday documents? (plan, fixed before any results)

Written 2026-11-10, before any check was run on these texts, at the maintainer's request.

## The question

The 0.1 trial (`../2026-10-31-trial/trial.md`) tested J01, J04 and J07 on software documents, and on
replies from one working session on software projects. There, most of their findings were false
alarms: 82% on documents and 93% on replies. Most false alarms were words the reader already knew,
which may be a feature of technical text. Do these checks do better on everyday documents for
everyday readers? The answer decides whether jargone's next version drops them, or keeps J01 and
J04 as optional hints for everyday audiences.

## The texts

Five public-domain United States government texts, 400 to 1,000 words each, each for a named
everyday reader. They come from the same five sources the everyday comparison used (its copies were
lost with the working machine), cut afresh. Each is saved here with its source URL, retrieval time
and sha256 before any check runs. If a source cannot be fetched, a similar public-domain text takes
its place, and this is recorded.

| Id | Source | Reader |
|---|---|---|
| f1 | 29 CFR 825.110, eligibility for family and medical leave | an hourly warehouse employee |
| f2 | *Tyler v. Hennepin County*, Supreme Court opinion, 2023 | a retired homeowner who has fallen behind on her property taxes |
| f3 | CMS Medicare Benefit Policy Manual, chapter 8, section 20 (the 3-day hospital stay rule) | the adult daughter of a Medicare patient |
| f4 | NTSB report HIR-23-08, a school-bus rollover | a parent whose child rides a school bus |
| f5 | Federal Register 2026-00755, the 2026 HHS poverty guidelines | a parent applying for a local aid program that uses the guidelines |

## What runs

- **The checker** at commit 7eb9cac of `claude/jargone-spec`: the 0.2 checker and curated word
  lists. Only J01, J04 and J07, with default settings, on each text as written.
- **The judge,** as in the trial: a model playing the named reader, shown only the text. It is the
  model the everyday comparison used to judge, one call per prompt, from an empty folder with no
  tools and no project instructions. A failed call is retried once.
  1. **Unknown terms first**, before it sees any finding (`prompts/unknown-terms.txt`): every word or
     phrase it would not understand where it is used.
  2. **Then each finding**, in a separate call (`prompts/findings.txt`). J01 and J04: would you
     understand this term here? If yes, why: a name, a term this reader knows, a quotation, an
     identifier, or other. J07: does the plainer word fit here, keeping the meaning? And would making
     the swap here change the meaning?
- **A finding is true** when the reader says it would not understand the term (J01, J04), or that the
  swap fits (J07). Everything else is a false alarm, as in the trial.

## Measures

- For each check: findings, true, false alarms and their share, and false alarms by kind.
- J01 and J04 together: how many of the reader's unknown terms (step 1) they flagged.
- J07: the share of swaps that fit, and the share that would change the meaning.
- Cost in USD and tokens.

## Decision rule

- **J01 and J04:** each is kept as an optional hint for everyday audiences if at least half its
  findings across the five texts are true. Otherwise it is dropped.
- **J07:** kept only if at least half its swaps fit and no more than 1 in 10 would change the
  meaning. Otherwise it is dropped.
- **Too few to judge:** a check with fewer than 5 findings across the five texts is reported as "not
  enough findings", and the maintainer decides.
- How many of the reader's unknown terms J01 and J04 catch is reported, but is not part of the rule.
  A hint only has to be right when it speaks.
- These thresholds were set by Claude, not the maintainer, and are fixed in this commit, before any
  result.

## Limits

- The judge is a model, not a person. Real readers may differ, as in the trial.
- Five texts, one reader each, one judgment per finding.
