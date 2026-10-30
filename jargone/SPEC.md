# jargone — specification (draft, not built)

`jargone` rewrites a document so that a named reader can understand it. It removes or defines
jargon, puts the purpose first, and moves reference detail to a linked file. It then checks two
things: that nothing was lost or made false, and that a fresh reader, acting as the named audience
and given only the rewrite, can say what the document is, who it is for and when to use it.

**How it runs.** jargone is a Claude Code plugin with a slash command. A model writes the rewrite,
following the method in `prompt.md`. The checker is a tool the plugin provides (code in `hooks/`),
which jargone runs after each rewrite; it is not triggered by other edits. The two reviewers
(section 5) are separate model runs, not people. Tests live in `tests/`. This is the same layout as
this repository's `dynamics` plugin.

## 1. What it works on (version 1)

- **Documents for people:** READMEs, design documents, guides, decision records and pull-request
  descriptions.
- **Formats:** Markdown and plain text.
- **Language:** English.
- **Not covered in version 1:** code and code comments, legal text, slides, other languages. Fenced
  code, inline code, commands and logs are never changed.

## 2. How a person uses it

```
/jargone <file> for <reader> [--ste-inspired]
/jargone check <file> for <reader>
```

Everything after `for` is the reader, for example `/jargone README.md for a new contributor`.

- **The reader is required.** Whether a word is jargon depends on who reads it, so there is no
  default.
- **Key points.** Before rewriting, jargone drafts the 2 to 5 points a reader must take away from the
  original and asks the person to confirm or edit them. These are the pass mark for principle 6.
- **Review rounds.** jargone asks how many rounds to run: 1 by default, or 0 for a rough draft. A
  round is one pass by both reviewers (section 5), then fixes. It never runs more rounds than agreed.
  With 0 rounds there is no cold reader, so the report marks the result "not reader-tested".
- **`/jargone`** saves the original to `.jargone/originals/<file>`, rewrites the file in the working
  tree, and may create one reference file beside it (principle 2). It never commits. It writes its
  report to `.jargone/reports/<file>.md`.
- **`/jargone check`** runs the checker (J01–J06) only and writes its findings and scores. It changes
  nothing and runs no reviewers.
- **When something fails.** If a checker finding or the cold reader fails, jargone fixes the rewrite
  and checks again, within the agreed rounds. Anything still failing is listed at the top of the
  report. jargone does not undo the rewrite; the person can discard it with git.
- **`--ste-inspired`** (off by default) asks for a plainer style based on Simplified Technical
  English (section 6).
- **Without the plugin.** Like every plugin in this repository, `prompt.md` also works pasted into a
  chat. There the model applies J01–J06 by hand, and the report says the checks were not run by code.

The report lists: what changed and why, each term defined or replaced, anything moved and where, the
checker's findings before and after, the review result, and readability scores before and after (for
information only).

## 3. The jargone framework

Six principles. They are jargone's own grouping and wording, drawing on common plain-language
practice and on the sources in section 11, which also says what guided each one.

| # | Principle | What it means | Checked by |
|---|---|---|---|
| 1 | **Name the reader and their question** | The reader is stated before anything is rewritten. The first paragraph answers the question that reader brings: what is this, and is it for me? | Cold reader; code checks the opening (J04) |
| 2 | **Purpose first; detail behind a link** | The opening says what the thing does and why it matters. Reference material (option lists, rule tables, edge cases) moves to `<name>-reference.md` beside the original, which links to it. If that file exists, jargone adds to its end. | Cold reader; code checks the move (J05) |
| 3 | **Every term earns its place** | A term the reader may not know is replaced with plain words or defined at its first use. One thing keeps one name, and one word keeps one meaning. | Code (J01, J02); accuracy reviewer (definitions correct) |
| 4 | **Short sentences, one job each** | One idea or instruction per sentence. Long sentences are split. | Code (length, J03); cold reader (one job each) |
| 5 | **Nothing lost, nothing made false** | Every fact in the original survives in the rewrite or in the file it moved to. No claim becomes stronger, weaker or wrong. | Code (numbers, code, links: J05); accuracy reviewer (every other fact, and claims) |
| 6 | **Tested on a reader** | A cold reader given only the rewrite says what it is, who it is for and when to use it. The rewrite passes when those answers contain every confirmed key point (section 2). Readability scores are not the pass mark. | Cold reader |

## 4. What the checker tests (code, deterministic)

Each check has its own test, shown to fail when the check is removed.

- **J01 terms used before they are defined.** It flags an acronym (a word of two or more capital
  letters) or a word on neither the common-word list nor the glossary, compared after removing a
  plural or verb ending, that appears at least twice, when its first use is not defined in the same
  or the next sentence. A definition is `Full Name (ACRONYM)`, `term (meaning)`, `term — meaning`,
  or a sentence of the form "*term* is …" or "*term* means …". It skips code and link targets.
- **J02 one thing, one name.** Words declared as the same thing in the glossary ("job" and "task")
  are flagged when both appear. Version 1 checks only declared pairs.
- **J03 long sentences.** It reports the longest sentence and every sentence over 30 words, or over 20
  words inside a numbered procedure.
- **J04 the opening.** The first paragraph after the title (skipping badges and images) uses no
  acronym and no word outside the common-word list or glossary, even once and even if defined, other
  than the project's own name.
- **J05 nothing lost.** Every number, inline code span, fenced code block and link target of the
  saved original appears unchanged in the rewrite or in a file listed in `.jargone/moves.json` (what
  moved, and where). Every link from elsewhere in the repository to the document, or to one of its
  headings, still resolves. A heading may be reworded if no link points to it; jargone does not edit
  other files' links.
- **J06 scores, for information.** Flesch reading ease, Flesch-Kincaid grade, and average and longest
  sentence length, before and after. They never pass or fail a document.

The glossary is `.jargone/glossary.json`, for example
`{"known": ["API"], "same": [["job", "task"]], "max_words": 30, "max_words_in_steps": 20}`. `known`
lists terms J01 and J04 accept for every reader; version 1 does not vary it by reader.

**Not checked by code:** whether a definition is correct, whether a word is used in two senses,
whether the opening answers the reader's question, and whether a claim kept its meaning. The
reviewers do those.

**The common-word list** for J01 and J04 must have a licence that lets us ship it inside an
MIT-licensed project. Choosing it, and recording its licence, is the first build step.

## 5. Review

- **Accuracy reviewer:** reads the original, the rewrite, any file content moved to, and the files in
  the repository that the document describes (for a README, the code it documents). It flags every
  claim in the rewrite that changed meaning, and lists every fact in the original that is in neither
  the rewrite nor a moved-to file.
- **Cold reader:** a model run briefed as a reader from the named audience, given only the rewrite.
  It answers: what is this, who is it for, when would I use it, and what did I not understand? Its
  answers are compared with the confirmed key points.
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
  written authority from an ASD officer, and says that having the document grants no right to use
  it. Free use is granted only to listed aerospace, defence, airline, airworthiness, and university
  or research bodies. (The standard is free to request; that grants none of these rights.) So
  jargone ships none of its rules or dictionary, and does not read a user's own copy.
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

- What jargone works on out of the box: only what the tests in section 12 covered.
- That it works on its own, and that a person *can* use it with other tools such as iso-24495, a
  combination we have not tested.
- That it has an opt-in style inspired by ASD-STE100, with the disclaimer in section 6.
- That the framework is jargone's own, drawing inspiration from the sources in section 11, and that
  it claims conformance to no standard.

## 10. Companion idea: a Diátaxis plugin (out of scope here)

A separate plugin could sort a repository's documentation into the four Diátaxis types: tutorials,
how-to guides, reference and explanation. It would pair with jargone: one decides which document a
piece of content belongs in, the other makes each document readable. Diátaxis is published by
Daniele Procida under CC BY-SA 4.0, so that plugin's adapted guidance would carry that licence, with
attribution, in its own folder, while its code stays MIT. It gets its own specification when asked
for.

## 11. Sources

"Guided" means a source shaped a principle; nothing is copied from it.

| Source | What guided jargone |
|---|---|
| ISO 24495-1:2023, *Plain language — Part 1* (headings read; full text not read) | Principle 1: identify the readers (5.1.2). Principle 2: keep supplementary information separate (5.2.5). Principle 3: choose familiar words (5.3.2); keep the document cohesive (5.3.8). Principle 6: evaluate with readers (5.4.3). |
| International Plain Language Federation, ["How much of plain language is about words?"](https://www.iplfederation.org/word-choice/) | Section 8: the standard does not judge quality by readability formulas; it stresses how well readers can use a document. |
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

## Review of this specification

One review round was agreed and run (2026-10-30). Two reviewers, both model runs, read-only: one
checked facts against the saved sources and the maintainer's decisions, one read it cold as the
maintainer and as the coder. They raised 35 findings: 4 high, 19 medium, 12 low.

The highs were:
- it did not say what runs (a slash command, a model writing, reviewers that are model runs);
- it claimed to "prove" understanding;
- the pass mark relied on key points that no step collected;
- the nothing-lost check would have failed any heading reworded to remove jargon.

All 35 were applied. Since one round was agreed, these fixes have not been reviewed again.
