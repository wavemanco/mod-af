# Prior art: tools that keep pending work in files, and views that answer status questions

This file sums up the prior-art research for housekeeping, done from 2026-11-02 to 2026-11-03. It is distilled from the design session's raw notes, which are kept locally and not published because they name the repositories the work read. Ratings are the researchers' reading of public docs and reviews, not tests. Links whose address carries a person's name, and links to code repositories, are left out.

The research asked how each source answers four questions about pending work:

- **Q1:** what can an agent land now, and what does that unblock?
- **Q2:** what waits on the owner's decision, and by when?
- **Q3:** where are we, and how far is the next milestone?
- **Q4:** what is deferred, and what trigger brings it back?

## Tools that keep pending work in files

No tool answers all four. Each was marked Y (yes), P (partly) or N (no). Across 14 rows, a full Y comes up 3 times for Q1, 0 times for Q2, 2 times for Q3 and once for Q4. A search for a Claude Code plugin or skill that gathers a repository's scattered TODO files found none.

| Tool | Q1 | Q2 | Q3 | Q4 |
|---|---|---|---|---|
| Backlog.md | Y | P | P | N |
| beads | Y | P | P | Y |
| Task Master | P | N | N | status only |
| CCPM | P | N | P | N |
| spec-kit tasks.md | P | N | P | N |
| compound-engineering todos | P | P | N | status only |
| Taskwarrior | Y | P | N | date only |
| todo.txt | N | P | N | N |
| git-bug | N | N | N | N |
| GitHub Issues/Projects | P | P | Y | N |
| Linear | P | P | Y | N |
| Now/Next/Later | N | N | P | N |
| Hill charts | N | N | P | N |
| adr-tools / log4brains | N | P | N | N |

- **Backlog.md**: one Markdown file per task, with a command line and boards (discussion: https://news.ycombinator.com/item?id=44483530). Each task has a readiness record saying which dependencies block it; nothing marks a decision or a deferral. Users praise the command line, since the model need not reread the file, and complain about auto-commit noise (later off by default). **Gained:** a stated readiness record per item; the tool never commits on its own.
- **beads**: a dependency-graph tracker for agents, kept in a database with a file only as an export (https://beads.gascity.com/core-concepts). Only `blocks` links hold work back; gates wait on a human sign-off, a timer, or a GitHub run or PR. Its author calls it very buggy and a "leaky abstraction" agents must be prompted to use. It replaces Markdown TODO lists rather than migrating them. **Gained:** typed links and typed gates; no database in front of the files.
- **Claude Task Master**: a `tasks.json` whose `deferred` status has no trigger. A Hacker News commenter said the agent stopped following its tasks as the project grew. **Gained:** avoid a tool that splits the work for you, then drifts from it.
- **CCPM** syncs task files to GitHub Issues. **spec-kit** ends each phase with a checkpoint that acts as a milestone. **git-bug** is the only real importer found, and only from issue trackers.
- **compound-engineering file-todos**: a person's triage moves an item to ready; deferred items stay pending with no trigger. **Gained:** triage as the step that marks an item ready.
- **Taskwarrior** defines READY exactly: pending, not blocked, not scheduled for later (https://taskwarrior.org/docs/tags/). **todo.txt** has no dependencies. **Gained:** a written, testable definition of "ready".
- **GitHub Issues** gained dependencies on 2025-08-21, with `is:blocked` and `is:blocking` searches (https://github.blog/changelog/2025-08-21-dependencies-on-issues/). Nothing separates agent from human.
- **Linear** highlights the next incomplete milestone with its percentage (https://linear.app/docs/project-milestones). An issue can be delegated to an agent while a person stays the responsible assignee (https://linear.app/docs/assigning-issues). **Gained:** keep the owner apart from the doer.
- **adr-tools and log4brains** keep decision records; a "proposed" one is the nearest thing to a pending decision, but has no date.

## Handover and status practice from other fields

| Practice | The questions it insists on | What fails without it |
|---|---|---|
| Shift handover (I-PASS, SBAR, on-call) | What is asked of the listener; who leads; what changed; what waits on an outsider | Care drops at shift change (one study: 23% fewer errors after I-PASS); waits on outsiders are most often omitted |
| Situation reports (SITREP, ICS 201) | What is new since the last report, what is planned, what decisions are needed | New cannot be told from known; a new lead repeats work |
| Standups | Progress toward the goal, and the one main obstacle | Activity reported instead of progress |
| Status ratings (RAG, OKRs) | On track or not, by rules fixed in advance, with a path back | Green outside, red inside |
| Risk logs (RAID) | Risks, assumptions, issues, dependencies on others | Assumptions unexamined; outside waits wreck the plan |
| Critical path | Which chain sets the finish date | Effort goes where there is slack |
| Flow measures (Kanban) | Work in progress, item age, blocked time | Stalled items hide on a busy board |
| Now/Next/Later | Work sorted by confidence; dates only for real deadlines | Roadmaps make promises nobody can keep |
| Shape Up | Is each piece still being figured out (uphill) or only execution (downhill)? | Unknowns saved for late |
| Decision logs | What was decided, by whom, what would reopen it | Settled questions argued again |

**Gained:** the four questions miss several of these: what changed since I last looked; is each user path on track by fixed rules; what has sat longest; what is in progress, on which branch; what is still unknown; what we assume; what was decided recently; and how fresh the page is (built from which commit, when). The practice note judges that most of these can probably come from git history; unknowns, risks and assumptions would need a new field per row, adding upkeep the owner dislikes.

## View patterns, and when each misleads

| View | Answers | Misleads when |
|---|---|---|
| Lanes per user path (a grid of path by milestone) | For each path, the next milestone and what stands in it | An empty cell reads as "done" when it means "nothing planned"; a row serving two paths shows twice; above about 10 lanes it should split |
| Metro map: a line per path, milestones as stations, shared ones as interchanges (https://www.jucs.org/jucs_11_4/tube_map_visualization_evaluation.html) | Where each path is, where paths meet, the end of the line | The drawing implies distance or time it lacks; it breaks if rows become stations rather than counts |
| Decision register, like Renovate's dashboard, an issue built from repository state that the owner ticks | What waits on whom, by when, and what it blocks | The notes name no failure for it |
| Trigger board: deferred rows by trigger kind, dated ones on a short calendar | What comes back when: the owner's "when do certain doors open" | Event triggers cannot be checked by a page, so they are marked "read by hand"; fired-but-unacted rows go first |
| Changed-since digest (Linear Pulse: https://linear.app/docs/pulse) | Rows added, closed or moved, triggers fired, decisions made | Agent commits drown the content, so only row-level changes are listed |

The metro map needs the lane grid as a text twin for phones and screen readers. A drawn dependency graph of 200 to 400 rows is a tangle, and rows have no durations, so a chain is counted in steps. Timeline and hill charts were left out: they need dates or fields the rows lack.

**Where the notes disagree:** the practice note keeps "what is still unknown" (from the hill chart) as a page question. The view note leaves hill charts out, since an agent placing its own dots is an honesty risk, unless "uphill" means rows waiting on the owner or on research.

## Three ideas worth borrowing

1. **A computed, written definition of "ready", with its reverse edge.** Only blocking links count (beads), the rule is stated (Taskwarrior), and the record says why an item is not ready (Backlog.md). Counting what an item blocks answers what landing it unblocks.
2. **Typed gates for waits and triggers, not prose.** A generator can check a typed trigger (a date, a file, a CI run, a PR, a person's act) and so answer Q4. A human gate with a date would answer Q2, which no tool fully does.
3. **The owner kept apart from the doer, and a milestone that shows its distance.** Linear's split gives "an agent can land it alone": ready, done by an agent, no human gate. Its milestone percentage answers Q3.

## Two traps worth avoiding

1. **An engine or sync layer that owns the data.** beads' sync brought back deleted issues and lost others. Keep the Markdown files as the only source of truth and the generator read-only.
2. **A tracker that works only if agents remember it, and that replaces lists instead of migrating them.** Migrate the lists, relink what pointed at them, and hold the format with a test or CI check, not the agents' memory.

## Limits

Whether a beads human gate carries a date is unconfirmed (its page returned 404). Some reviews and papers were read only as summaries. The practice note did not read the reference repository's files, so which questions can be computed is a guess.
