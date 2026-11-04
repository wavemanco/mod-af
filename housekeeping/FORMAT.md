# Format

## Settings

`housekeeping.json` in the repository, JSON. Every key, its default, one line each. Unknown keys give a recommendation, never an error.

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
