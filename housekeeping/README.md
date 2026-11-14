# housekeeping

One place for a repository's pending work, and a Route Map made only from it. The work lives in two Markdown files, a backlog (work done in the repository) and a playbook (what happens outside it), each row with its trigger. Its map, short view and `check` read those files and nothing else, and it builds from them a one-page map (lanes per path, what is ready, what unblocks what), a short view for an agent, and a list of problems with the files.

It never decides anything for you: no commits, no pushes, no fetches. Every write goes through Claude Code's own tools, so your deny rules apply, except for its own generated page, `.housekeeping/route-map.html`, which it writes directly and never commits. A write the plugin makes itself (`init`'s files) asks nothing: one that no rule denies goes ahead. Under `plan` and `audit`, the agent commits on a new branch only the steps you approve, through its own tools, which ask as your settings say, and the audit's branch is never pushed.

## What Phase 1 delivers

- `map`: builds the Route Map page from the two files and prints a partition line (how many rows are closed, open, land now, small choice, not now). It can publish the page to an artifact when you are present.
- `check`: reads the files and the settings and reports errors, warnings and recommendations (duplicate IDs, broken columns, stale "where we are", ticked checklist lines, and so on).
- `init`: sets up a repository that has no records yet, without overwriting anything.
- The short view: at most 8,000 characters, shown by `/housekeeping` with no argument and put into the session's context.
- Publishing: the page goes to a claude.ai artifact kept private to you; the link is remembered per repository.

Phase 2 adds `survey` and `plan`, for a repository whose pending work is already spread over its own files. Phase 3 adds `owed`, `audit`, the records card for an agent filing into the two files, and the parts that run on their own (below).

## Commands

```
/housekeeping            the short view
/housekeeping map        build the page (and publish it if you say so)
/housekeeping map new    forget the stored Route Map link, then build and publish a new page
/housekeeping check      report problems in the files and the settings
/housekeeping init       set up a new repository
/housekeeping survey     find where the repository keeps its pending work now; writes nothing
/housekeeping plan       propose the steps that move it into the pair, applied only once you approve
/housekeeping owed [--base <ref>] [--head <ref>]
                         list what a branch owes the records: rows whose trigger fired, rows its commits name
/housekeeping audit      propose closing the open rows that commits on main have done, applied on a branch only
                         once you approve
```

`owed` reads the commits from the merge base with the main branch (or with `--base`) to HEAD (or `--head`), and lists the rows whose Trigger names a changed path or a code name on a changed line (the rule is in [`FORMAT.md`](./FORMAT.md)), the rows the commits name by ID with each commit's paths, the checklist lines that name those rows, the rows gone or settled over the range, the IDs the branch adds that are already taken, and the range's last commit. It never shows a line's text, an author or a trailer. The slash command puts every changed path to your Read rules: a path they deny is counted, never read or named, and a commit subject that names it, whole or by its file name, written `./` or in any case, shows it hidden; a name with no `.` or `/` reads as a word and shows. `node cli.ts owed` ignores the Read rules and reads every changed path, wherever it runs. Both exit 0 with a listing and 2 on a usage error, a stop or a git error; in a shallow clone owed stops, since the commits it reads may be missing.

`audit` hands the agent a procedure (`prompts/audit.md`) with `owed`'s listing over the audit's range: from the latest `Last done: YYYY-MM-DD, through <sha>` of the playbook duty row whose Trigger holds `/housekeeping audit`, else from the commit that added `.housekeeping.json`, else from the root, at most 50 first-parent commits of the main branch. The agent reads only the hunks of the listed commits' allowed paths, puts each case to a skeptic subagent, and proposes the clear-cut closings and ticks as numbered steps, with the judgement calls listed apart. It writes nothing before your own message approving the steps. Then it applies them on a branch `housekeeping/audit-YYYY-MM-DD`, in a worktree under the system temp folder, one commit per step, and never pushes it: the branch is yours. Where a rule says who writes the records, or either file has uncommitted edits, it proposes nothing and lists the cases. Where `mainBranch` or a records path holds anything but letters, combining marks, digits, spaces, `.`, `_`, `/`, `@`, `+` and `-`, or the install folder holds a curly quote, a control character or an invisible format character, `/housekeeping audit` stops before handing the procedure, since its commands would carry the name and PowerShell ends a quoted string at a curly quote too. A straight quote in the install folder is carried. As with `survey` and `plan`, the agent starts on your next message. Outside Claude Code, paste `prompts/audit.md` into any chat with `FORMAT.md` and run the commands it names in the repository.

`check` and `map` read the two files as committed on the main branch (`mainBranch` in the settings), so after `init`, commit its files on the branch it names.

`survey` and `plan` hand the agent a procedure (`prompts/survey.md`, `prompts/plan.md`) with the inventory of the repository's tracked files; `plan` adds `check`'s findings when a `.housekeeping.json` exists. The agent does the reading and proposes; you approve. The command's reply is a count, not the result: the agent starts on your next message, for example "go ahead". Under `claude -p` the run ends with that reply, so send the next message with `claude -p --continue "go ahead"` and the same flags. The inventory obeys your Read deny rules: a file they deny is counted, never read or named. Those are the rules in force in the session: in one started in a subfolder, the top's own rules are not, so a file outside that folder that the session would have to ask about is counted as not read, and the reply says to start the session at the top. The Node command below has no such rules and reads every tracked file wherever it runs, in a Claude Code session too, so when the survey counts denied files the agent asks you to run the re-run as `/housekeeping survey --tracker <path> --not-tracker <path>`.

The same computed parts run without Claude Code:

```
node housekeeping/cli.ts <map|check|brief> [--repo <dir>] [--settings <file>] [--out <file>]
node housekeeping/cli.ts survey [--repo <dir>] [--json] [--tracker <path>]... [--not-tracker <path>]...
node housekeeping/cli.ts owed [--base <ref>] [--head <ref>] [--repo <dir>] [--settings <file>]
```

`check` exits 1 when it finds an error. The page it writes is byte-identical to the plugin's.

In a blobless clone (`git clone --filter=blob:none`), `check`, `map` and the short view stop at the first old version of the two files that the clone does not hold, since housekeeping never fetches, and the stop names the cure: `git log -p -m --first-parent <main branch> -- <backlog> <playbook>` fetches every version the history reads, merges included, whatever branch is checked out; then run it again. When a name in the settings holds anything but letters, digits, `_`, `.`, `/` or `-`, the message gives the command with placeholders and never puts that name in it.

`check` reads the main branch, not the commit checked out, and says which branch it read when HEAD is on another. To check a pull request's own records, in CI for example, run it with a copy of the settings whose `mainBranch` is `HEAD`: `node housekeeping/cli.ts check --settings <copy>`.

## What runs on its own

These run with no command. In any repository, the after-commit hook, the turn end and the stale-map check each first find the settings file with `git rev-parse` and write their debug line; the rest of what the table says runs only where a `.housekeeping.json` exists. None of them writes a file, commits or publishes: publishing stays with `/housekeeping map`, which you run.

| Part | When it fires | What it costs | With `automatic` off |
|---|---|---|---|
| The short view and the records card | each time Claude Code builds the prompt's context: the first prompt, and again after a compaction or `/clear` | two context blocks: `housekeeping`, the short view, at most 8,000 characters, and `housekeeping-records`, the card's ten lines (the two files with the commit test, the columns, the ID patterns, the decisions folder, the not-doing table and the filing rules); a few `git rev-parse` calls while main, its remote copy and the settings are as they were, else a rebuild that the prompt never waits for | stays |
| The compaction paragraph | each compaction of the main conversation, on every trigger | one `git rev-parse`; one paragraph in the summarizer's instructions, asking it to keep, under "Not yet filed into the backlog or playbook", one line per item of the conversation not yet written into the two files, the owner's decisions word for word, at most 40 lines, then "and N more: run /loose-ends" | stays |
| After a git command | the Bash or PowerShell tool's result, for a command that holds the word `git` or whose result carries a git operation, such as a commit or a merge; not for one run in the background | two `git rev-parse` calls; where main's commit is not the stored view's, one `git diff --quiet` on the two files between the two; where they changed, the view is rebuilt without waiting, the status line follows, and the main conversation (not a subagent) gets one line on that tool's result: "The records on `<main>` changed at `<sha7>`; /housekeeping shows the new view." It comes once per change in a conversation, and can come once more after a resume. | nothing runs |
| The `/loose-ends` suggestion | the end of each answered turn of the main conversation, after the turn has ended | two `git rev-parse` calls, then, unless it was already suggested at this HEAD, `git status --porcelain` on the two files, one `git log -1` and one `git rev-list --count`; `/loose-ends` shown dim in the empty prompt box, never in the context, once per HEAD (the latest 32 HEADs it was shown at are kept, each with its worktree; one the box did not show is tried again), when three or more commits follow the last one that touched the records and neither file has uncommitted edits | nothing runs |
| The stale-map line | session start, without holding up the first prompt | two `git rev-parse` calls, and one `git diff --quiet` where a Route Map link is stored; one dim line in the transcript, not sent to the model, when the records on main changed since the stored page's commit: "The Route Map is older than the records on `<main>`: /housekeeping map publishes it." | nothing runs |
| Debug lines | each firing of the last four | one line in the debug log alone (`claude --debug`): the part, its outcome, a 7-character sha and counts where it has them, and its milliseconds; a part that fails says `failed:` and its error's name; never a row's text or a path | none |

`automatic` is the plugin's one setting, `on` by default; set it to `off` under housekeeping's "Automatic parts" in `/config` (`false`, `no` and `0` read as off too, in any case and with spaces around them). The value is text, and any other text reads as on. A change reloads the plugin, which then no longer knows which procedures the conversation was handed, so a later compaction is not told to keep them.

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

Installing `housekeeping` from this marketplace should also install `loose-ends`, `route` and `decide`, because it lists them as dependencies, and Claude Code installed a dependency with its dependent when Phase 0 tried it with a throwaway plugin; housekeeping itself with its three is checked at the owner's sitting (`research/live-checks.md`, check 17). If you install by another route, install them too:

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
- It never commits on its own, pushes or fetches, and installs no CI workflow. Under `plan` and `audit` the agent commits only the steps you approved, and pushes nothing.
- It never shows commit authors, and it refuses to build a page that holds a personal email address or a key of a shape it knows, saying where. The shapes are `sk-` keys, live payment keys, AWS access keys, GitHub, GitLab, npm, Slack and Google API tokens, webhook signing secrets, JWTs and private key blocks, PGP's included, under either label. A password, a key of another shape, or an address with no ASCII letter, digit or sign before its @ (one wholly in CJK, say) passes, so keep them out of the records. A hit in a commit subject, which cannot be edited, is masked in the page instead.
- It changes no other plugin here.

## Not built: filing after every commit

An automatic filing run after every commit was not built. The owner's reason: it would spend tokens on every commit and land filing edits between the person's own commits. Filing stays a step you run, or an agent runs at your word. See `DESIGN.md` sections 3.10 and 9.

## More

[`DESIGN.md`](./DESIGN.md) is the record of the design and its decisions; [`CALLS.md`](./CALLS.md) holds the calls Claude made in Phase 3, each with the earlier choice it replaced and when to revisit it; [`research/`](./research/README.md) holds the distilled research and the Phase 1 and Phase 2 results. [`INTEGRATION.md`](./INTEGRATION.md) says how `loose-ends`, `route` and `decide` work beside housekeeping, and [`research/live-checks.md`](./research/live-checks.md) lists the checks only a live session can make.
