# housekeeping

One place for a repository's pending work, and a Route Map made only from it. The work lives in two Markdown files, a backlog (work done in the repository) and a playbook (what happens outside it), each row with its trigger. `housekeeping` reads those files and nothing else, and builds from them a one-page map (lanes per path, what is ready, what unblocks what), a short view for an agent, and a list of problems with the files.

It never decides anything for you: no commits, no pushes, no fetches. Every write goes through Claude Code's own Write tool, so your permissions apply, except for its own generated page, `.housekeeping/route-map.html`, which it writes directly and never commits.

## What Phase 1 delivers

- `map`: builds the Route Map page from the two files and prints a partition line (how many rows are closed, open, land now, small choice, not now). It can publish the page to an artifact when you are present.
- `check`: reads the files and the settings and reports errors, warnings and recommendations (duplicate IDs, broken columns, stale "where we are", ticked checklist lines, and so on).
- `init`: sets up a repository that has no records yet, without overwriting anything.
- The short view: at most 8,000 characters, shown by `/housekeeping` with no argument and put into the session's context.
- Publishing: the page goes to a claude.ai artifact kept private to you; the link is remembered per repository.

Phase 2 adds `survey` and `plan`, for a repository whose pending work is already spread over its own files. Later phases add `audit`, `owed` and the automatic parts. They are not here yet.

## Commands

```
/housekeeping            the short view
/housekeeping map        build the page (and publish it if you say so)
/housekeeping map new    forget the stored Route Map link, then build and publish a new page
/housekeeping check      report problems in the files and the settings
/housekeeping init       set up a new repository
/housekeeping survey     find where the repository keeps its pending work now; writes nothing
/housekeeping plan       propose the steps that move it into the pair, applied only once you approve
```

`check` and `map` read the two files as committed on the main branch (`mainBranch` in the settings), so after `init`, commit its files on the branch it names.

`survey` and `plan` hand the agent a procedure (`prompts/survey.md`, `prompts/plan.md`) with the inventory of the repository's tracked files; `plan` adds `check`'s findings when a `.housekeeping.json` exists. The agent does the reading and proposes; you approve. The command's reply is only a count: the agent starts on your next message, for example "go ahead". Under `claude -p` the run ends with that reply, so send the next message with `claude -p --continue "go ahead"` and the same flags.

The same computed parts run without Claude Code:

```
node housekeeping/cli.ts <map|check|brief> [--repo <dir>] [--settings <file>] [--out <file>]
node housekeeping/cli.ts survey [--repo <dir>] [--json]
```

`check` exits 1 when it finds an error. The page it writes is byte-identical to the plugin's.

`check` reads the main branch, not the commit checked out, and says which branch it read when HEAD is on another. To check a pull request's own records, in CI for example, run it with a copy of the settings whose `mainBranch` is `HEAD`: `node housekeeping/cli.ts check --settings <copy>`.

## Using it with `claude -p`

A non-interactive run loads the plugin and its three dependencies by folder, and should leave the Artifact tool out, so that nothing is published with nobody there:

```
claude -p "/housekeeping check" --plugin-dir <dir>/housekeeping --plugin-dir <dir>/loose-ends --plugin-dir <dir>/route --plugin-dir <dir>/decide --disallowedTools=Artifact
```

In Git Bash on Windows, set `MSYS_NO_PATHCONV=1` for the run, or the shell turns `/housekeeping ...` into a Windows path.

## Settings

`.housekeeping.json` at the repository root says which files hold the rows, what the columns are called, the ID patterns, the paths and milestones, and where "where we are" lives. What the plugin learns about a repository goes there, never into the plugin's code. Every key, its default and the row format are in [`FORMAT.md`](./FORMAT.md). `init` writes a starting file.

## Install

```
/plugin install housekeeping --marketplace wavemanco/mod-af
```

Installing `housekeeping` from this marketplace also installs `loose-ends`, `route` and `decide`, because it lists them as dependencies and Claude Code installs a dependency with its dependent (checked in Phase 0). If you install by another route, install them too:

```
/plugin install loose-ends --marketplace wavemanco/mod-af
/plugin install route --marketplace wavemanco/mod-af
/plugin install decide --marketplace wavemanco/mod-af
```

The three keep working alone in any repository.

## What it never does

- The page and the short view hold nothing of their own. They never read the chat, CI, pull requests, issues or dashboards.
- No dates in triggers, no durations, no estimates.
- No database, no sync layer, no server.
- It never commits, pushes or fetches, and installs no CI workflow.
- It never shows commit authors, and it refuses to build a page that holds a personal email address or a key of a shape it knows, saying where. The shapes are `sk-` keys, live payment keys, AWS access keys, GitHub, GitLab, npm, Slack and Google API tokens, webhook signing secrets, JWTs and private key blocks. A password or a key of another shape passes, so keep them out of the records. A hit in a commit subject, which cannot be edited, is masked in the page instead.
- It changes no other plugin here.

## Not built: filing after every commit

An automatic filing run after every commit was not built. The owner's reason: it would spend tokens on every commit and land filing edits between the person's own commits. Filing stays a step you run, or an agent runs at your word. See `DESIGN.md` sections 3.10 and 9.

## More

[`DESIGN.md`](./DESIGN.md) is the record of the design and its decisions; [`research/`](./research/README.md) holds the distilled research and the Phase 1 results.
