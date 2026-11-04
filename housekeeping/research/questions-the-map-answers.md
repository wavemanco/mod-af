# The questions the Route Map must answer

This file says which questions the Route Map must answer, for whom, and from which fields. It covers research done from 2026-11-02 to 2026-11-03. It is distilled from the design session's raw notes, which are kept locally and not published because they name the repositories.

## Sources

| Source | What we read, and its state | What we gained |
|---|---|---|
| The reference repository's conversation record | 196 owner entries, about 75 on orientation | The question bank |
| The reference repository's backlog and playbook | 192 open rows (one challenge's rough count: 191) and the generator script; they drift (a typed count is wrong, fields contradict each other) | The verdicts and the fields |
| Published practice on long-running agents (Chroma, Anthropic, Manus, OpenAI, Cognition, beads and others) | Posts and papers, some only through search summaries | What an agent needs |

## The owner's four questions

As the bank records them:

1. What items can be landed by an agent right now without needing the owner? What does that unblock?
2. What needs the owner's decision? When?
3. Where are we in the development process? How far from the next major milestone? What is that milestone?
4. What is deferred with triggers? What triggers?

They are a representative set, not the whole list. The owner said user paths are "like superset of milestones", so most are asked once per path. The four leave out what "done" means, what changed since the last session, settled choices, unfiled work, whether the map is current, and the owner's own words.

## What the owner asked most

Counts are the sweep's own tallies, about ±1 each; one entry can count in more than one kind.

| Kind | Entries | In the owner's words |
|---|---|---|
| What does this item mean, and why is it here? | 13 | "how did this thing come in suddenly?" |
| Is everything filed with a trigger? | 12 | "is everything filed in backlog with triggers?" |
| In-flight work lost when a session ends | 11 | nine "resume" entries, two "Try again" |
| Is it moving, or looping? | 10 | "Things keep moving but nothing moves to all clear ever" |
| What can the agent land now without me? | 8 | "what can YOU land today without needing any decisions from me?" |
| What needs my decision, and have I given it? | 8 | "have I provided all 10 decisions?" |
| Where are we? | 8 | "Now I am not even sure where we stand." |
| What was chosen and rejected, and why | 7 | "document the rejected options somewhere" |
| Do the numbers add up? | 6 | "is it 60 or is it 43?" |

The notes disagree on which question leads: the bank calls "is everything filed" the one asked most often, while the kind counts put "what does this mean" one higher. The owner also said what they do not want: ceremony ("I suspect this feels ceremonial"), agent sweeps for bookkeeping, duplicate views in the repository, and housekeeping put to them ("you shouldn;t even be asking me to do these things").

## The 30-question bank

The bank groups its questions under the owner's frame. Each verdict is the ceremony challenge's.

| Group | # | Question | Verdict |
|---|---|---|---|
| Where we are | 1 | Where are we, and how far to the next milestone? | keep (takes in 2, 3, 13, 14, 17) |
| | 2 | Which plan step, and what next? | into 1 |
| | 3 | How ready is each user path? | into 1 |
| | 4 | What is in flight? | cut |
| | 5 | What is blocked, on what? | into 12 |
| | 6 | What has been open longest? | cut |
| Where we have been | 7 | What changed since I last looked? | keep (takes in 8, 10) |
| | 8 | Are we converging? | into 7 |
| | 9 | Where did this row come from? | keep, as row detail |
| | 10 | What was decided and rejected? | into 7 and 9 |
| | 11 | Is the external review addressed? | into 22 |
| Where we ought to go | 12 | What can an agent land now, and what does it unblock? | keep (takes in 5) |
| | 13 | What end state are we steering toward? | into 1 |
| | 14 | How long is the chain to the next milestone? | into 1 |
| | 15 | What are we assuming? | into 22 |
| | 16 | Open question, or only execution? | cut |
| | 17 | Which path has nothing planned? | into 1 |
| When doors open | 18 | What is deferred, on which triggers? | keep (takes in 19, 20) |
| | 19 | Which triggers fired with nothing done? | into 18 |
| | 20 | What comes up next? | into 18 |
| | 21 | Which standing duties are due? | cut |
| | 22 | What must be checked before a run of a new kind? | keep (takes in 11, 15) |
| What needs me | 23 | What needs the owner's decision, and when? | keep (takes in 24, 25) |
| | 24 | If I don't decide, what happens? | into 23 |
| | 25 | Have I given every decision? | into 23 |
| | 26 | Which items in my queue are not mine? | into 30 |
| Can the record be trusted | 27 | Is anything only in chat? | move off the page |
| | 28 | Do the numbers add up? | keep, one header line with 29 |
| | 29 | How fresh is this page? | keep |
| | 30 | Where do the files contradict themselves? | keep (takes in 26) |

## The three challenges

**Ceremony** asked what each extra field costs. Fields that say the same thing already disagree: Trigger type contradicts Land now on all 3 rows where either says "now". Priority adds almost nothing: all 15 high rows share one main milestone. So it kept only views that need no new field, and cut four questions: 4 (git answers it), 6 (a waiting row is meant to sit still), 16 (nobody would act differently) and 21 (a last-done date per duty needs upkeep).

**Repo-only** asked whether files and git alone can answer each question. Its test: the same commit gives the same page on any machine at any time. Local branches, the wall clock and anything fetched from CI fail it. So an outside fact reaches the page only once an agent writes it into a row as a dated note.

**Completeness** looked for what the bank missed (see the gaps below). With repo-only, it corrected the bank twice. "Unblocks" is already computed, by reading Waits on in reverse. And a row's path cannot be read from its Milestone, since several paths share one. The notes disagree on the fix: match path names in the row's text, or use the launch checklist, whose lines name the rows they settle.

The owner later ruled, on 2026-11-03, that triggers are steps, not dates. So the bank's date-based ideas were dropped: a date first in each Trigger, passed dates flagged as fired, and lists sorted by date.

**What stays: nine views** (the ceremony note counts eight, plus row detail).

| View | What it shows |
|---|---|
| Path lanes (1) | Each path's next milestone, its "done when", the chain in steps |
| What changed (7) | Rows opened and closed, decisions recorded |
| Land now (12) | Ready rows, and what each unblocks |
| Deferred (18) | Waiting rows, fired ones first |
| Checks before a run (22) | Open checklist lines per group |
| The owner's queue (23) | Rows that need the owner |
| Header line (28, 29) | Commit, day, every count worked out |
| Warnings (30) | Only when something contradicts |
| Row detail (9) | Where a row came from |

One step moves off the page: filing what is only in chat. Chat is not in the files, so housekeeping runs it as an end-of-session prompt.

## What an agent needs and what a person needs

An agent needs a short text, a few hundred to about 2,000 tokens: after compaction, a file over 5,000 tokens comes back only as a path. It wants IDs rather than prose, open rows only, the next action first or last, and only the state the code cannot show, stamped with its commit.

A person needs the routes and how far each is, when deferred rows reopen, the decisions waiting on them, and where we have been. The first screen must answer the main questions. Both come from one generator reading the same files.

## The smallest set of fields

| Field | Upkeep |
|---|---|
| ID, Item, Details, Filed | written once |
| Milestone, Who, Land now, Trigger, Waits on | kept true |

Only five fields must be kept true. The ceremony note would cut Status, Priority, Size, Kind, Trigger type and Files. Once per path, a small table lists its milestones in order, each with a "done when" line. Repo-only and completeness disagree with the ceremony note on one point: both want a marker for standing duties, which the ceremony cuts would remove.

## Gaps found

| Gap | What the notes found | Question it adds |
|---|---|---|
| Standing duties | Marked as chores, though they never close; one would head the land-now list forever | Which rows recur, kept out of counts? |
| Parked tracks | A parked research track's hub row is mentioned 38 times | What is parked, on whose word, and what resumes it? |
| Waiting for ratification | 22 decision records (7 proposed, 15 taken up by the agent as it carried on) await the owner's ratification | What rests only on the agent's word? |
| Decided not to do | Only in prose | What did we decide not to do, and what would reopen it? |
| Before a merge | The bank had no merge moment | Does this branch need the check or only the gate? |
