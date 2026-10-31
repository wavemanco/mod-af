# jargone — specification (version 0.1.0 built; trial not yet run)

`jargone` rewrites a document so that a named reader can understand it. It removes or defines
jargon, puts the purpose first, and moves reference detail to a linked file. It then checks two
things: that nothing was lost or made false, and that a cold reader (a model run acting as the named
audience, given only the rewrite) takes away the key points the person confirmed.

**How it runs.** jargone is a Claude Code plugin with three slash commands: `/jargone` is a skill
(it starts a model turn), while `/jargone-check` and `/jargone-voice` are answered by code at once,
with no model turn. A model writes the rewrite,
following the method in `prompt.md`. The checker is a tool the plugin provides (code in `hooks/`),
which jargone runs after each rewrite; it is not triggered by other edits. The two reviewers
(section 5) are separate model runs, not people. Tests live in `tests/`. This is the same layout as
this repository's `dynamics` plugin. Session mode (section 13) adds two hooks: one adds a standing
instruction to every request, one checks each reply. How this specification was reviewed is in
[`REVIEW-LOG.md`](./REVIEW-LOG.md).

## 1. What it works on (version 1)

- **Documents for people, technical or not:** READMEs, design documents, guides, decision records,
  pull-request descriptions, plans, reports and research summaries.
- **Conversations:** session mode (section 13) works in any kind of working session: research,
  planning, explaining, writing or coding.
- **Formats:** Markdown and plain text.
- **Language:** English.
- **Not covered in version 1:** code and code comments, legal text, slides, other languages. Fenced
  code, inline code, commands and logs are never changed.

## 2. How a person uses it

```
/jargone [--ste-inspired] <file> for <reader>
/jargone-check <file>
/jargone-voice on for <reader> [--rewrite] [--ste-inspired]
/jargone-voice off
/jargone-voice
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
- **`/jargone-check`** runs J01–J04, J06 and J07 on the file as it stands, and J05 too if an earlier
  `/jargone` saved its original. It writes its findings to `.jargone/reports/<file>.check.md`, changes
  no document or rewrite report, runs no reviewers and needs no reader.
- **When something fails.** If the checker finds a problem, jargone fixes the rewrite and runs the
  checker again, at most 3 times, stopping early when it passes or the same findings come back. This
  uses no review round and also happens with 0 rounds. If a reviewer finds a problem, jargone fixes it within the agreed rounds.
  Anything still failing is listed at the top of the report. jargone does not undo the rewrite; the
  person can discard it with git.
- **`--ste-inspired`** (off by default) asks for a plainer style inspired by ASD-STE100 (section 6).
- **`/jargone-voice`** turns session mode on or off, or with nothing after it says whether it is on
  (section 13).
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
| 3 | **Every term earns its place** | A term the reader may not know is replaced with plain words or defined at its first use. One thing keeps one name, and one word keeps one meaning. | Code (J01, J02, J07); accuracy reviewer (definitions, two senses) |
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
  It skips code, link targets, direct quotations, and words that look like names: a capitalised word
  in mid-sentence that is not an acronym, or a word shaped like an identifier (camelCase, snake_case,
  or containing a dot, a slash or a leading dash). How often it still flags a name, or a term the
  reader knows, is measured in the trial (section 12).
- **J02 one thing, one name.** Words declared as the same thing in the glossary ("job" and "task")
  are flagged when both appear. Version 1 checks only declared pairs.
- **J03 long sentences.** It reports the longest sentence and every sentence over 30 words, or over 20
  words inside a numbered procedure.
- **J04 the opening.** Every word in the first paragraph after the title (skipping badges and
  images), other than the project's own name, is on the common-word list or the glossary's `known`
  list, compared as in J01. A word defined in the opening itself still fails.
- **J05 nothing lost.** Every number, inline code span, fenced code block and link target of the
  saved original appears unchanged in the rewrite, or in the reference file `<name>-reference.md`
  beside it when `.jargone/moves/<file>.json` lists that file.
  Every link to the document or to one of its headings, from inside it or from elsewhere in the
  repository, still resolves. A heading may be reworded only if no link points to it; jargone does
  not edit other files' links.
- **J06 scores, for information.** Flesch reading ease, Flesch-Kincaid grade, and average and longest
  sentence length: before and after for a rewrite, as it stands for a check. They never pass or fail
  a document.
- **J07 a plainer word is available.** It flags a word or phrase on the replacement list, outside
  code and quotations, with its suggested replacements, unless the word is on the technical-exceptions
  list or in the glossary's `known` list. It is a warning only: it suggests and never replaces, because
  a swap can change meaning. A word on the exceptions list is left to J01, which asks for it to be
  defined if the reader may not know it.

The glossary is `.jargone/glossary.json`, for example
`{"known": ["API"], "same": [["job", "task"]], "max_words": 30, "max_words_in_steps": 20}`. `known`
lists terms J01, J04 and J07 accept for every reader; version 1 does not vary it by reader. `same`
lists the pairs J02 checks. `max_words` and `max_words_in_steps` replace J03's limits of 30 and 20.
`cutoff` changes the familiarity cut-off (below).

**Not checked by code:** whether a definition is correct, whether a word is used in two senses,
whether a sentence does more than one job, whether the opening answers the reader's question, and
whether a claim kept its meaning. The reviewers do those (section 5).

### Data files

They ship as one generated code module, `hooks/data.ts`, built by `scripts/build_data.py`, because
the plugin loader and the test kit read code files only. `data/NOTICE.md` gives each list's source,
licence, required credit and every change made to it.
- **Familiarity list,** for J01 and J04: the AI-generated estimates of English word familiarity by
  Brysbaert, Martínez and Reviriego ([OSF](https://osf.io/c2yef/), CC BY 4.0), cut down to single
  words and their rating from 1 (unknown) to 7 (very familiar). The **common-word list** is every
  word rated at or above the cut-off: 6.0 by default, changed with the glossary's `cutoff`. The trial
  (section 12) checks that default.
- **Replacement list,** for J07: one file of entries (word or phrase, replacements, source, any
  "unless" note) merged from the US Federal Plain Language Guidelines word list (public domain,
  CC0), 18F's "Words to avoid" (CC0), GOV.UK's "Words to avoid" (Open Government Licence v3.0,
  credit required) and the iso-24495 plugin's word lists (MIT, credit required).
- **Technical-exceptions list,** for J07: jargone's own list of words whose plain swap would change a
  precise meaning, such as "implement", "execute" and "require". We write it, using the word list in
  Google's developer documentation style guide (CC BY 4.0) as a reference; none of Google's text is
  shipped.
- **Backup:** if the trial shows the familiarity list does not suit, the New General Service List –
  Graded Reader (5,000 words, CC BY-SA 4.0) replaces it.

The files are read from the plugin's own folder when a session starts. jargone never fetches them
during a session and never puts them in the model's context: the model sees only the findings.

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

- **What it does:** adds one instruction for the model writing the rewrite, or in session mode for
  every reply: write about 80% of the way to ASD-STE100. It relies on what the model already knows. jargone ships no STE text.
- **What it does not do:** the checker still measures jargone's own rules only. The output is not
  checked for STE conformance and is not STE.
- **Why no STE content:** the Issue 9 copyright notice forbids copying or publishing any part without
  written authority from an ASD officer. The standard is free to request, but having it grants no
  right to use it; free use is granted only to the groups the notice lists: aerospace and defence
  bodies and their customers, Airlines for America, airworthiness authorities, and universities and
  research institutes for educational purposes. So jargone ships none of its rules or dictionary, and
  does not read a user's own copy.
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

- What jargone works on out of the box: only the kinds of document and session the trial in build
  step 5 (section 12) succeeded on, with the false alarms it found.
- That session mode is warn-only by default, and what rewriting replies costs (section 13).
- The credits the data licences require (`data/NOTICE.md`).
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
| The data sources (section 4) | The familiarity list, the replacement list, and the reference for the technical-exceptions list. Licences and credits are in `data/NOTICE.md`. |
| This repository's `dynamics` README rewrite (October 2026) | Principles 5 and 6: the rewrite added two false statements that only a reviewer caught. Section 8's measurement. |

## 12. Build plan

1. Build the data files and `data/NOTICE.md` (section 4).
2. Build the checker (J01–J07) with a test for each check, shown to fail when the check is removed.
   Use the before and after `dynamics` README as fixtures.
3. Write the method (`prompt.md`): key points, rewrite, check, review, report.
4. Build session mode (section 13): the standing instruction, the check on each reply, and the
   conflict notice.
5. Run a trial and record it in `research/trial.md`:
   - **Documents:** three real documents for three different readers, at least one of them not
     technical; for example a design document for a product manager, a research summary for a
     general reader, and a README for a new contributor.
   - **Sessions:** session mode, warn-only, through two working sessions of different kinds: one not
     about code (research or planning) and one coding session.
   - **Record:** every false alarm (the word, and why it was wrong: a name, a term the reader knows,
     a quotation), every change of meaning, and the time and tokens added. These results set the
     default cut-off and decide whether rewriting replies stays opt-in.
6. Write the README from section 9, then run jargone on its own README.

## 13. Session mode (`/jargone-voice`)

Session mode keeps a whole conversation plain, not just one document. It works in any kind of
working session: research, planning, explaining, writing or coding.

- **Standing instruction.** While it is on, a short section is added to the system prompt of every
  request: write for the named reader, define a term the reader may not know at its first use, one
  idea per sentence, and prefer a plain word unless the exact term matters, in which case define it.
  Being in the system prompt, it survives when a long conversation is compacted. It costs a few
  hundred tokens per request, mostly served from the prompt cache.
- **A check on each reply, warn-only by default.** When a reply ends, jargone runs J01, J03 and J07 on
  its text (code and quotations skipped) and shows the person a short note, for example "jargone:
  3 undefined terms, longest sentence 41 words". The note is not added to the conversation, so it
  costs the model nothing.
- **`--rewrite` (opt-in).** If a reply fails, jargone asks the model once to rewrite it, giving it at
  most 10 findings and the count of any others. The first reply has already been shown, so the
  person sees both. It never asks twice for the same reply. Each rewrite costs an extra model turn.
- **Other instructions.** If an output style is selected, or other plugins add sections to the system
  prompt, jargone names them once when session mode starts, so the person can judge whether they
  conflict. It never removes anyone else's instructions.
- **Scope.** The main conversation only; subagents are left alone in version 1. The reviewers and the
  accuracy check do not run on each reply; they are too slow and costly for that.
- **Known risks,** measured in the trial (section 12):
  - **false alarms:** names of people, products and standards; terms of the reader's own field (a
    finance reader knows "EBITDA"); identifiers written without code formatting; quoted titles;
  - **changes of meaning:** in any field with exact terms (software, law, medicine, statistics,
    finance), a plain swap can change what is said, for example "significant" in a statistical
    result. Session mode flags and suggests; it never edits, and the check on each reply cannot test
    meaning;
  - **one word, two senses** across fields ("stock" in finance and in system dynamics), which only a
    reviewer catches.
