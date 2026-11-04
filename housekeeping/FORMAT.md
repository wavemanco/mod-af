# Format

## Settings

`.housekeeping.json` in the repository, JSON. Every key, its default, one line each. Unknown keys give a recommendation, never an error.

- `version`: required, must be `1`.
- `project`: required, the project's name.
- `mainBranch`: default `"main"`.
- `files.backlog`, `files.playbook`: required, each `{ "path": "...", "skipSections": [] }`; `skipSections` (default `[]`) lists `##` heading prefixes that are not pending work.
- `columns`: required, the header text of each table column: `id`, `item`, `milestone`, `who`, `landNow`, `trigger`, `waitsOn` (all required); `details`, `filed`, `priority`, `triggerType` (optional).
- `values.who`: `agent`, `owner`, `both`, each a list of cell texts; defaults `["agent"]`, `["owner"]`, `["both"]`.
- `values.nothing`: cell texts that mean empty; default `["—", "-", ""]`.
- `values.priority`, `values.triggerType`: optional lists of allowed texts.
- `ids`: required, non-empty list of regex sources; a cell is an ID when one matches it whole.
- `none`: the text for "nothing"; default `"none"`.
- `done`: list of done-table readers `{ file, sectionPrefix, idColumn, landedColumn, milestoneColumn?, fileByIdPrefix? }`; default `[]`.
- `paths`: required (may be `[]`), list of `{ name, shared?, milestones: [{ name, doneWhen? }] }`.
- `whereWeAre`: optional `{ file, heading, marker? }`.
- `checklists`: list of `{ file, heading, milestone? }`; default `[]`.
- `notDoing`: optional `{ file, heading }`.
- `decisions`: optional, the decisions folder.
- `duties.triggerPrefix`: default `"Every"`; a trigger starting with it is a standing duty.
- `defaultUntilDecided`: default `"Default until decided:"`.

## Rows and sections

A row is a line of a Markdown table. The columns are found by their header text (the settings' `columns`).

| Role | Kept how | Values |
|---|---|---|
| ID | written once | the repository's own ID scheme; unique across both files |
| Item | written once | the title |
| Milestone | kept true | one or more milestone names, main one first, or `none` |
| Who | kept true | `agent`, `owner` or `both` (other words mapped by `values.who`) |
| Land now | kept true | `yes`, `small choice: <the owner's one choice>`, or `no: <what it needs>` |
| Trigger | kept true | plain words, at most 30 words: the step that brings the row back |
| Waits on | kept true | the IDs of the rows it waits on, or `—` |
| Details | written once, added to | what, why, the owner's words |
| Filed | written once | the day it was first filed (`YYYY-MM-DD`, or `before YYYY-MM-DD` when only a later bound is known) |

Any other column is read and kept as extra.

How the files are read:

- **Fences.** A line starting with three backticks or three tildes opens or closes a fenced block. Nothing inside one is read.
- **Sections.** `## x` sets the section and clears the subsection; `### x` sets the subsection. Any heading ends a table.
- **Tables.** A line with `|` opens a table when the next line is a separator (`|---|---|`). Rows follow until a line that does not start with `|`. A table without the ID and Item columns is not a row table. Tables in `skipSections` and in Done sections are not rows.
- **Cells.** Split on `|` except `\|`, which is a `|` inside the cell. Cells are trimmed and kept word for word; backticks mean nothing. A short row is padded with empty cells and is a warning (`columns`), as is a longer one.
- **Nothing.** A cell equal to one of `values.nothing` means empty. Milestone and Waits on hold comma-separated values; empties and those equal to `values.nothing` are dropped. Milestone keeps `none` as a value; Waits on drops it.
- **Land now.** Exactly `yes`, `small choice: <text>` or `no: <text>`. Anything else reads as `no` with the cell as the reason and is not valid.
- **Who.** Mapped through `values.who`; any other text is `unknown`.
- **Duplicate IDs.** Each is an error (`id-unique`); lookups use the first row.
- **Done entries.** Rows of tables under a `##` section whose title starts with a `done` `sectionPrefix`. The IDs are those found (by the `ids` patterns, standing alone, not inside a longer word or hyphenated name) in the ID column cell. The entry belongs to `done.file`, unless the last ID starts with a `fileByIdPrefix` value, which names the other file.
- **Checklists.** `- [ ]` and `- [x]` lines under a configured `##` heading; the group is the `###` heading above. An indented line that is not a list item continues the line above. IDs are found over the line and its continuation lines.
- **Where we are.** The first paragraph under the configured heading, or, with a `marker`, the paragraph that starts with it. Its date is the first `YYYY-MM-DD` in its first 80 characters.
- **Missing file.** A file that cannot be read is an error (`file`); the other is still read.
- **Not doing.** With `notDoing` set, the rows of the table under that `##` heading read as item, why and reopen condition (cells 0, 1 and 2). A missing section gives an empty list, not a finding.

## New repositories

`/housekeeping init` sets up a repository that has no records yet. It writes four things and never overwrites:

- `docs/backlog.md`: the backlog definition, a short `## How this file is kept`, then `## Where we are`, `## Open` (an empty table with the columns ID, Item, Priority, Milestone, Who, Land now, Trigger type, Trigger, Waits on, Details and Filed) and `## Done` (ID, Item, Milestone, Landed).
- `docs/playbook.md`: the playbook definition, then the same `## Open` and `## Done`.
- `.housekeeping.json`: one path named after the folder, with no milestones, and Done readers for both files with `milestoneColumn: 2`.
- `.gitignore`: the line `.housekeeping/`, appended only when it is missing.

A file that already exists is listed as "left as it is". If the repository has an `AGENTS.md` without the agent-guide line, init appends `At session start, run node <path to housekeeping>/cli.ts brief, or read the Route Map.` It creates no guide file; with none, it says so. The reply lists every file it wrote.
