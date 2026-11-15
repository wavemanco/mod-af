# Follow-up on the everyday texts: J01 rejudged, J03's sentence counting, J05 on rewrites (plan, fixed before any results)

Written 2026-11-15, before any of these runs, at the maintainer's request. It uses the five texts of
[`../2026-11-10-wordlist-checks-everyday/`](../2026-11-10-wordlist-checks-everyday/) (the same files; their
sha256 are in its `SOURCES.md`) and the checker at commit 7eb9cac of `claude/jargone-spec`. Model calls run
as in that study: one call each, from an empty folder, with no tools and no project instructions, and a failed
call is retried once.

## 1. J01 and J04, rejudged with a fixed question

**Why.** In the first run the judge contradicted itself: of 11 flagged terms it had listed word for word as
terms it would not understand, its second call said it would understand 7. Its "it is a name" option let a term
such as NTSB pass as understood.

**How.** The same 31 findings (J01 29, J04 2; the first run's `findings.json`). Two calls per text:
1. **The reader explains** (`prompts/explain.txt`): playing the named reader, for each flagged term, it says in
   its own words what the term means or refers to there, or "I don't know".
2. **A checker marks the explanations** (`prompts/verify.txt`): a separate call, not playing the reader, shown
   the text and the reader's explanations, marks each right, partly right, wrong, or none.

A finding is **true** when the reader's explanation is not marked right (partly, wrong or none). The count with
"partly" read as understood is reported too.

**Rule.** As in the first run: J01 is kept as an optional hint for everyday audiences if at least half its
findings are true, and is dropped otherwise. J04's 2 findings remain too few to judge. If this verdict differs
from the first run's, both are reported, and this one, made with the fixed question, is the one put to the
maintainer, who decides.

## 2. J03: does it count sentences right in legal and government text?

**Why.** The checker ends a sentence at every full stop except after a short list of abbreviations ("Dr.",
"e.g.", "etc."). These texts use abbreviations that are not on the list, so a long sentence may be cut into
pieces and missed.

**How, with no model.** J03 with its default limits runs twice on each text: with the checker as it is, and
with a scratch copy in which these abbreviations, found in the texts before any run, are added to the list of
abbreviations a full stop never ends a sentence after: App, Arg, Cf, F, Fed, Id, Minn, N, No, Pp, Pub, Reg,
Rev, S, Stat, Subds, Supp, Tr, U, W and v. The two runs' findings are compared, along with each text's number
of sentences and its longest sentence. Claude checks each difference by hand against the text and records it.

**Rule.** J03 itself stays. If the checker as it is misses a sentence over the limit, or flags one that is not,
because of an abbreviation, a fix is filed in jargone's backlog with this result as its evidence.

## 3. J05 on one-shot rewrites

**Why.** J05, "nothing lost", is to be `/jargone`'s core check. In the everyday comparison it reported 9 losses
on the one-shot rewrites that a hand check found were numbers restated, not lost.

**How.**
1. **A one-shot rewrite of each text for its reader:** the standing instruction (the session-mode text in
   `prompt.md` at commit 7eb9cac, with the reader filled in) as an appended system prompt, and the request in
   `prompts/rewrite.txt`.
2. **J05 on each rewrite,** against its original, with no reference file.
3. **A judge call per text** (`prompts/j05.txt`), not playing the reader: shown the original, the rewrite and each
   J05 finding, it says whether what the item carries is in the rewrite in another form (restated) or not at
   all (lost).

A finding is **true** when the item is lost.

**Rule.** J05 stays the core check either way. If more than 1 in 5 of its findings are restatements, a fix that
recognises restated numbers is filed in jargone's backlog, due before `/jargone` ships with J05 as its core.

## Limits

- Model judges, one call per question, five texts.
- Part 2's differences are checked by Claude.
- These rules were set by Claude, not the maintainer, and are fixed in this commit, before any result.
