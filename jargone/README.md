# jargone

jargone rewrites a document so that the reader you name can follow it. It puts the purpose first,
uses plain words, and moves long detail to a linked page. Then it checks that nothing was lost or
made false, and that a model playing your reader takes away the key points.

jargone is for anyone who writes for people: READMEs, design documents, guides, plans, reports and
summaries of research. A README is the front page of a code project. It can also keep a whole
working session with Claude plain, not just one document.

## How a rewrite works

You name the file and the reader:

```
/jargone README.md for a new contributor
```

1. **It asks you to confirm the key points.** It drafts the 2 to 5 points a reader must take away.
   These are the pass mark.
2. **It asks how many review rounds to run.** The default is 1. Choose 0 for a rough draft.
3. **It saves the original** in `.jargone/originals/`, then rewrites the file.
4. **It moves reference detail,** such as long option lists, to `<name>-reference.md` beside the file.
   The rewrite links to it.
5. **Code checks the rewrite.** If the check fails, it fixes the rewrite and checks again, up to 3
   times.
6. **Two reviewers check what code cannot.** Both are separate model runs, not people. One compares
   the rewrite with the original and with the code it describes. The other, the cold reader, plays
   your reader and sees only the rewrite. It must name every key point.
7. **It writes a report** to `.jargone/reports/`, starting with anything still failing.

It never commits. You see the change with `git diff` and can undo it with git.

## Commands

| Command | What it does |
|---|---|
| `/jargone [--ste-inspired] <file> for <reader>` | Rewrites the file for that reader, as above. The reader is required: a word is jargon or not depending on who reads it. |
| `/jargone-check <file>` | Runs the code checks on the file as it stands. It changes no file except its own report, `.jargone/reports/<file>.check.md`. It needs no reader and runs no reviewers. |
| `/jargone-voice on for <reader> [--rewrite] [--ste-inspired]` | Turns session mode on (below). |
| `/jargone-voice off` | Turns session mode off. |
| `/jargone-voice` | Says whether session mode is on, and for which reader. |

## What the code checks

The checks follow jargone's six principles: name the reader, put the purpose first, make every term
earn its place, keep sentences short, lose nothing, and test on a reader. Code checks:

- **J01:** a term used before the text explains it, unless the term is common or on your list of known
  terms;
- **J02:** one thing with two names, for pairs you list;
- **J03:** sentences over 30 words, or over 20 in a list of steps;
- **J04:** an uncommon word in the first paragraph;
- **J05:** a number, piece of code or link lost in the rewrite, or a link to the document broken;
- **J06:** readability scores, for information only;
- **J07:** a word that has a simpler option. It suggests and never swaps, since a swap can change the
  meaning.

The code cannot tell whether a definition is right or a claim kept its meaning. The reviewers check
those. You can set known terms and limits in `.jargone/glossary.json`. The full rules are in
section 4 of [`SPEC.md`](./SPEC.md).

## Session mode: plain replies for a whole session

`/jargone-voice on for <reader>` keeps Claude's replies plain for the rest of the session, in any
kind of work: research, planning, writing or code.

- **An instruction on every request.** It asks Claude to write for your reader, define new terms,
  give one idea per sentence and prefer plain words. The instruction is under 100 words, or under
  130 with `--ste-inspired`, so it adds a little to each request.
- **A note after each reply, warn-only by default.** jargone runs J01, J03 and J07 on the reply and
  shows you a short note, such as "jargone: 3 undefined terms, longest sentence 41 words". The note
  is not added to the conversation, so it costs the model nothing.
- **`--rewrite`, off by default.** If a reply fails, jargone asks Claude once to rewrite it. You see
  both replies. Each rewrite costs an extra model turn.
- **Other instructions.** If an output style or another plugin (an add-on for Claude Code) adds
  instructions, jargone names them once when session mode starts. You judge whether they conflict.
  It never removes them.
- **Limits.** It covers the main conversation, not subagents. It cannot tell whether a plain word
  changed the meaning. It can raise false alarms on names, on terms your reader already knows, and
  on code written without code formatting. The trial will measure how often.

## An opt-in style inspired by ASD-STE100

The Aerospace, Security and Defence Industries Association of Europe (ASD) publishes a standard for
Simplified Technical English (STE), called ASD-STE100. STE is a strict way of writing from the
aerospace industry. ASD's Simplified Technical English Maintenance Group (STEMG) keeps it up to
date.

`--ste-inspired` adds one line to jargone's instruction: write about 80% of the way to ASD-STE100.
The idea comes from Andrej Karpathy, who often finds that style easier to read. jargone relies on
what the model already knows. It ships none of the standard's rules or word list, because its
copyright notice forbids copying them, and it does not read your own copy. The checks stay the same.

*jargone is not affiliated with, endorsed by or developed with ASD or the STEMG. ASD-STE100 is a
registered trademark of ASD. jargone's output is not checked for, and does not claim, STE
conformance.*

## What it works on

**The trial has not run yet.** Until it does, these are the planned targets, not tested ones:

- **Documents for people, technical or not:** READMEs, design documents, guides, decision records,
  pull-request descriptions, plans, reports and summaries of research.
- **Sessions:** session mode, in research, planning, explaining, writing or coding.
- **Formats:** Markdown and plain text, in English.
- **Not covered:** code and code comments, legal text, slides, and other languages. It never changes
  code blocks, inline code, commands or logs.

The trial (build step 5 in [`SPEC.md`](./SPEC.md)) will try three documents for three readers and
two working sessions. This section will then list only what it worked on, with the false alarms it
found.

## Working with other tools

jargone works on its own and needs nothing else installed. You *can* run other plain-language tools
beside it. For example, the [iso-24495](https://github.com/GaZmagik/iso-24495) plugin offers
plain-language writing skills and a text check. Its name comes from the ISO 24495 plain-language
standards of the International Organization for Standardization (ISO). It works from its own
reading of them. We have not tested jargone with it, or with any other tool.

## Why scores are not the pass mark

Readability scores count syllables and sentence length. They cannot see a term nobody defined, a
confusing order, or one word used in two senses. We scored the `dynamics` plugin's README before and
after its plain-language rewrite, using a rough script. The confusing version scored 70.1 for reading ease, and the clear
one 70.3 ([`research/readability-output.txt`](./research/readability-output.txt)). So jargone reports
the scores, and the cold reader decides.

## Install

```
/plugin install jargone --marketplace wavemanco/mod-af
```

## Or use the prompt

[`prompt.md`](./prompt.md) is the same method as a prompt you can paste into any chat. Without the
plugin, the model applies J01 to J05 by hand to what it can see. It gives no readability scores, since
they need code. The report says the checks were not run by code.

## Where the word lists come from

The checks use three word lists, built by `scripts/build_data.py`:

- **How familiar words are,** from *AI-generated estimates of English word familiarity* by Marc
  Brysbaert, Gonzalo Martínez and Pedro Reviriego (Creative Commons Attribution 4.0);
- **Simpler words,** from the US Federal Plain Language Guidelines and 18F's "Words to avoid" (both
  public domain), GOV.UK's "Words to avoid" (Open Government Licence v3.0), and the iso-24495
  plugin's word lists (MIT);
- **Words not to swap,** jargone's own list.

[`data/NOTICE.md`](./data/NOTICE.md) gives each source in full, what we changed, and the credit each
licence requires.

## Sources

The six principles are jargone's own grouping and wording. They draw on common plain-language
practice and on the sources below. jargone does not claim to meet any standard.

| Source | What it shaped |
|---|---|
| ISO 24495-1:2023, *Plain language — Part 1* (headings read; full text not read) | Name the readers. Keep extra detail apart. Choose familiar words. Keep the text joined up. Test with readers. |
| International Plain Language Federation (IPLF), ["How much of plain language is about words?"](https://www.iplfederation.org/word-choice/) | Readability scores are not the pass mark. |
| ASD-STE100 Issue 9 ([asd-ste100.org](https://www.asd-ste100.org/)) | One word, one meaning. Short sentences. The `--ste-inspired` option. None of its content is used. |
| Andrej Karpathy, [post, 2 October 2026](https://x.com/karpathy/status/2105819303471976479) | The "80% of the way to ASD-STE100" instruction. |
| Diátaxis, [diataxis.fr](https://diataxis.fr/) (Daniele Procida, Creative Commons Attribution-ShareAlike 4.0) | Keep reference detail apart from explanation. |
| The word-list sources (above) | The three word lists. Licences and credits are in [`data/NOTICE.md`](./data/NOTICE.md). |
| The `dynamics` plugin's README rewrite (October 2026) | "Lose nothing" and "test on a reader": that rewrite added two false statements that only a reviewer caught. The scores above. |

jargone ships no text from the ISO, IPLF, ASD-STE100 or Diátaxis sources.

How the specification was reviewed is in [`REVIEW-LOG.md`](./REVIEW-LOG.md).

## Licence

The code is under the [MIT licence](./LICENSE). The word lists keep their own licences, listed in
[`data/NOTICE.md`](./data/NOTICE.md).
