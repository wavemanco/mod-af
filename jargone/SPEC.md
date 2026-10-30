# jargone — specification (draft, not built)

`jargone` rewrites a document so that a named reader can understand it. It removes or defines
jargon, puts the purpose first, and moves reference detail to a linked file. It then checks two
things: that nothing was lost or made false, and that a cold reader (a model run acting as the named
audience, given only the rewrite) takes away the key points the person confirmed.

**How it runs.** jargone is a Claude Code plugin with a slash command. A model writes the rewrite,
following the method in `prompt.md`. The checker is a tool the plugin provides (code in `hooks/`),
which jargone runs after each rewrite; it is not triggered by other edits. The two reviewers
(section 5) are separate model runs, not people. Tests live in `tests/`. This is the same layout as
this repository's `dynamics` plugin. How this specification was reviewed is in
[`REVIEW-LOG.md`](./REVIEW-LOG.md).

## 1. What it works on (version 1)

- **Documents for people:** READMEs, design documents, guides, decision records and pull-request
  descriptions.
- **Formats:** Markdown and plain text.
- **Language:** English.
- **Not covered in version 1:** code and code comments, legal text, slides, other languages. Fenced
  code, inline code, commands and logs are never changed.

## 2. How a person uses it

```
/jargone [--ste-inspired] <file> for <reader>
/jargone check <file>
```

Everything after `for` is the reader, for example `/jargone README.md for a new contributor`.

- **The reader is required for a rewrite.** Whether a word is jargon depends on who reads it, so
  there is no default.
- **Key points.** Before rewriting, jargone drafts the 2 to 5 points a reader must take away from the
  original and asks the person to confirm or edit them. These are the pass mark (principle 6).
- **Review rounds.** jargone asks how many rounds to run: 1 by default, or 0 for a rough draft. A
  round is one pass by both reviewers (section 5), then fixes. It never runs more rounds than agreed.
  With 0 rounds neither reviewer runs, so the report marks the result "not reviewed: no reader test,
  and no check of claims or of facts the code cannot see".
- **`/jargone`** saves the original to `.jargone/originals/<file>`, rewrites the file in the working
  tree, may create or add to one reference file beside it (principle 2), and records each move in
  `.jargone/moves/<file>.json`. It never commits. It writes its report to `.jargone/reports/<file>.md`.
- **`/jargone check`** runs J01–J04 and J06 on the file as it stands, and J05 too if an earlier
  `/jargone` saved its original. It writes its findings to `.jargone/reports/<file>.check.md`, changes
  no document or rewrite report, runs no reviewers and needs no reader.
- **When something fails.** If the checker finds a problem, jargone fixes the rewrite and runs the
  checker again, at most 3 times, stopping early when it passes or the same findings come back. This uses no review round and also
  happens with 0 rounds. If a reviewer finds a problem, jargone fixes it within the agreed rounds.
  Anything still failing is listed at the top of the report. jargone does not undo the rewrite; the
  person can discard it with git.
- **`--ste-inspired`** (off by default) asks for a plainer style inspired by ASD-STE100 (section 6).
- **Without the plugin.** Like every plugin in this repository, `prompt.md` also works pasted into a
  chat. There the model applies J01–J05 by hand to what it can see, gives no readability scores (they
  need code), and the report says the checks were not run by code.

The report lists: what changed and why, each term defined or replaced, anything moved and where, the
checker's findings before and after, the review result, and readability scores before and after (for
information only).

## 3. The jargone framework

Six principles. They are jargone's own grouping and wording, drawing on common plain-language
practice and on the sources in section 11, which also says what each source shaped.

| # | Principle | What it means | Checked by |
|---|---|---|---|
| 1 | **Name the reader and their question** | The reader is stated before anything is rewritten. The first paragraph answers the question that reader brings: what is this, and is it for me? | Cold reader (first paragraph); code (J04) |
| 2 | **Purpose first; detail behind a link** | The opening says what the thing does and why it matters. Reference material (option lists, rule tables, edge cases) moves to `<name>-reference.md` beside the original, which links to it. If that file exists, jargone adds to its end. | Cold reader; code checks the move (J05) |
| 3 | **Every term earns its place** | A term the reader may not know is replaced with plain words or defined at its first use. One thing keeps one name, and one word keeps one meaning. | Code (J01, J02); accuracy reviewer (definitions, two senses) |
| 4 | **Short sentences, one job each** | One idea or instruction per sentence. Long sentences are split. | Code (length, J03); cold reader (one job each) |
| 5 | **Nothing lost, nothing made false** | Every fact in the original survives in the rewrite or in the file it moved to. No claim becomes stronger, weaker or wrong. | Code (numbers, code, links: J05); accuracy reviewer (every other fact, and claims) |
| 6 | **Tested on a reader** | A cold reader given only the rewrite says what it is, who it is for, when to use it and what to remember from it. The rewrite passes when those answers contain every confirmed key point. Readability scores are not the pass mark. | Cold reader |

## 4. What the checker tests (code, deterministic)

Each check has its own test, shown to fail when the check is removed.

- **J01 terms used before they are defined.** It flags a term whose first use is not defined in the
  same or the next sentence. A term is a word on neither the common-word list nor the glossary's
  `known` list that is either an acronym (two or more capital letters) or used at least twice. Words
  are compared after removing a plural or verb ending. A definition is `Full Name (ACRONYM)`,
  `term (meaning)`, `term — meaning`, or a sentence of the form "*term* is …" or "*term* means …".
  It skips code and link targets.
- **J02 one thing, one name.** Words declared as the same thing in the glossary ("job" and "task")
  are flagged when both appear. Version 1 checks only declared pairs.
- **J03 long sentences.** It reports the longest sentence and every sentence over 30 words, or over 20
  words inside a numbered procedure.
- **J04 the opening.** Every word in the first paragraph after the title (skipping badges and
  images), other than the project's own name, is on the common-word list or the glossary's `known`
  list, compared as in J01. A word defined in the opening itself still fails.
- **J05 nothing lost.** Every number, inline code span, fenced code block and link target of the
  saved original appears unchanged in the rewrite or in a file listed in `.jargone/moves/<file>.json`.
  Every link to the document or to one of its headings, from inside it or from elsewhere in the
  repository, still resolves. A heading may be reworded only if no link points to it; jargone does
  not edit other files' links.
- **J06 scores, for information.** Flesch reading ease, Flesch-Kincaid grade, and average and longest
  sentence length: before and after for a rewrite, as it stands for a check. They never pass or fail
  a document.

The glossary is `.jargone/glossary.json`, for example
`{"known": ["API"], "same": [["job", "task"]], "max_words": 30, "max_words_in_steps": 20}`. `known`
lists terms J01 and J04 accept for every reader; version 1 does not vary it by reader. `same` lists the
pairs J02 checks. `max_words` and `max_words_in_steps` replace J03's limits of 30 and 20.

**Not checked by code:** whether a definition is correct, whether a word is used in two senses,
whether a sentence does more than one job, whether the opening answers the reader's question, and
whether a claim kept its meaning. The reviewers do those (section 5).

**The common-word list** for J01 and J04 must have a licence that lets us ship it inside an
MIT-licensed project. Choosing it, and recording its licence, is the first build step.

## 5. Review

- **Accuracy reviewer:** reads the original, the rewrite, any file content moved to, and the files in
  the repository that the document describes (for a README, the code it documents). It flags every
  claim in the rewrite that changed meaning, every wrong definition, and every word used in two
  senses. It also lists every fact in the original that is in neither the rewrite nor a moved-to
  file.
- **Cold reader:** a model run briefed as a reader from the named audience, given only the rewrite.
  It answers: what is this, who is it for, when would I use it, what should I remember from it, and
  what did I not understand? It also says whether the first paragraph alone answered the first two
  questions, and quotes any sentence that does more than one job. jargone then checks the answers
  against the confirmed key points; a missing point is a failure.
- Later rounds check only the fixes and what they touched. Fixes no round reviewed are listed in the
  report.

## 6. The ASD-STE100-inspired option (`--ste-inspired`)

ASD-STE100 Simplified Technical English (Issue 9, 2025-01-15) is a controlled language from the
aerospace industry: writing rules plus a dictionary of about 900 approved words, each with one
meaning. Andrej Karpathy suggested asking a model to explain things in ASD-STE100, whose style he
often finds "a lot more readable", and sometimes asking for "80% of the way to ASD-STE100" because
"the spec is quite stringent" ([post, 2 October 2026](https://x.com/karpathy/status/2105819303471976479)).

- **What it does:** adds one instruction for the model writing the rewrite: write about 80% of the
  way to ASD-STE100. It relies on what the model already knows. jargone ships no STE text.
- **What it does not do:** the checker still measures jargone's own rules only. The output is not
  checked for STE conformance and is not STE.
- **Why no STE content:** the Issue 9 copyright notice forbids copying or publishing any part without
  written authority from an ASD officer. The standard is free to request, but having it grants no
  right to use it; free use is granted only to the groups the notice lists: aerospace and defence
  bodies and their customers, Airlines for America, airworthiness authorities, and universities and
  research institutes for educational purposes. So jargone ships none of its rules or dictionary, and does not read a user's
  own copy.
- **Naming:** the README says jargone has "an opt-in style inspired by ASD-STE100", with this
  disclaimer: *jargone is not affiliated with, endorsed by or developed with ASD or the STEMG.
  ASD-STE100 is a registered trademark of ASD. jargone's output is not checked for, and does not
  claim, STE conformance.*

## 7. Working with other tools

jargone works on its own and needs nothing else installed. A person *can* run other plain-language
tools alongside it if they want. For example, the [iso-24495](https://github.com/GaZmagik/iso-24495)
plugin offers plain-language writing skills and a text audit based on its own interpretation of the
ISO 24495 series. We have not tested any combined workflow. jargone claims conformance to no
standard.

## 8. Why not readability formulas

We scored this repository's `dynamics` README before and after its plain-language rewrite with a
rough script (`research/readability.py`; output in `research/readability-output.txt`). The confusing
original scored 70.1 on Flesch reading ease and the clear rewrite 70.3. The repository's one-line
description of `dynamics` scored worse after its rewrite (75.4 to 68.6), because plain words such as
"accumulates" have more syllables. Other counting rules give other numbers for the same files, but
the pattern is the known one: the formulas count syllables and sentence length, and cannot see an
undefined term, a confusing order, or one word used in two senses. An analysis by the International
Plain Language Federation found that the ISO plain-language standard mentions readability formulas
once, to say plain language does not focus on them to judge text quality. So jargone reports the
scores and never uses them as a pass mark.

## 9. The README must say

- What jargone works on out of the box: only the kinds of document it ran on successfully in build
  step 4 (section 12).
- That it works on its own, and that a person *can* use it with other tools such as iso-24495, a
  combination we have not tested.
- That it has an opt-in style inspired by ASD-STE100, with the disclaimer in section 6.
- That the framework is jargone's own, drawing inspiration from the sources in section 11, and that
  it claims conformance to no standard.

## 10. Companion idea (out of scope here)

A separate plugin could sort a repository's documentation into the four Diátaxis types (tutorials,
how-to guides, reference and explanation) and pair with jargone. Diátaxis is published by Daniele
Procida under CC BY-SA 4.0, so that plugin would credit it and carry that licence for its adapted
guidance. It gets its own specification when asked for.

## 11. Sources

Each row names what a source shaped. jargone ships no text from the ISO, IPLF, ASD-STE100 or
Diátaxis sources.

| Source | What it shaped |
|---|---|
| ISO 24495-1:2023, *Plain language — Part 1* (headings read; full text not read) | Principle 1: identify the readers (5.1.2). Principle 2: keep supplementary information separate (5.2.5). Principle 3: choose familiar words (5.3.2); keep the document cohesive (5.3.8). Principle 6: evaluate with readers (5.4.3). |
| International Plain Language Federation, ["How much of plain language is about words?"](https://www.iplfederation.org/word-choice/) | Section 8: plain language does not focus on readability formulas to judge text quality; the standard stresses how well readers can use a document. |
| ASD-STE100 Issue 9 ([asd-ste100.org](https://www.asd-ste100.org/)) | Principle 3: one word, one meaning. Principle 4: short sentences. The `--ste-inspired` option. No content used. |
| Andrej Karpathy, [post, 2 October 2026](https://x.com/karpathy/status/2105819303471976479) | The "80% of the way to ASD-STE100" instruction. |
| Diátaxis, [diataxis.fr](https://diataxis.fr/) (Daniele Procida, CC BY-SA 4.0) | Principle 2: keep reference apart from explanation. The companion idea (section 10). |
| This repository's `dynamics` README rewrite (October 2026) | Principles 5 and 6: the rewrite added two false statements that only a reviewer caught. Section 8's measurement. |

## 12. Build plan

1. Choose the common-word list and record its licence.
2. Build the checker (J01–J06) with a test for each check, shown to fail when the check is removed.
   Use the before and after `dynamics` README as fixtures.
3. Write the method (`prompt.md`): key points, rewrite, check, review, report.
4. Run it on three real documents, each with a named reader; record the results and what it works on.
5. Write the README from section 9, then run jargone on its own README.
