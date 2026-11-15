# J05 on the long-form articles (plan, fixed before any rewrite)

Written 2026-11-15, at the maintainer's request, after the J05 fix (JAR-004, commit feb399c on
`claude/jargone-spec`) and before any rewrite of these articles was made. It repeats the government texts' test
(`../2026-11-15-checks-everyday-followup/`, part 3 and its retest) on the five articles in `SOURCES.md`.

## What runs

1. **A one-shot rewrite of each article** for its reader, "a curious adult with no background in the subject of
   this article". The standing instruction (the session-mode text in `prompt.md` at commit feb399c, with the
   reader filled in) is appended to the system prompt, and the request is the follow-up's `prompts/rewrite.txt`.
   One call each, retried once if it returns fewer than 100 words.
2. **J05 from commit feb399c on each rewrite,** against its original, with no reference file and default
   settings.
3. **A judge call per article,** not playing the reader, with the follow-up's `prompts/j05.txt`. Shown the
   original, the rewrite and each J05 finding, it says whether what the item carries is in the rewrite in another
   form (restated) or not at all (lost).

A finding is **true** when the item is lost. Model calls run as before: from an empty folder, with no tools and no
project instructions, with the earlier studies' model named at run time.

**What is kept on this branch.** The rewrites are made from copyrighted articles, so they stay off it, with the
prompts and the judges' quotations. Kept: each J05 finding's item and line number, the kind of finding, and the
judge's verdict.

## Measures

- J05's findings, lost and restated, by article.
- By kind, as in the retest: a number used once and gone; a number used several times with none left; a number
  used several times and still there, but used fewer times.
- Each restatement's kind, sorted by Claude: one JAR-004 should have handled (a thousands separator, a date in
  another form, numbering that opens a block), a count shortfall, or another kind.
- Cost.

## Rule

J05 stays the core check either way. If more than 1 in 5 of its findings are restatements, the kinds are
reported. A restatement of a kind JAR-004 should have handled reopens JAR-004; a new kind is filed in the
backlog. Count shortfalls feed the maintainer's open choice of error or warning.

## Limits

- The articles were extracted as prose, so they hold no links or code: here J05 tests numbers only.
- One rewrite per article and one judge call per question.
- These rules were set by Claude, not the maintainer, and are fixed in this commit.
