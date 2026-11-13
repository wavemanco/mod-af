# housekeeping beside loose-ends, route and decide

housekeeping lists `loose-ends`, `route` and `decide` as dependencies in its `plugin.json` and changes none of them:
each keeps working alone, in any repository. These notes say, for each of the three, which file it reads, what
housekeeping's records card tells it, and where housekeeping defers to the project's own records.

## What the three are given

In a repository with a `.housekeeping.json`, each prompt's context gets two blocks from housekeeping, in this order:
`housekeeping`, the short view, and `housekeeping-records`, the records card. The card is built from the settings
alone (`hooks/core/card.ts`), is masked as the short view is, is served while the view is still being built, and is
dropped alone if it fails to build; with no settings file there is neither block. `node cli.ts brief` prints the card
after the short view, for an agent outside Claude Code. The card's lines, with the settings' values in place of the
angle brackets:

- The commit test: a row a commit closes goes in the backlog, `<backlog path>`; a row an act in the world closes goes
  in the playbook, `<playbook path>`.
- Columns (role "header"): each role the settings name, with its header text.
- ID patterns: `<the ids patterns>`.
- Decisions folder: `<decisions>`, or "none set".
- Before filing, find the highest ID of each pattern in both files, Done tables included, and take the next.
- A trigger is a step that has happened, never a date; a Trigger starting with `'<duties.triggerPrefix>'` is a
  standing duty, for work that recurs only.
- An item dropped goes to the not-doing table: `"<heading>" in <its file>`, or "none set".
- A decision updates the row it settles.
- Never read either records file whole: find rows with Grep, then Read only those lines (offset and limit) before an
  Edit.
- After committing, ask the person to run /housekeeping check once the change reaches main.

That context is the only channel: housekeeping puts no hook on the three plugins' commands (Phase 3 call 9; DESIGN
section 10). Whether each follows the card is checked live, at the owner's sitting
([`research/live-checks.md`](research/live-checks.md)); a row waits on that sitting showing the card falls short.

## loose-ends

- **What it reads.** The conversation: its procedure sorts what exists only there into implement now, file it and
  drop, and gives each item to file a home in "whatever this project already uses" and a concrete trigger.
- **What the card tells it.** The home: the backlog or the playbook, chosen by the commit test, at the paths the
  settings give; the columns and the ID patterns, with how to take the next ID; that a trigger is a step, never a
  date; where a dropped item goes; and to find rows with Grep and read only those lines before an Edit.
- **Where housekeeping defers.** The files are the ones the settings name, under the repository's own names. The
  filing is loose-ends' own: housekeeping files nothing itself. Each compaction of the main conversation is asked to
  keep what is not yet filed, at most 40 lines, then "and N more: run /loose-ends"; and, where housekeeping's
  `automatic` setting is on, at the main loop's turn end it suggests `/loose-ends` in the prompt box, once per HEAD,
  when three or more commits follow the last one that touched the records and neither file has uncommitted edits.
  With no not-doing table set, the card says "none set", and where a dropped item goes is loose-ends' own call.

## route

- **What it reads.** Its procedure grounds itself in "whatever actually holds the state here". With housekeeping, that
  is the short view in the context (where we are, each path's next milestone, its stops and its gate, the rows that can
  land now, the owner's queue, the doors just opened) and the two files the card names.
- **What the card tells it.** Which file holds which kind of row, the columns, and that a Trigger is a step that has
  happened, so a row waiting on a step can be followed to it; and to read only the rows it needs.
- **Where housekeeping defers.** The two files are the record: the short view is computed from them, holds nothing of
  its own, and says which commit of the main branch it was built from. What route makes of them, the real gate and the
  critical path, is route's own answer.

## decide

- **What it reads.** The decision under discussion; its procedure then offers a record and puts it "where I keep such
  things", asking where when it has not been told.
- **What the card tells it.** The decisions folder, from the settings' `decisions`, and that a decision updates the row
  it settles.
- **Where housekeeping defers.** The folder is the repository's own, as its settings name it; `init` writes
  `docs/decisions` but does not create the folder. With none set, the card says "none set", and where the record goes
  is decide's own question to the person.
