# The owner's plugin collection: what each existing plugin covers for housekeeping

This file says what the five plugins in the owner's plugin collection do and what housekeeping takes from them. The
research ran from 2026-11-02 to 2026-11-03. It draws on the design session's raw notes, which are kept
locally and not published because they name the repositories, and on a reading of the plugins' code on GitHub on
2026-11-03. The raw notes hold each plugin's purpose, the commands answered without `next`, detell's 14-day check,
dynamics's size and rules, and the state of the local copy; the procedures' finer wording, the two details under "The
house pattern" and the quote from dynamics's hook file come from that reading of the code alone.

## The house pattern

Every plugin comes in two forms.

- **A slash command.** When a session starts, the hook registers the command and passes the start event on. When the
  person runs the command, the hook answers with one short line for the person and a written procedure, as hidden
  context, for the agent to follow.
- **A `prompt.md`.** The same procedure as a prompt to paste into any chat.

Two details matter. In loose-ends, route and decide the procedure is typed twice, in the hook and in `prompt.md`,
under a comment asking that the two be kept in sync; dynamics has its hook read the method out of `prompt.md` between
marker comments, so there is one copy. And where the paste form cannot do what the plugin does, its `prompt.md` says
so at the top: detell's says a pasted prompt cannot remember when the source was last checked, and dynamics's lists the
checks to run by hand.

What we gained: housekeeping ships both forms, keeps one copy of its procedure for the hook to read, and its paste form
names each duty it cannot keep by itself.

## loose-ends and route answer their command without passing it on

When `/loose-ends` or `/route` runs, the hook returns its answer and does not call `next`, the step that hands the
command on to the next handler. decide and detell do the same (their start-of-session handlers do call `next`). So a
command stops at the plugin that answers it, and a second plugin listening for it is not reached.

What we gained: housekeeping cannot add to `/loose-ends` or `/route` by hooking their commands. It adds a command of its
own, or the change goes into the plugin's own procedure. Either edit waits for the owner's local work (last section).

**Superseded by Phase 0** ([`phase-0-mechanics.md`](phase-0-mechanics.md), check 1): a plugin that lists another under
`dependencies` has its hook on that plugin's command run outermost, so housekeeping could add a note to their commands'
results with no edit to them. Phase 3 does not build it (call 9 of `../plans/2026-11-13-phase-3.md`): the records card in
the agent's context is the only channel (`../INTEGRATION.md`).

## Plugin by plugin

| Plugin | What it does | Housekeeping need it covers |
|---|---|---|
| loose-ends | Sorts what lives only in the conversation into do now, file, or drop | Getting deferred items into a record with a trigger |
| route | Says what is left before a milestone, the real gate and the critical path | "What is left, and when" |
| decide | Writes a decision brief, then a short decision record | Recording a choice with the options turned down |
| detell | Strips AI-writing tells from a file; re-checks its source every 14 days | A duty that falls due on a date |
| dynamics | Builds, checks and draws a system-dynamics model | Safe file writes, agreed review rounds, row rules |

### loose-ends

**What it does.** It scans the conversation for decisions, ideas, promised follow-ups, risks noticed in passing and
things put off "for later". IMPLEMENT NOW is small and in scope. FILE IT gets one line, a home (whatever the project
uses: an issue, a backlog, a decisions log, a doc) and a concrete trigger, never a vague "later"; an
item with no real trigger says so and goes to a backlog reviewed on a cadence. DROP gets one line so it is not argued
again. It runs only when someone asks.

**With the pair.** The home stops being "whatever the project uses": work done in the repository goes to the backlog,
what happens outside it to the playbook, and the line between the two files decides. The trigger it already asks for
is the field the pair's rows need.

**What it teaches.** A trigger is an event, and a missing one is said, not invented. Running only on demand means
nothing is caught unless someone asks, and the raw notes show why that is hard to change: when a session ends, all hooks share one
limit of 1.5 seconds, too short for model work.

### route

**What it does.** It names the milestone and lists what is left: hard blocker or nice-to-have (strictly), decision or
work, the owner, and the work a decision leaves behind. It names the real
gate plainly and, when more than one blocker remains, the critical path and its long pole. It reads the repository's
real state each time, and says what it would need to check when it cannot tell.

**With the pair.** Grounding has two known files to read instead of a search through code, trackers and notes. The
open rows of both files are its list, and the playbook's milestones are what it routes to.

**What it teaches.** Answer from the files each time, not from memory. A decision is not finished when it is made.

### decide

**What it does.** It states the decision and whether it can be undone, then two to five real options, each first in
terms of what the user and the product get, with pros, cons, reversibility, cost if wrong and effort. It commits to a
recommendation and says what would change it. Then it offers a decision record: the date, the option chosen, a
one-line why, the alternatives and why not, and whether it can be undone.

**With the pair.** The record still goes where the project keeps decisions. The work a decision leaves behind becomes a
row in the backlog or the playbook, by the same line as for loose-ends.

**What it teaches.** Its record fields, the turned-down options among them, are the ones housekeeping's decision notes
need, written for a reader who is not an engineer.

### detell

**What it does.** It loops over a file: find AI-writing tells, rewrite only those spans, look again, and stop after two
clean passes in a row. Its checklist comes from Wikipedia's page of signs of AI writing. The plugin keeps the checklist
and the time it was last checked in its own store, which lasts across sessions. When the checklist is 14 days old or
more, or was never checked, `/detell` tells the agent to fetch the source, distil it again and pass the result to
`/detell-refresh <file>`, which stores it and stamps the day. If the fetch fails, the agent uses the old list and says
the refresh is still pending.

**With the pair.** detell does not change. Its pattern carries over to the playbook's standing duties: a
last-done date the plugin compares when it runs, and a plain message to the agent when the duty is due.

**What it teaches.** The hook only compares a date and says what is due; the agent does the work; a separate command
records that it was done. A failed step is said, not hidden.

### dynamics

**What it does.** It models what accumulates and what feeds back in a system, from code or documents, checks that
every quote is in its file, finds every feedback loop and draws a page. It is version 0.2.0, about 5,000 lines. Its
`check` and `render` tools read and write only through Claude Code's own Read and Write tools, so permissions apply.
The person sets the review rounds at the start (two by default), and it never runs more without their yes. Its own
backlog gives each row an ID, a specification, a trigger and a status; numbers are never reused and rows never deleted.
A finished row is marked done with its date and the test that fails without it, a dropped one declined with its date
and reason.

**Where the notes and the code disagree.** The raw notes list dynamics with the other four as a command its hook
answers. Its own hook file says `/dynamics` is a skill, because "a skill starts a model turn; a hook-answered command
does not", and swaps the method in as the skill's text. Housekeeping should settle which it needs before choosing.

**With the pair.** Its backlog already has the backlog half's shape, with nothing built before its trigger fires. It has
nothing like the playbook half.

**What it teaches.** Write through the host's own tools so permissions apply. Never delete a row; close it with a date
and its evidence. Agree the review rounds up front.

## The owner's local copy has newer work in flight

The owner's local checkout of the collection was left untouched. Its main branch is 12 commits ahead of GitHub and 3
behind, with 26 uncommitted changes. It holds work not on GitHub: a new plugin, a root backlog grouped by plugin,
smoke-test records as JSON files, a script that generates Codex skills from each plugin's workflow file, and decide,
route and loose-ends being reworked into a workflow file plus Codex adapters. It does not have dynamics.

So this file describes the GitHub versions of decide, route and loose-ends, which the local work is replacing. Any
edit housekeeping needs in those plugins waits until that work reaches GitHub, and is then made against it.
