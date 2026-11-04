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
| The repository's test suite gives the same result before and after | Not run (stop rule 5) | The session's permission rules refused running the clone's test suite and its validation command. What ran instead: the clone's linter, which passed before and after, and a static stand-in for the docs-scanning test that reads the edited files. That stand-in found 0 unmarked matches of 114 before and after; the pattern the plan added matches its planted sample. The clone was deleted at the close-out, so settling this needs a new clone with the plan applied again, or the plan applied for real: the owner's choice, backlog row HK-054 |
| The map draws | Pass | `check` passes with one recommendation (no where-we-are section). It needs a settings copy that names the branch, because main does not have the new file yet. `map` gives: 121 rows in all = 35 closed + 86 open; open = 0 land now + 3 small choice + 83 not now; 77 open in the backlog, 9 in the playbook. The page is 144 KB, ASCII, with one lane of five milestones, the first one reached |

**The plan.** Seven steps, five commits on the branch (two steps change nothing). The plan asked 17
questions and named four owner's decisions, each answered provisionally. The decisions were: restating fields
beside prose that the repository says must not be restated; replacing its delete-on-close rule with a Done
table, together with the docs that state it and its scanner; its rule that every correction gets an
independent review; and recording the ruling in its decision folder. The review was marked as owed and was
not run.

## Test repository B: a TypeScript engine with five user paths and a multi-register docket

| Criterion | Result | Evidence |
|---|---|---|
| The plan keeps the docket file as the backlog, with its IDs and the formatting its scripts read | Pass | Same path and name. The plan only adds to it: no line deleted, every register and status word kept, and every bold ID still there (the form the launch script reads as a deferral's home). Index tables at its end list each of its 167 rows once |
| It leaves the coordination protocol's files untouched | Pass | Under the coordination folder only the docket changed. The protocol's routing file and readme, the agents' correspondence files, the file that maps who may write which paths, and the owner's file are unchanged. The settings file needs an entry in that path map, so its commit was held as the owner's decision |
| It names, as the owner's decision, any step that conflicts with the repository's rules | Pass | Five, each with the rule's file and line and a provisional choice (below) |
| The docket-reading launch script and the unit tests give the same result before and after | Pass | Same machine. Unit tests: all of the suite passed both times, on both branches. Launch script: same output, byte for byte, apart from one process id; it refuses both times on the same three blockers, one of them inflated by a grep that crashes on this machine, before and after alike |
| No personal email address reaches the page | Pass | The page holds no email-shaped string. This passes partly because of what the plan copies: the docket's two no-reply addresses, at the repository's own domain, sit in cells the index does not copy, and the privacy check would refuse a page holding them (backlog row HK-055) |
| The map shows the five paths | Pass | Five lanes, one per product lane, with the shared path's two milestones reached on each (checked again at the close-out on the rebuilt page, which was byte-identical to the dry run's). `check` passes with two recommendations. `map` gives: 167 rows in all = 55 closed + 112 open; open = 3 land now + 11 small choice + 98 not now; 99 open in the backlog, 13 in the playbook. The split between closed and open is the agent's reading of status words written in prose, with five hand overrides, not a verified status. The page is 179 KB, ASCII, and two builds are byte-identical |

**The plan.** Seven steps on two branches, because the repository's guard judges a whole pull request by
the lane named in its head commit: four commits on a coordination-lane branch and one on a code-lane
branch (two steps change nothing), with the settings file held. The guard passed on both branches, and
two probes, deleted afterwards, showed it blocks the settings file and a mixed branch. The plan asked 15
questions and named five owner's decisions, each answered provisionally:
- a second file against its rule of one backlog and no second register: an index of the outside work,
  whose text stays in the docket;
- the word "playbook", which the repository already uses for its loop method: a different file name;
- the settings file, which the guard fails closed on until its path map names it;
- what "land now" means when every lane works only after the owner's flip;
- which lane makes the commits.

The survey was not blind here either: the agent read the local notes' list of what to expect for test
repository B after most of its reading pass. The inventory ranked one agent correspondence file above the
docket; the repository's own words named the docket.

## Gaps the dry runs found, and what became of them

The close-out (Task 10) closed each gap in the procedures or the inventory, or explained it, and filed what
needs the owner as a row in `../BACKLOG.md`. Each gap is described in the raw reports.

**Closed in the procedures.**
- The agent-guide line of DESIGN 3.6: the plan procedure's step 6 now adds the line `init` writes.
- A prose backlog indexed by a table needs `skipSections`, or `check` gives one warning per list line in the
  prose (41 on test repository A): step 7 and FORMAT.md now say to list every section that holds no row
  table.
- `check` and `map` on the branch, where the committed settings name main: the procedure now says to run
  the Node command with a copy of the settings, kept outside the repository, that names the branch.
- Filed dates taken from the history: step 3 now gives the command, merge commits included. On test
  repository A's clone it found the seven headings that came in with merge commits, which a plain
  `git log -S` missed, and the same day as the plain command for the other 99.
- Status written in prose: step 3 now asks the agent to say how it read each item, and to ask about those
  it is unsure of. The audit's plan row (HK-002) carries a note to try the audit on such a reading.
- A guard that needed separate branches, not only separate commits: the procedure now says so.
- A settings file that a guard fails closed on: step 7 now makes committing it the owner's decision, with
  the two ways (map it in the guard first, or hold it and use `--settings`).
- A neighbour that calls itself living but is stale: step 4 now makes it a question for the owner.
- Outside Claude Code there is no `init` command: the survey procedure now points at FORMAT.md's "New
  repositories" (the note from test repository C).

**Closed in the inventory,** with tests in `tests/survey.test.ts`.
- Code files ranked on their name or their status words: a route file and its tests whose names hold a
  tracker word, a launch script, and source files full of status constants. A file's name and status words
  now count only in prose files (Markdown, plain text, or no extension); in code its TODOs still count. Run
  again on the clones' main branches: test repository A's candidates went from 35 to 29 and B's from 18 to
  14. Every file dropped was code, none was added, and the rest keep their order, scores and hints; the
  guide lines are the same lines. The launch script that reads the docket is still listed as a machine reader of it. On the
  reference repository: 32 candidates, none of them code, where Task 6 gave 46; the backlog is still first
  and the playbook fifth.
- Guide lines cut at 200 characters: the inventory now keeps each line whole (the `--json` output), and the
  text view ends a cut line with `...`; the survey procedure says to read such a line in its file. Test
  repository A's pointer to its build handoff, at character 262 of a 1,377-character line, is now in the
  JSON, and its line is marked as cut. With fewer candidates, the reference repository's text now shows 60
  of its 95 guide lines before the 20,000-character cut, and the JSON has all 95.

**Explained, not changed.**
- Files that outscore the canonical one: test repository B's agent correspondence files, which quote the
  docket's items; test repository A's review responses and its specs whose ID headings name metrics, rules
  or claims; and specs' never-ticked definition-of-done boxes. They carry the signals a tracker carries, and
  no weight tells them apart without fitting the score to one repository. In both runs the agent's reading
  sorted each and none became a row. The survey procedure now names these kinds and says the repository's
  own words decide. The weights stay as they are: the call Task 6's ruling left to this task.
- A tracker word inside a longer word of a prose file's name: kept, because a tighter pattern would miss
  trackers named as compounds. A name alone scores 3.0, the lowest score a candidate can have.
- Test repository A's misses (a review response holding the release plan, a dependency document's open
  decision, a review triage, and the brief for gathering test data) carry no tracker signal of their
  own. The procedure already sends the agent to what a reference or guide line points at, and the reading
  pass found all but the triage.
- Test repository A's rule that every correction gets an independent review cannot be met by a dry run,
  which merges nothing: a limit of dry runs, not of the procedures.

**Filed for the owner,** as backlog rows:
- HK-054: test repository A's suite, not run before and after;
- HK-055: no-reply addresses at another domain, which the design allows and the privacy check refuses;
- HK-056: the settings, read only at the root;
- HK-057: a checklist kept apart from the pair, which cannot gate a milestone;
- HK-058 and HK-059: applying the plans to test repositories A and B for real, with the owner's answers to
  their questions and decisions.
