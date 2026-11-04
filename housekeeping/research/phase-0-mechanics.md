# Phase 0: what the plugin system does for housekeeping

**Date:** 2026-11-03. Claude Code CLI 2.1.317. A throwaway mod (`hk-spike`) and a small fixture repository
in the session's scratch folder; both were deleted afterwards.

**Result:** every check the design asked for works. One gives housekeeping a better option than the
design assumed (check 1).

| # | The design's check | Result |
|---|---|---|
| 1 | Do the unchanged `loose-ends` and `route` use the pair of files when the agent's context names them? And can housekeeping add to their commands? | **Works.** See below. |
| 2 | What does installing a plugin with dependencies do? | **Works.** Installing a plugin also installed the plugin it depends on, from the same marketplace ("+ 1 dependency"). |
| 3 | Publishing to an artifact, from a command and at the end of a turn | **Works.** See below. |
| 4 | Do the summarizer's instructions hold on compression, and can the next session find the last session's transcript? | **Works**, for a compression typed by hand. See below. |
| 5 | Is a commit seen on both the Bash and PowerShell tools, with the files it touched? | **Works.** See below. |
| 6 | Do process calls work in a session the desktop app started? | **Works.** `git rev-parse HEAD` returned exit 0 and the head commit, run by the person's command in the desktop app. |

## 1. The three existing plugins

**With the context alone.** A `prompt.context` block named the two files, their row format and where
decisions live. With that block in place:
- **loose-ends' own procedure** homed a deferred item as a row in the backlog, with a step as its trigger,
  not a date. It listed a dropped idea for the decisions folder. It offered to write both, as its procedure
  says, and did not write them unasked.
- **route's own procedure** read both files, named their rows, gave the real gate and the critical path,
  and pointed out a step that had no row of its own. The design advises exactly that: make every step a
  row.

**The limit of the test.** Under `claude -p`, a slash command given as the whole prompt prints its text and
ends, with no model turn. So the procedures' own text was sent as the prompt. The command path itself is
standard Claude Code behaviour.

**A better option than the design assumed.** When a plugin lists another under `dependencies`, its hook
on that plugin's command runs outermost, whatever the load order. Without `dependencies`, the load order
decides. So housekeeping, which lists `loose-ends`, `route` and `decide` as dependencies, can add a note
to their commands' results directly, and still makes no change to their code. The design's fallback, a
note on the command's transcript rows, is not needed.

## 3. Publishing

**From a command.** The plugin's own `$.tool.call` did the work, each step with the person's approval:
- it wrote the page through the Write tool;
- it published the page through the Artifact tool;
- it got back a private claude.ai link.

The Artifact tool's reply says that publishing the same file path again in the same conversation keeps the
link. From another conversation, the publish passes the link, and the tool's rules ask for a read first.

**At the end of a turn.** A `turn.complete` hook read the artifact and then published to the same link.
Both succeeded. The content had not changed, so the version stayed the same.

**A run that is only a command fires no end-of-turn hook.** That matters for `claude -p "/housekeeping
map"` in CI: the command runs and sets its exit code, and nothing else happens.

## 4. Compression and the transcript

**Compression.** A `session.compact` hook added an instruction: "End the summary with this exact line",
followed by a token. The summary ended with that token, which appears nowhere else in the transcript. The
hook saw the trigger `manual`. Automatic compression was not triggered in the test.

**The transcript at the next start.**
- A `session.end` hook stored the ending session's id.
- The transcript path, built as `<home>\.claude\projects\<the session root with every non-alphanumeric
  character as "-">\<id>.jsonl`, equals the `transcript_path` that the classic `SessionEnd` hook reports.
- At the next session's start, the plugin found that file.

**The time limit at session end is shared.** In one run, another installed plugin's session-end hook was
cancelled. housekeeping's write at session end must stay tiny: an id and one flag.

## 5. Commits

`gitOperation.commit` was present on both tools, with a seven-character sha and kind `committed`:
- on Bash, inside a compound command, `cd … && git add -A && git commit …`;
- on PowerShell, in a `git commit -am …; git rev-parse …` chain.

`git diff-tree --no-commit-id --name-only -r <sha>` gave the right file each time.

## For whoever tests on Windows

Git Bash rewrites a leading `/` in an argument into a Windows path, so `claude -p "/loose-ends"` becomes a
path. Run with `MSYS_NO_PATHCONV=1`, and then pass Windows-form paths (`C:/…`) to `--plugin-dir`; the
`/c/Users/…` form then breaks.

## What this changes for the plans

- **Phase 3's integration** can add a note to `/loose-ends`, `/route` and `/decide` through their command
  results, alongside the standing context, still without editing them.
- **The README** can tell people that installing housekeeping brings the three plugins with it, when they
  come from the same marketplace.
- **Phase 3's tests** must still exercise automatic compression, which this check did not.
