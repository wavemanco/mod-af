# Format

## Settings

`.housekeeping.json` in the repository, JSON. Every key, its default, one line each. Unknown keys give a recommendation, never an error.

- `version`: required, must be `1`.
- `project`: required, the project's name.
- `mainBranch`: default `"main"`; `init` writes the branch it runs on. It may not be empty or start with `-`. `check` and `map` read the two files as committed on this branch, so commit them there.
- `files.backlog`, `files.playbook`: required, each `{ "path": "...", "skipSections": [] }`; `skipSections` (default `[]`) lists `##` heading prefixes whose sections hold no rows: those that are not pending work, and prose items that a table indexes. A list line in any other section, apart from the Done, checklist, where-we-are and not-doing sections, is a `not-in-table` warning.
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
- `duties.triggerPrefix`: default `"Every"`; a trigger starting with it is a standing duty. With a `Last done: YYYY-MM-DD` in its Details (the latest one counts), the short view computes when it is due for `Every session` and for `Every [n] day`, `week`, `month`, `quarter` or `year` (plurals too, `n` in digits). Any other period is a `duty-period` warning, and a day not on the calendar a `last-done` warning. The audit's own duty row, the playbook row whose Trigger holds `/housekeeping audit`, writes `Last done: YYYY-MM-DD, through <sha>`: the day, read as above, and the last commit the audit read, where the next audit starts when that commit is on the main branch's first-parent line (else at the commit that added `.housekeeping.json`, else at the root; at most 50 first-parent commits a time).
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

- **Fences.** A line starting with three backticks or three tildes opens or closes a fenced block; an opener may follow a list marker. Nothing inside one is read. A fence the file ends inside, one that holds a `##` heading, one that holds a table with the ID and Item columns, or one that opens right after a row of such a table and goes on with rows, in a section read for rows, is a `fence` warning at its opener, once. A stray opener that another fence closes with none of these gives no warning, and the lines between them are not read. A fenced example row belongs in a section `skipSections` sets aside; init's settings set aside the backlog's "How this file is kept".
- **Sections.** `## x` sets the section and clears the subsection; `### x` sets the subsection. Any heading ends a table.
- **Tables.** A line with `|` opens a table when the next line is a separator with as many cells, each one or more dashes with an optional colon at either end (`|---|---|`, `|-|-|`, `| :-- | --: |`), as GitHub reads them. Rows follow until a line that does not start with `|`. A line holding `|` that ends a table, a line starting with `|` in no table, and a separator with another cell count than its header are each a `row-dropped` warning, once per break and in Done sections too. A table without the ID and Item columns is not a row table. Tables in `skipSections` and in Done sections are not rows, and a row table in a section that only `skipSections` sets aside is one `row-skipped` warning, since its rows are not read. `skipSections`, Done and not-doing match the start of a `##` heading; a checklist's and where-we-are's heading match it whole.
- **Cells.** Split on `|` except `\|`, which is a `|` inside the cell. Cells are trimmed and kept word for word; backticks mean nothing, except in a Trigger, where `owed` reads a backticked span as a code name (below). A short row is padded with empty cells and is a warning (`columns`), as is a longer one.
- **Nothing.** A cell equal to one of `values.nothing` means empty. Milestone and Waits on hold comma-separated values; empties and those equal to `values.nothing` are dropped. Milestone keeps `none` as a value; Waits on drops it.
- **Land now.** Exactly `yes`, `small choice: <text>` or `no: <text>`. Anything else reads as `no` with the cell as the reason and is not valid.
- **Who.** Mapped through `values.who`; any other text is `unknown`.
- **Duplicate IDs.** Each is an error (`id-unique`); lookups use the first row.
- **Done entries.** Rows of tables under a `##` section whose title starts with a `done` `sectionPrefix`. The IDs are those found (by the `ids` patterns, standing alone, not inside a longer word or hyphenated name) in the ID column cell. The entry belongs to `done.file`, unless the last ID starts with a `fileByIdPrefix` value, which names the other file.
- **Checklists.** `- [ ]` and `- [x]` lines under a configured `##` heading, matched whole; the group is the `###` heading above. A configured heading that matches no `##` heading is a `checklist-heading` warning, naming any heading that starts with it. An indented line that is not a list item continues the line above. IDs are found over the line and its continuation lines.
- **Where we are.** The first paragraph under the configured heading, or, with a `marker`, the paragraph that starts with it. Its date is the first `YYYY-MM-DD` in its first 80 characters.
- **Missing file.** A file that cannot be read is an error (`file`); the other is still read.
- **Not doing.** With `notDoing` set, the rows of the table under that `##` heading read as item, why and reopen condition (cells 0, 1 and 2). A missing section gives an empty list, not a finding.

## Code names in a Trigger

`owed` lists the rows whose Trigger fired over a range of commits. A token in a Trigger is a backticked span, or a word that holds `/` or ends in `.` and letters, once the brackets, quotes and punctuation around the word are dropped (a leading `./` too). A slash command (`/loose-ends`, `` `/housekeeping audit` ``) is no token, and a duty row's Trigger is not read. A row fires when one of its tokens:

- matches a changed path as a suffix on a `/` boundary: `prices.ts` matches `prices.ts` and `src/prices.ts`, not `src/myprices.ts`; or
- is a whole word (no letter, digit or `_` on either side) on an added or removed line of a changed file other than the two records and `.housekeeping.json`: `PRICES_CHECKED` matches `const PRICES_CHECKED = 2`, not `PRICES_CHECKED_AT`.

| Trigger | Tokens |
|---|---|
| When `PRICES_CHECKED` changes. | `PRICES_CHECKED` |
| When src/prices.ts changes. | `src/prices.ts` |
| Once prices.ts, or (README.md), changes. | `prices.ts`, `README.md` |
| When it lands in scripts/route-map.ts. | `scripts/route-map.ts` |
| After /loose-ends files it, or `/housekeeping audit` runs. | none |
| When the v1.2 tag lands. | none |

A word such as `e.g.` reads as a token too (`e.g`); a name in backticks is read whatever it holds.

`/housekeeping owed` puts every changed path, both sides of a rename, to your Read rules: a path they deny is never read or named, so it matches nothing, and it is counted. `node cli.ts owed` ignores the Read rules and reads every changed path.

## New repositories

`/housekeeping init` sets up a repository that has no records yet. It writes four things and never overwrites:

- `docs/backlog.md`: the backlog definition, a short `## How this file is kept`, then `## Where we are`, `## Open` (an empty table with the columns ID, Item, Priority, Milestone, Who, Land now, Trigger type, Trigger, Waits on, Details and Filed) and `## Done` (ID, Item, Milestone, Landed).
- `docs/playbook.md`: the playbook definition, then the same `## Open` and `## Done`, then `## Not doing` (an empty table with the columns Item, Why not and What would reopen it), where dropped items go so they are not filed again.
- `.housekeeping.json`: one path named after the folder, with no milestones; Done readers for both files with `milestoneColumn: 2`; the backlog's `## How this file is kept` set aside in `skipSections`; `notDoing` naming the playbook's `Not doing`; and `decisions: "docs/decisions"`, a folder init does not create.
- `.gitignore`: the line `.housekeeping/`, appended only when it is missing.

A file that already exists is listed as "left as it is". If the repository has an `AGENTS.md` without the agent-guide line, init appends `At session start, run node <path to housekeeping>/cli.ts brief, or read the Route Map.` It creates no guide file; with none, it says so. The reply lists every file it wrote.

## Moving an existing repository

A repository that already keeps pending work in its own files moves into the pair in two procedures, `prompts/survey.md` and `prompts/plan.md`. `/housekeeping survey` and `/housekeeping plan` hand them to the agent with the inventory; outside Claude Code, `node cli.ts survey [--repo <dir>] [--json] [--tracker <path>]... [--not-tracker <path>]...` prints the same inventory, except that it also reads the files your Read rules deny, which the slash command counts and never names.

- **The survey writes nothing.** It sorts the files into canonical, neighbour and history, counts their items, and lists the outside work, the files and machine readers that name them, and the repository's own rules that constrain a move. It reads the guide files before it says that no file holds pending work. It puts the inventory's suspects to the person (study it, it is a tracker, or it is not) and runs again with `--tracker` and `--not-tracker`; the answers go into the plan, not into a file.
- **The plan is a proposal,** in numbered steps. The backlog keeps its name and every ID. The playbook is a new file with its definition if there is none, under a name the repository does not already use. A row that moves keeps its ID and says where it was filed before. What the repository's rules keep apart is linked, not moved, and history stays as it is. A step that conflicts with one of the repository's rules is marked the owner's decision. The `.gitignore` gains `.housekeeping/`, appended when it is missing, as `init` does.
- **Applied only once the owner approves:** on a new branch, one commit per step, split the way the repository's own guards require, with its own tests run before and after, then `check` and `map`.

## Auditing the records

`/housekeeping audit` hands the agent `prompts/audit.md` with `owed`'s listing over the audit's range: from the duty row's latest `Last done: YYYY-MM-DD, through <sha>` (under `duties.triggerPrefix` above), else from the commit that added `.housekeeping.json`, else from the root, at most 50 first-parent commits of the main branch. The audit proposes the clear-cut closings as numbered steps and writes nothing before the owner approves them; then it applies them on a branch `housekeeping/audit-YYYY-MM-DD`, in a worktree under the system temp folder, and never pushes it. With no duty row, its last step adds one to the playbook, in the playbook's own column order: `| <next ID> | Audit the records against the commits | none | agent | no: a standing duty | Every 2 weeks: /housekeeping audit | — | Last done: YYYY-MM-DD, through <sha> | YYYY-MM-DD |`. Outside Claude Code, follow `prompts/audit.md` with `node cli.ts owed --base <start> --head <main>`; as a base, git's empty tree `4b825dc642cb6eb9a060e54bf8d69288fbee4904` reads from the root, with no merge base.
