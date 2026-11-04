# What a Claude Code plugin can and cannot do for housekeeping

This file says which parts of the housekeeping design the Claude Code plugin API can carry. The research ran from 2026-11-02 to 2026-11-03. It is distilled from the design session's raw notes, which are kept locally and not published because they name the repositories.

Every verdict comes from reading the plugin API of build 2.1.309 (its reference and type declarations) and the owner's plugin collection. Nothing was tried in a live session, and `claude plugin validate` and `claude plugin test` were not run. "Verified" means the API documents it, "contradicted" that it says otherwise, "unknown" that it is silent.

## Verdicts

| Claim | Verdict | Rests on |
|---|---|---|
| A slash command | Verified | `$.command.register`, `command.run` |
| Queuing model work | Verified | `$.prompt.submit`, `$.prompt.suggest` |
| Seeing a commit's sha | Verified | `gitOperation.commit` |
| Seeing a commit's files, or commits made outside Claude Code | Contradicted | no field, no event |
| Timers that outlive the session | Contradicted | `$.clock.every`, `$.clock.after` |
| Running git and reading files | Verified, with limits | `$.process.run`, `$.fs` |
| Panes | Verified, no HTML | `$.ui.open`, `ui.render` |
| Status line and context | Verified, with a catch | `$.ui.status`, `prompt.context` |
| Publishing to an artifact | Verified, with constraints | `$.tool.call` |
| Per-person settings | Verified, with a key problem | `userConfig`, `$.store` |
| Installing dependencies | Mostly unknown | plugin.json `dependencies` |
| Compaction | Verified | `session.compact` |
| Session end | Verified | `session.end` |
| Hook order between plugins | Unknown | tiers only |

## Slash commands

At `session.start` a plugin calls `$.command.register` and answers in a `command.run` hook. Words after the name arrive in `args`. The answer has `text` (a row the model also reads), `context` (hidden notes for the model) and `exitCode` (used only under `claude -p`). It does not start a turn. A plugin can also ship skills and `.md` commands; any agent can read those, so they suit the survey, consolidation and relinking instructions.

## Queuing model work

`$.prompt.submit` gives a turn of its own once the session is idle, framed as sent by the plugin unless `asUser: true`. Softer options are `$.prompt.suggest` (taken with Tab), `$.prompt.fill`, a `classic.SessionStart` answer with `additionalContext`, and `$.agent.spawn`. `$.prompt.suggest` fails while a turn runs, so it belongs at `turn.complete`.

Gained: suggest the survey rather than submit it, because an automatic turn spends the person's tokens without asking.

## Seeing commits

Bash and PowerShell `tool.call` results both carry `gitOperation.commit {sha, kind, branch}`, so both shells must be hooked. No field lists a commit's files; the plugin runs `git diff-tree` on the sha. Unknown: whether a commit inside a compound command or script is detected. Commits made in the person's terminal or on GitHub are never seen. Local main moves after a GitHub merge only once someone fetches, and `git fetch` writes refs and uses the network.

Ways around the blind spot: compare main's sha with one in `$.store` at `session.start`; `watchPaths` with `classic.FileChanged` (unchecked from a module); or a git hook, which is a repository change the owner must approve.

## Timers and cadence

`$.clock` timers die with the session or a hot reload, and nothing schedules durably. Gained: the cadence is checked at session start and on a timer in long sessions, with the last publish time in `$.store`. A cadence with no session open needs CI or a cloud routine.

## Running git and reading files

`$.process.run` takes an argv with no shell, times out at 30 s by default, runs git with repo hooks off, and cuts each stream at 4 MiB. It is "CLI only"; whether a desktop-app session counts is unknown. `$.fs` rejects files over 4 MiB. A hook has 10 s of its own time; waits on `$` calls do not count.

Measured in the reference repository: the full patch history of its backlog and playbook is 6.19 MB, past the cut; the backlog is 615 KB and 102 commits touch it. Gained: history is fetched one commit at a time, and the merged backlog is read from main with `git show`, since a session may run in a worktree.

The hooks module allows static imports only, with no Node, DOM or `import()`. Gained: a plain TypeScript core with no `node:*` or `claude-code` value imports; the command-line entry is never imported by the hooks module.

## Panes

There is no HTML element. Each surface draws the engine's own elements, and `Markdown` exists on all of them. `Svg` is capped at 131,072 characters, and a tree draws at most 100,000 characters. A pane docks beside the transcript from 110 columns in terminal fullscreen; an unasked pane waits undrawn below 144 columns. Mobile has no Input or Select.

Gained: the full Route Map stays an outside page. In a session, a Markdown or Box pane is drawn from the generator's data model.

## Status line and context for the agent

`$.ui.status` gives one line per plugin, 2,000 characters on the terminal. Context goes in a `prompt.context` block, sent at the first request and again after a compaction or `/clear`. The catch: once it stands, later answers cannot change it. After a commit, fresh context goes through `prompt.submit` context or `tool.call` result context.

## Publishing to an artifact

`$.tool.call({ tool: 'Artifact' })` runs the tool through the permission check and its dialog. Three constraints:

- The tool may be missing on another build or machine: check `$.tool.list()` and fall back to a local file.
- A publish to an artifact the conversation has not read is refused, so each session reads first.
- The dialog opens wherever the call is made: mid-turn after a commit, or unprompted from a timer.

There is no documented artifact HTTP API. Unknown: where the page file may live (in the repository it leaves an untracked file) and whether the tool exists under `-p` or the SDK.

## Per-person settings

`userConfig` holds one value per plugin; a field with `options` becomes a picker in `/config`. `$.store` is one 4 MiB JSON file per user, not per project. The notes disagree on the store key: the first suggested `$.session.root()` or `$.session.repo()`; the later check found `root()` follows worktree moves, which splits entries, and recommends `git rev-parse --git-common-dir`.

Gained: the per-repository shape (file names, columns) goes in a committed config file that travels with the repository.

## Sharing and dependencies

A marketplace repository installs with `/plugin install`; at user scope the plugin loads in every repository. Under `-p` hooks and commands run but nothing draws, and `exitCode` makes a command usable in CI. `dependencies` has one documented effect, typing, and loose-ends, route and decide ship no type contract. "One install brings all four" is unproven.

## Compaction

`next({ ...e, instructions })` changes what the summarizer is told, and `{ skip }` vetoes. Do not filter on the trigger: a precompute result is kept and reused.

## Session end

One 1.5 s bound covers every `session.end` hook, so no model work fits. `/clear` raises it with reason `clear`, and no `session.start` follows.

## Hook order between plugins

Only the tiers are documented, not the order inside one. housekeeping, loose-ends and route share the user tier, and loose-ends and route answer without calling `next`, which ends the chain; a housekeeping hook beneath them never runs. A `session.append` hook, which sees the command's rows and may add text, does not depend on order.

## Constraints that shape the design

1. No HTML in a session: the generator splits into a data model and renderers.
2. No durable schedule and no events for outside commits: a real cadence needs CI.
3. Judgement work stays with the model, as queued turns or skills, with repository writes approved by the person.
4. Publishing is permission-gated, needs a read first and may be missing.
5. Context freezes once sent, store keys split across worktrees, and full history passes 4 MiB.
6. The API is early access and changes between releases; a failing hook is skipped silently unless it has a `.catch`.

## What Phase 0 must still settle

The notes put the first two items in Phase 0; the rest they leave open without naming a phase.

- **Hook order in the user tier.** Two throwaway plugins hooking one command, read through `next.trace` or the debug log, varying install order, names and `dependencies`. Otherwise use `session.append`, or add fallback lines to the three plugins, which the owner owns.
- **Whether `dependencies` installs the others:** install from a folder marketplace into a throwaway config.
- Whether `watchPaths` and `classic.FileChanged` work from a module.
- Whether commits in compound commands or scripts are detected.
- Whether `$.process` works in a desktop-app session.
- Whether the Artifact tool exists under `-p` or the SDK, and where its page file may live.
- Whether `prompt.submit` context attaches on a command run, and whether mobile places panes inline.
