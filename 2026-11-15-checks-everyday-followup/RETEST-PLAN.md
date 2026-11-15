# Retest of part 3 after the J05 fix (plan, fixed before the run)

Written 2026-11-15, after JAR-004 was fixed (commit feb399c on `claude/jargone-spec`) and before J05 was run
again. At the maintainer's request: if the fix warrants a retest on the current texts, run it.

**What runs.** J05 from commit feb399c, on the same five rewrites in `rewrites/`, against the same originals,
with the same settings as part 3. No new rewrites.

**How it is read.** Each new finding is matched to part 3's findings by text and item. Reported:
- which of part 3's 21 restatements are gone, and which remain;
- whether every one of part 3's 54 losses is still reported, and for each that is not, why;
- any finding that is new, for example a lost date now reported once as a date. Each new finding is judged with
  `prompts/j05.txt`, as in part 3.

**Expected, fixed now.** The 11 restatements of three kinds disappear: 7 dates, 3 list numbers and 1 thousands
separator. The 10 count shortfalls remain, with the new message. Every real loss is still reported. The only
exceptions are numbering that opens a heading (now structure) and parts of a date (now counted as one date).

**Rule.** If any real loss disappears for another reason, the fix is wrong for that case: it is reopened in
JAR-004 before the long-form test.
