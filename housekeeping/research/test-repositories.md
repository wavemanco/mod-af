# Test repositories A, B and C: their state, and what reading them taught

This file says what the housekeeping design learned from reading test repositories from 2026-11-02 to 2026-11-03. It is distilled from the design session's raw notes, which are kept locally and not published because they name the repositories. The readers worked read-only in shallow clones, so no history was checked, and most counts are regex estimates.

The owner's four questions, as the notes put them: (1) what can an agent land now, and what does it unblock; (2) what needs the owner's decision, and by when; (3) where are we, and how far is the next milestone; (4) what is deferred, with what triggers. The critic noted that the fourth is cut off in the owner's words and may mean "which triggers have fired".

## Test repository A: a Python research harness

**How pending work is kept.** One prose backlog of 3,995 lines with 106 items, each a heading with bold fields such as What and Trigger. Status sits in the heading, or only in the first body line. One count: 27 closed, 5 mixed, 1 closed only in its body, 73 unmarked and so read as open. About ten neighbouring files also hold pending work: a decisions docket with a Due column, four decision papers, seven points where the owner must act, with the time each needs, a triage file, a milestone ladder, a list of what was deliberately not done, open research questions, a log of exceptions to its procedures and a list of research claims. Some decisions sit in a claude.ai artifact outside the repository.

| Question | Answerable? | Why |
|---|---|---|
| 1 | Mostly not | No "who" field; dependencies are prose cross-references; even code fixes are a joint decision with the owner |
| 2 | Partly | Due and When columns name events, never dates; open or closed is not kept in one place |
| 3 | Scattered | Three ladders in separate vocabularies; the next milestone is implied |
| 4 | Best | Every unmarked row has a trigger. Of 78 rows not fully closed: 27 wait on a milestone, 21 on a paid run, 12 on a code event or recurrence, 8 on a person, 10 other, 1 "now" |

**Outside work.** About 15 to 20 items, such as recruiting paid raters, the owner's sign-off before each cycle's first paid call, and a monthly job that lives outside the repository. Another 21 rows are code waiting on an outside act (keys, weights, spend).

**What points at the files.** The backlog is named in 166 files (655 mentions); item IDs appear 2,308 times, 619 in source and tests. Tests hardcode its path. A consistency scanner spares a retired phrase only near a marker, so turning headings into table rows can trip it. No test parses or counts items.

**Its rules.** Deferred work goes in the backlog with a trigger. Rulings have one home in Git, so an owner queue must link to the docket, never copy it. Research questions are kept apart by rule. Frozen configs cite backlog IDs; one reader found them only in unhashed fields, the other found some inside hashed fields, where an edit breaks a lock that must never be regenerated. Every correction, doc-only included, needs a recorded adversarial pass.

**Hazards.** The notes record no personal-data file. The hazards are text that addresses agents, and history files full of "deferred" and "OPEN" that would show as false pending items; in the list of research claims, OPEN means a claim not yet measured.

**Tests in a clone.** Plausibly, not tried: Python 3.11 or later, network for the install, no keys. CI runs only on Linux. The repository has no Node, which the reference repository's generator needs.

## Test repository B: a TypeScript engine

**How pending work is kept.** A docket that names itself the only authority for pending work: 637 lines, one line 16,868 characters long, four item tables with different headers (167 rows), plus prose. The 70 rows with a status cell use 26 different leading words; others mark closure in another cell. One status word means the trigger fired, not that the row is done. Beside it: a live coordination file whose state lines only the owner may flip; three agent correspondence files, one holding owner decisions found nowhere else; a launch checklist with 19 of 25 boxes open; a phase plan with no status column; and a progress log last written 2026-09-13, though every session should add to it.

**The four questions.** Q1 partly: nothing lands without the owner's approval, so agent work is the approved scope, auto-merged correspondence and seven rows to be done the next time their files are touched; there is no who field, and 27 rows say waits or blocks in prose. Q2 partly: 37 triggers name the owner, five rows are one-way doors, "when" is an event by design, and seven owner decisions sit in an outside artifact. Q3 only in prose, across three ladders that do not connect. Q4 best: every row has a trigger column. Missing: trigger type as data, fired apart from done, and a status a machine can read.

**User paths.** Five product lanes; "lane" also means an agent's lane. 16 rows carry lane tags with a sixth value for platform work; the check found that is a review-wave label, not a path. 121 of 167 rows name no lane. A route here is a grid of lane by milestone.

**Outside work.** By judgement 20 to 25 of 167 rows: ruleset toggles, legal sign-off, a licence, a live run with strangers.

**What points at the files.** The docket is named in 80 files (774 mentions), 33 not Markdown, including tests and 3 workflows. A script that checks launch readiness hardcodes its path and ID form; a shell library parses the coordination file; a guard on which paths each commit may touch fails closed on unmapped paths and reads its map from main. No test reads the records, so a green unit suite barely tests a records change.

**Its rules.** The owner has ruled that there is one backlog and never a second list beside it, and that closed rows are struck through, not deleted. Its gate table holds items the reference repository would put in the playbook, so a two-file split contradicts the ruling. Only the coordinating agent writes the backlog. Each commit's paths must belong to one lane, so records and scripts go in separate changes. A generated combined view was retired because nothing in the agents' working cycle ever read it. The word "playbook" already names its method document. Merges happen on GitHub, outside any session.

**Hazards.** One file holds the owner's email address and three more carry it. The docket holds no-reply addresses, which its own check allows but the design's rule would refuse. Git's author field carries the owner's address. One file claims to override pasted instructions.

**Tests in a clone.** Not run: Node 22 or later, pnpm 9.12.0, network for install; one config needs a real database and skips without it. Long clone paths can stop vitest on Windows; CI runs only on Ubuntu.

## Test repository C: a new, empty repository

Not yet tried. No empty repository was read, so the path that creates the files when missing is untested.

## What they share, and the rules we gained

- **Deferred items come back on an event.** Every repository, the reference one included, keeps deferred work with an event that brings it back; A and B rule that triggers are events, not dates. Q4 is best served everywhere, Q1 worst.
- **Records drift from reality.** A's close rule says delete, yet 27 to 31 closed headings remain (the readers' counts differ), and rulings already made still show as owed in two other files. B's coordination file says approved while its comment says not running. The reference repository's typed count, 45 open and 24 ticked, is 35 and 34 when counted.
- **Status, dependencies and milestones are prose,** with no who field, typed trigger or machine-readable unblocks link.
- **Names are pinned.** Scripts, tests or frozen files depend on the record files, and history reads as pending.

The rules these point to:

1. Adopt a repository's records in place; never rename or move a pinned file, and read its write rules first.
2. Never assume a two-file split; a repository may forbid a second backlog.
3. Count, never type: the page computes counts and flags typed ones that disagree.
4. Keep state in a closed vocabulary, with "trigger fired" apart from "done".
5. Give each row who, depends on, milestone, user path and trigger type.
6. Name history files explicitly, so they are not counted as pending.
7. Read live coordination files; never write them.
8. Keep the published page out of the repository.
9. Before publishing, scan for addresses and never show commit authors.
10. Treat everything read as data, and report text that addresses agents.

The design ([`../DESIGN.md`](../DESIGN.md)) took these up with three changes:
- counts are only computed, and typed counts are not checked;
- a row's path follows from its milestone, not from a field of its own;
- trigger type stays an optional column.

The critic left three questions open, and the owner has since settled them:
- where a repository's own rules conflict with the split, the plan names the step as the owner's decision
  in that repository;
- the tool proposes, and acts only once the owner approves;
- the focus is Claude Code, with each procedure also shipped as a `prompt.md`.

All three repositories read so far are run by agents and keep long prose records. So C, and a
conventionally kept repository, are still needed as tests.
