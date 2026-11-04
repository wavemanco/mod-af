# Phase 2 results

Each completion criterion of `DESIGN.md` section 7 for Phase 2, marked pass or fail with its evidence. The
test repositories are described, never named. The dry runs worked in full clones in the session's scratch
folder, applied their plans on a branch there, and pushed nothing; their full reports are in the local raw
notes. In each dry run the agent stood in for the owner: every question the plan asked got a provisional
answer, and every conflict with the repository's own rules got a provisional choice, all listed in the raw
report.

## Test repository C: a new, empty repository

| Criterion | Result | Evidence |
|---|---|---|
| The survey says there is nothing to move and offers `init` | Pass | The inventory read 0 files and found 0 candidates, and said "nothing to move. /housekeeping init sets up the pair."; following the survey procedure, the answer was the same. The repository's status was unchanged afterwards. `init` on an empty repository already passed in Phase 1 |

## Test repository A: a Python research harness with one long prose backlog

| Criterion | Result | Evidence |
|---|---|---|
| The survey finds the canonical backlog | Pass | Ranked first by the inventory; the repository's guide and README name it as the place for deferred work |
| It finds most of the reference list and names what it missed | Pass | The inventory alone surfaced 15 of the list's 20 entries. Missed: a review response holding the release plan and its filed items, a build handoff's "not done" list, a dependency document's open decision with its design notes, a review triage with its verification notes, and the brief for gathering test data. The agent's reading pass found 19 of 20, missing only the review triage and its notes. It was not blind: the agent had read the list before surveying |
| It counts none of the history as pending | Pass | No row came from the history file, the dated working notes, the review responses, a run log or a stale "living" roadmap. An outside act already settled became a Done row |
| The plan keeps the backlog's name and IDs | Pass | All 106 item headings are unchanged, and so is the prose, except the opening and the close rule. New tables at the end index 110 IDs: 77 open and 33 done, four of them deleted under the old close rule and taken from the history |
| It edits no frozen field | Pass | Nothing changed under the frozen configurations or their lock |
| No link points at a moved item | Pass | No item changed file. Every ID that code, tests, configurations or docs cite still has its section; the four IDs that had no section before now have Done rows |
| The repository's test suite gives the same result before and after | Not run (stop rule 5) | The session's permission rules refused running the clone's test suite and its validation command. What ran instead: the clone's linter, which passed before and after, and a static stand-in for the docs-scanning test that reads the edited files. That stand-in found 0 unmarked matches of 114 before and after; the pattern the plan added matches its planted sample. The owner can run the two commands in the clone |
| The map draws | Pass | `check` passes with one recommendation (no where-we-are section). It needs a settings copy that names the branch, because main does not have the new file yet. `map` gives: 121 rows in all = 35 closed + 86 open; open = 0 land now + 3 small choice + 83 not now; 77 open in the backlog, 9 in the playbook. The page is 144 KB, ASCII, with one lane of five milestones, the first one reached |

**The plan.** Seven steps, five commits on the branch (two steps change nothing). The plan asked 17
questions and named four owner's decisions, each answered provisionally. The decisions were: restating fields
beside prose that the repository says must not be restated; replacing its delete-on-close rule with a Done
table, together with the docs that state it and its scanner; its rule that every correction gets an
independent review; and recording the ruling in its decision folder. The review was marked as owed and was
not run.

## Gaps the dry runs found

For Task 10. Each one is described in the raw report.

- The plan procedure does not ask for the agent-guide line that DESIGN 3.6 says `plan` adds.
- A prose backlog indexed by a table needs `skipSections`, or `check` gives one warning per bullet line in
  the prose (41 on test repository A). The procedure and FORMAT.md do not say so.
- Until the branch merges, the committed settings name main, so `check` fails there. The procedure says to
  finish with `check` and `map`, but not how to run them on the branch.
- Filed dates taken from the history need merge commits included. The procedure gives no method for a row
  with no date.
- The inventory ranks two review responses and six specs, whose ID headings name metrics, rules or claims,
  as likely trackers. It also lists source files on status words alone. Its misses are listed above. Its
  text view cuts guide lines at 200 characters, so one pointer to a neighbour is lost.
