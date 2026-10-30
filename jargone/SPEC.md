# jargone — specification (draft, not built)

`jargone` (jargon gone, and rearrangements done) rewrites a document so that a named reader can
understand it. It removes or defines jargon, puts the purpose first, moves reference detail behind a
link, and then proves two things: that nothing was lost or made false, and that a reader from the
named audience understood it.

This file is the plan. Nothing here is built yet. It follows the same build pattern as `dynamics`:
a method in `prompt.md`, a checker in `hooks/`, tests in `tests/`, and agreed review rounds.

## 1. What it works on (version 1)

- **Documents for people:** READMEs, design documents, guides, decision records and pull-request
  descriptions.
- **Formats:** Markdown and plain text.
- **Language:** English.
- **Not covered in version 1:** code and code comments, legal text, slides, other languages. Fenced
  code, inline code, commands and logs are never changed.

The README will list exactly what was tested, once the tests below have run. It will say "works out
of the box on" only for what is on that list.

## 2. How a person uses it

```
/jargone <file> — for <reader>
/jargone check <file> — for <reader>
```

- **`<reader>` is required,** for example "for a product manager" or "for a new contributor". Whether
  a word is jargon depends on who reads it, so there is no sensible default.
- **`/jargone`** rewrites the file in the working tree (it never commits) and writes a short report.
- **`/jargone check`** writes the report only and changes nothing.
- **Review rounds** are agreed at the start, as in `dynamics`: 1 by default, 0 for a draft marked
  unreviewed. jargone never runs more rounds than the person agreed.
- **Optional:** `--ste` turns on the ASD-STE100-inspired style (section 6). It is off by default.

The report lists: what changed and why, each term defined or replaced, anything moved and where it
went, the checker's findings before and after, the review result, and readability scores before and
after (for information only; see principle 6).

## 3. The jargone framework

Six principles. The grouping, wording and checks are jargone's own. Principles 1 to 3 are common
plain-language practice and track guideline headings in ISO 24495-1. Principle 4 is inspired by
ASD-STE100's writing rules. Principles 5 and 6 come from our own experience: rewriting the `dynamics`
README for clarity introduced two false statements that only a reviewer caught, and standard
readability formulas did not register the improvement (section 8).

| # | Principle | What it means | Checked by |
|---|---|---|---|
| 1 | **Name the reader and their question** | The reader is stated before anything is rewritten. The first paragraph answers the question that reader brings: what is this, and is it for me? | Reviewer |
| 2 | **Purpose first; detail behind a link** | The opening says what the thing does and why it matters. Reference material (option lists, rule tables, edge cases) moves to a linked file. | Reviewer; code checks the move (principle 5) |
| 3 | **Every term earns its place** | A term the reader may not know is replaced with plain words, or defined at its first use. One word keeps one meaning throughout. | Code and reviewer |
| 4 | **Short sentences, one job each** | One idea or instruction per sentence. Long sentences are split. | Code |
| 5 | **Nothing lost, nothing made false** | Every fact in the original survives in the rewrite or in the file it moved to. No claim becomes stronger, weaker or wrong. | Code (lost content); reviewer (claims) |
| 6 | **Proven by a reader** | A reader who sees only the rewrite says what it is, who it is for and when to use it. That is compared with the key points the author listed. This, not a readability score, is the pass mark. | Reviewer |

## 4. What the checker tests (code, deterministic)

Each check has its own test that fails when the check is removed.

- **J01 terms used before they are defined.** It flags an acronym, or a word outside the common-word
  list that appears at least twice, when its first use has no definition near it. It skips code and
  link targets. A project can name terms its readers already know in `.jargone/glossary.json`.
- **J02 one word, one meaning.** Synonyms declared in the glossary ("job" and "task" for the same
  thing) are flagged when both appear. Version 1 checks only declared pairs.
- **J03 long sentences.** It reports the longest sentence and every sentence over 30 words, or over 20
  words inside a numbered procedure. These limits are jargone's own and can be changed.
- **J04 the opening.** The first paragraph contains no term that J01 would flag.
- **J05 nothing lost.** Every number, inline code span, fenced code block, link target and heading of
  the original appears in the rewrite or in a file the report says it moved to. Every link from
  elsewhere in the repository to the document, or to one of its headings, still resolves.
- **J06 scores, for information.** Flesch reading ease, grade level, average and longest sentence,
  before and after. They never pass or fail a document.

**Not checked by code:** whether a definition is correct, whether the opening answers the reader's
question, and whether a claim kept its meaning. The reviewers do those.

**The common-word list** for J01 must be one we may bundle under the MIT licence. Choosing it, and
recording its licence, is the first build step.

## 5. Review

- **Accuracy reviewer:** reads the original, the rewrite and the sources the document describes. It
  checks every claim in the rewrite and flags any that changed meaning.
- **Cold reader:** a reader from the named audience who gets only the rewrite. It answers: what is
  this, who is it for, when would I use it, and what did I not understand? Its answers are compared
  with the author's key points.
- **Rounds:** agreed up front. Later rounds check only the fixes and what they touched. Fixes that no
  round reviewed are listed in the report.

## 6. The ASD-STE100-inspired option (`--ste`)

ASD-STE100 Simplified Technical English (Issue 9, 2025-01-15) is a controlled language from the
aerospace industry: writing rules plus a dictionary of about 900 approved words, each with one
meaning. Andrej Karpathy suggested asking a model to explain things "80% of the way to ASD-STE100"
because he finds the result more readable ([post, 2 October 2026](https://x.com/karpathy/status/2105819303471976479)).

- **What `--ste` does:** it adds one instruction for the model writing the rewrite: write about 80%
  of the way to ASD-STE100. It relies on what the model already knows. jargone ships no STE text.
- **What it does not do:** the checker still measures jargone's own rules only. It does not test STE
  conformance, and the output is not STE.
- **Why no STE content:** the Issue 9 copyright notice forbids reproduction or publication, in whole
  or in part, without written authority from an ASD officer. It also says that possessing the
  document grants no right to use it, and free use is granted only to listed aerospace, defence,
  airline and education bodies. So jargone ships none of STE's rules or dictionary, and does not read
  a user's own copy.
- **Naming:** the README says "an opt-in style inspired by ASD-STE100" and carries this disclaimer:
  *jargone is not affiliated with or endorsed by ASD. ASD-STE100 is a registered trademark of ASD.
  jargone's output is not checked for, and does not claim, STE conformance.* No feature is called "STE
  mode".

## 7. Working with other tools

jargone works on its own and needs nothing else installed. A person *can* run other plain-language
tools alongside it if they want. For example, the
[iso-24495](https://github.com/GaZmagik/iso-24495) plugin audits text against its own reading of the
ISO plain-language standard. We have not tested any combined workflow. jargone claims conformance to
no standard.

## 8. Why not readability formulas

We scored the `dynamics` README before and after its plain-language rewrite (our own script: Flesch
reading ease, Flesch-Kincaid grade, with a rough syllable count). The confusing original scored 70.1
and the clear rewrite 70.3. The repository's one-line description scored worse after its rewrite
(75.4 to 68.6), because plain words such as "accumulates" have more syllables. The formulas count
syllables and sentence length; they cannot see an undefined term, a confusing order, or one word used
in two senses. An analysis by the International Plain Language Federation found that ISO 24495-1
mentions readability formulas once, to say plain language does not rely on them to judge quality. So
jargone reports the scores and never uses them as a pass mark.

## 9. The README must say

- What jargone works on out of the box, as tested (section 1).
- That it works on its own, and that a person *can* use it with other tools such as iso-24495, a
  combination we have not tested.
- That it has an opt-in style inspired by ASD-STE100, with the disclaimer in section 6.
- That the framework is jargone's own, drawing inspiration from the sources in section 11, and that it
  claims conformance to no standard.

## 10. Companion idea: a Diátaxis mod (not part of jargone)

A separate mod could sort a repository's documentation using Diátaxis: tutorials, how-to guides,
reference and explanation, kept apart because mixing explanation into reference is, in Diátaxis's
words, "bad for the reference" and "bad for the explanation too". It would work alongside jargone:
the Diátaxis mod decides which document a piece of content belongs in, and jargone makes each
document readable. Diátaxis is published under CC BY-SA 4.0 by Daniele Procida, so that mod's adapted
guidance would carry that licence with attribution in its own folder, while its code stays MIT. It
gets its own specification when asked for.

## 11. Sources

"Guided" means a source shaped a principle; nothing is copied from it.

| Source | What jargone takes from it |
|---|---|
| ISO 24495-1:2023, *Plain language — Part 1* (ISO/TC 37; headings read, full text not read) | Guided: name the readers (5.1.2), keep supplementary information separate (5.2.5), choose familiar words (5.3.2), keep the document cohesive (5.3.8), evaluate with readers (5.4.3). |
| International Plain Language Federation, ["How much of plain language is about words?"](https://www.iplfederation.org/word-choice/) | Guided: readability formulas are not a measure of quality. |
| ASD-STE100 Issue 9 ([asd-ste100.org](https://www.asd-ste100.org/)) | Guided: one word, one meaning; short sentences. Inspiration for the `--ste` option. No content used. |
| Karpathy, [X post, 2 October 2026](https://x.com/karpathy/status/2105819303471976479) | Guided: the "80% of the way to ASD-STE100" instruction. |
| Diátaxis, [diataxis.fr](https://diataxis.fr/) (Daniele Procida, CC BY-SA 4.0) | Guided: keep reference apart from explanation (principle 2). |
| This repository's `dynamics` README rewrite (October 2026) | Principles 5 and 6, and the readability-formula measurement. |

## 12. Build plan

1. Choose the common-word list and record its licence.
2. Build the checker (J01–J06) with a failing-then-passing test for each check, using the old and new
   `dynamics` README as fixtures.
3. Write the method (`prompt.md`): rewrite, check, review, report.
4. Run it on three real documents with a named reader each; record the results and what it works on.
5. Write the README from section 9, then run jargone on its own README.
