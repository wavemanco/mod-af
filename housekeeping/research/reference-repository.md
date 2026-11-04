# The reference repository: what its backlog, playbook and Route Map do, and what carries over

This file sums up what the housekeeping design learned from the reference repository, where the backlog and playbook pair and the Route Map were first built. The research ran from 2026-11-02 to 2026-11-03. It is distilled from the design session's raw notes, which are kept locally and not published because they name the repositories.

## What we read, and its state

Readers read the two record files, the generator and its page, the script that lists rows a branch's changes trigger, and the decision and conversation records. The recon ran the generator once; nobody ran the format test or opened the published page.

It is a TypeScript product with eight user paths it calls configurations. Agents keep its records in long prose, parsable only since 2026-10-23. The generator printed 391 rows: 199 closed and 192 open (130 backlog, 62 playbook), the open ones 2 land now, 21 small choice and 169 not now. The checks confirmed this; one challenge's rough count found 191 open. "Closed" counts Done entries (199), not IDs (147).

## Backlog and playbook

The backlog holds work done in the repository: a row closes with a commit. The playbook holds what happens outside it (people and roles, outside actions, the budget, standing duties, milestones): a row closes with an act.

The test is Claude's definition, which the owner chose with "Apply as proposed (Recommended)" on 2026-10-31; every open row then moved to its side. Keeping a moved row's ID is the owner's choice. The note of where it was filed before is Claude's: the owner later said "so then we don;t need that earlier addition I suggested", and Claude kept it anyway.

## The row format

Each table's header must be exactly these 15 columns, case included.

| Column | Values |
|---|---|
| ID | a prefix and fixed width per file |
| Item, Details | free text |
| Who | agent, owner, both |
| Land now | `yes`, `small choice: …`, `no: …` |
| Waits on | pending IDs, or `—` |
| Milestone | 11 names, main one first, or `none` |
| Trigger type | now, event, other-row, owner-decision, milestone, date |
| Trigger | at most 30 words |
| Status, Priority, Size | open/partly; high/medium/low; S to XL |
| Kind | 10 values |
| Filed, Files | a date; related files, which no reader found a script using |

The owner wanted Priority and Trigger type as columns: "they should be columns because that helps make the Git files readable too no?". A `yes` row must have Who agent and no Waits on (one way only). Waits on accepts only pending rows, so closing a row forces its dependents to be edited.

The Done table has the item (ID in brackets inside the cell), where it landed and its row: no ID, milestone or date column. It also holds the playbook's closed rows. The Launch checklist (46 lines) and Review checklist (69) live only in the backlog.

## The generator and its three panes

A plain Node script (Node 24 or later, no npm packages, `git` on PATH) writes one self-contained page with the data embedded as JSON, stamped with the commit, the day and any uncommitted changes to the two files. It is published at a fixed private link after each records change reaches main.

The three panes are the backlog's, the playbook's, and Routes across both. Views: Land now (by main milestone); Your queue (123 rows: 21 small choices plus 102 where Who is owner or both, sorted by milestone, priority, then reach); Waiting on (by the text after `no:`); All open rows; Routes (open stops per milestone); and the two checklists, in the backlog pane only. The script computes what each row unlocks (Waits on read in reverse), down the chain.

The page is 808,377 bytes, 761,875 characters of it data.

## How well it answers the owner's four questions

| Question | Verdict | Gaps |
|---|---|---|
| 1. What can an agent land now, and what does that unblock? | Partly | Unlocks are computed but Land now does not show them, nor which rows become landable when a row closes or a milestone is reached. Land now is typed by hand. |
| 2. What needs the owner's decision, and by when? | Partly on what, not on when | The queue mixes decisions with outside actions. No due date: 14 rows have a date trigger, in prose ("~mid-November 2026"), and nothing flags a passed one. |
| 3. Where are we, how far is the next milestone, which is it? | Not answered | "Where we are" is not read in, the next milestone is hard-coded, and Done has no milestone, so progress cannot be counted. The real gate, the Launch checklist (36 of 46 open), is not linked. |
| 4. What is deferred, and on what trigger? | Partly | No view groups by trigger. Waiting on gives 159 groups for 169 rows, as near-identical reasons differ. "Deferred" is never defined. |

The owner's Q2 was "what needs my decision? when?". Q4 is cut off ("what triggers") and may mean "which have fired". A script could check the date, other-row and milestone triggers (90 of 192 open rows); today's sees only file and code names. Many passed dates hang off one parked row, so a date view should say that once.

The notes disagree on one point: a row is `yes` while its event trigger has not fired. The recon calls it a defect; the critic says Land now may mean "could land", not "is due", which makes it the owner's decision.

## Fields that contradict each other

- Kind `owner-decision` has 20 rows, Trigger type `owner-decision` 21; 12 rows of that Kind are not a small choice.
- 3 small-choice rows have Who agent.
- Trigger type and Land now disagree on all 3 rows where either says "now".
- All 15 high-priority rows share one main milestone, so Priority adds little.

So each field answers "what needs the owner" differently. Typed text drifts too: the Review checklist says "45 open, 24 ticked" where its lines give 35 and 34, and "Where we are" (one 718-word paragraph) is dated 2026-10-28 but reports 2026-10-31.

## Fragile points

- **Silent drops.** A table with another header is skipped, and format problems only warn (exit 0). A bad Land now shows as `no`, a duplicate ID keeps its first row, an unknown milestone lands on no route, and a dependency cycle is broken arbitrarily.
- **Done counting.** Any ID-shaped token in the Done section counts, prose included.
- **Standing duties have no marker.** A `yes` duty heads the Land now list forever, and two high-priority duties on the first live use route make "All clear" impossible.
- **Which main.** The stamp reads the checked-out branch, and a published page cannot see a newer main.
- **Dead triggers.** Renaming a code name a trigger watches kills it silently.
- **Size.** An in-session pane draws at most 100,000 characters; folding Details saves no bytes.
- **Second source of truth.** The milestone order is a constant in the script, with a prose copy in the backlog.

## Settings, rules, or drop

| Assumption | General version |
|---|---|
| File paths, publish link, project name | Settings |
| 15 exact columns | Rule for a core set; settings for aliases and extras |
| Status, Who, `—` for nothing | Keep; also accept `-` and empty |
| Priority, Trigger type values, 30-word Trigger | Rule (disputed below) |
| Milestones and order, in the script | Settings: a milestones table with order, definition and target date |
| Size, Kind | Optional, or drop |
| ID prefixes and the repository's other ID schemes | Settings |
| Section names, which checklists get tabs | Settings with defaults; plan and Done required |
| One Done table, in the backlog, IDs found by text | Rule: each file has its own Done, with an ID column |
| vitest format test, Node 24 | The mod's own check; test repository A has no Node |

## What carries over as the germ

- **The split by one test**, a trigger on every row, and IDs kept when rows move. A general version cannot assume two files: test repository B has a one-backlog ruling.
- **A small core of columns.** One challenge kept five fields that must be kept true (Milestone, Who, Land now, Trigger, Waits on) and proposed cutting Status, Priority, Size, Kind, Trigger type and Files. The recon would keep Priority and Trigger type, as the owner asked. This is open.
- **Compute, do not type.** Unlocks come from Waits on; typed counts should be deleted, not checked.
- **One version of truth:** the same commit gives the same page on any machine, and outside facts reach it only as a dated note an agent wrote into a row.
- **The generator's habits:** plain Node, one page, ASCII-escaped output, partitioned headline numbers, one bad fixture per format rule.
- **Once per path, not per row:** each path's milestones in order, each with a one-line "done when". But here milestones are not tied to configurations, so a paths table alone draws identical lanes; one challenge suggests reading a row's path from the Launch lines that name it. Open.
- **A date convention** (a Trigger with a date starts with it, `YYYY-MM` or `YYYY-MM-DD`, `~` allowed) was proposed, then dropped: on 2026-11-03 the owner ruled that triggers are steps, not dates.
- **A warnings strip** shown only when something is wrong.
- **Still missing:** a duty marker, whether a closed ID stays in Waits on, and how Q2's "when" is answered without dates in triggers. A "doors just opened" view needs it to stay; the reference rule removes it.
