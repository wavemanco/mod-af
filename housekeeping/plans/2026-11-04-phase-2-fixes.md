# Phase 2 fix round

The adversarial check of Phase 2 (2026-11-04) confirmed 2 critical and 30 important findings and parked 100
minors. The owner chose one fix round for all 32, with the four minors that tied on their votes, then one check
of the fixes run together. The finding numbers below are the check's. Its full report, with each finding's
evidence and reproduction, is in the local raw notes (`research/raw/phase-2-final-check.md`, git-ignored).

Before this round, at the owner's two history answers, the branch's 20 commits were rewritten: the test
repositories' own words became descriptions, and author and committer became the owner's GitHub no-reply
address. Nothing was pushed.

## The owner's decisions (2026-11-04)

| Question | Chosen, in the owner's words | Rejected |
|---|---|---|
| How much one fix round covers | "All 32 in one round (Recommended)" | "Secrets and lost work: 17 now"; "Only the 2 critical" |
| The test repositories' words in the branch's commits | "Reword and rewrite (Recommended)" | "Leave them in" |
| The owner's address on the branch's commits | "Use GitHub no-reply (Recommended)" | "Leave as it is" |
| Read deny rules (finding 3) | "Obey the deny rules (Recommended)" | "Keep reading, reword design" |
| Key shapes (finding 4) | "Add JWTs, not encoded (Recommended)" | "Add both"; "Clear cases only" |
| A guide file's standing approval (finding 9) | "No: approve after seeing steps (Recommended)" | "Yes, if it names the plugin" |
| Starting the agent's turn (finding 21) | "Say what's next (Recommended)" | "Start the turn itself" |
| The survey's weights (finding 8) | "Your recommended option + also mention what was NOT measured (and mention which files housekeeping suspects might have trackers or pending items). The plugin can then ask the user if they want housekeeping to study those files or if the user already knows those files are trackers or not. And then a re-scoring can be done based on that. Is that feasible?" | "Also score data files" |
| Building that now | "Build it in this round (Recommended)" | "Recommended wording now, idea later" |

The recommended option for the weights was: keep the weights, word the result as what was measured, count
`*`, `+` and numbered checkboxes, and have the agent read the guide files before it says no file holds pending
work.

## How the round runs

- Six tasks, in order, each done by one agent on the branch `housekeeping/phase-2`. Tasks share files, so they
  never run at once.
- Each finding gets a test that fails before its fix and passes after it. Wording-only changes need none.
- The gate runs after each task: `claude plugin test housekeeping`, then
  `node --test housekeeping/node-tests/*.spec.ts`, then `claude plugin validate housekeeping`.
- One commit per finding, or per small group of findings in the same lines.
- A fix that turns out larger than its entry here is not widened. The agent stops that finding, says why, and
  goes on with the rest.
- A question these decisions do not settle is not decided by the agent. It is reported.
- Then a check of all the fixes run together, in its own clones. Nothing is pushed in this round.

## Task 1: privacy

Files: `hooks/core/index.ts`, `privacy.ts`, `page.ts`, `brief.ts`.

- **1. The scan reads encoded text.** `renderPage` writes `<`, `>`, `&` and non-ASCII characters as
  `\uXXXX`, and JSON writes line breaks as `\n`. So the scan at `index.ts:25` sees a letter before a key and
  lets it through, and sees `u003e@name.x` as an address. Scan the page's text with those escapes decoded,
  for example every string in the page data, in place of the escaped page. Tests:
  - a key after `<br>`, `<`, `>`, `&`, a curly quote, an em dash and a tab, and at a where-we-are line start,
    is refused;
  - a dotted at-name after `<br>` builds the page;
  - a subject hit is masked from the decoded subject.
- **4. Key shapes.** Add an underscore-style live payment key, a GitLab token, an npm token, an AWS temporary
  key, a webhook secret and a JWT. Let an address's domain take non-ASCII letters. Percent-encoded addresses
  stay out, at the owner's choice. The README and DESIGN 3.4 then name what the scan covers instead of
  promising any key.
- **Tied minor: the short view's cut runs before the mask** (`brief.ts:24`, `:53`; `privacy.ts:11`). Mask
  first, then cut. A private key's body, and a one-line private key in a commit subject, must not reach the
  page or the short view.

## Task 2: parsing and counts

Files: `hooks/core/markdown.ts`, `parse.ts`, `facts.ts`, `findings.ts`, `brief.ts`, `page.ts`,
`templates.ts`, `template.ts`.

- **5. A cut table.** A pipe-led line in no table, and a pipe line right after a table's end, are reported as
  dropped, each with its own message.
- **6. A fence left open.** A file that ends inside a fence gives a warning naming the opener's line. It must
  not be filtered out when the fence opens in where-we-are (`parse.ts:68`).
- **15. An impossible Last done date.** It gives a warning naming the row, and nothing throws (`dutyDue`
  returns false for an invalid date). Test both routes, with a round trip like `findings.ts:37-42`.
- **16. An ID both open and in Done, or twice in Done.** A warning, not an error, because a reopened row is
  legitimate.
- **17. A Done table with a mismatched separator.** It warns like any dropped table.
- **24. A where-we-are with no date.** It warns when the paragraph has not changed since the newest history
  entry with row changes. That covers `init`'s own paragraph.
- **25. Duty periods.** Add quarter and year, take the latest Last done, and warn on a period the short view
  cannot read. FORMAT.md line 23 says which periods are computed.
- **27. The Done pane.** Use the cell under the table's Item header when there is one, and the ID cell
  otherwise.
- **Tied minor: rows in a named section vanish** (`parse.ts:21-25`, `:72`). Sections named by `checklists`
  or `whereWeAre` match their heading whole, not as a prefix. A row table inside a `skipSections` section
  gives one warning saying its rows are not read. FORMAT.md line 48 says so.

## Task 3: the survey

Files: `hooks/core/survey.ts`, `hooks/adapter.ts`, `cli.ts` (survey), `hooks/register.tsx` (`procedure`).

- **3. Read deny rules, at the owner's "Obey the deny rules".** `readTracked` asks `$.tool.check` for Read
  before reading each file. It drops denied files and adds one Not measured line with their count and no names.
  `adapter.ts:1-2` then says so. When every tracker is denied, the reply must not say nothing to move.
- **7. Say what stopped.** A failed git listing exits 1 and says so, in the plugin as in the Node command. The
  reply names any limit that stopped the reading. Add a plugin test with `ls-files` exiting 128.
- **8. The owner's suspects design.**
  - **Not measured.** A section right after the header line, so the 20,000-character cut cannot hide it:
    - the files not read, counted by reason: over 2 MB, binary or lockfile, unreadable, denied by Read rules,
      past the 3,000-file or 30 MB limit;
    - one fixed line on what the score does not read: data files (YAML, JSON, CSV, TOML), and code files apart
      from their TODO comments.
  - **Suspects.** Files with some sign of pending work but below the score of 3, each with its reason:
    - a prose file with a TODO, roadmap or next-steps heading, or a few TODO lines or boxes;
    - a data file whose name holds a tracker word.

    At most 15 are shown in the text, with a count of the rest; all are in `--json`.
  - **Re-scoring.** `--tracker <path>` and `--not-tracker <path>`, each repeatable, on `node cli.ts survey`
    and on `/housekeeping survey`.
    - A tracker path becomes a candidate with a `named` signal and ranks first. Its references and machine
      readers are found as for any top candidate.
    - A not-tracker path leaves the candidates and the suspects.
    - A path that is not tracked is an error naming it.
  - **Wording.** With no candidates, the result says no file reached the survey's score of 3, then gives Not
    measured and Suspects. "Nothing to move" is kept only for a repository with no tracked files.
  - **Boxes.** `*`, `+` and numbered checkboxes count like `-` ones. The weights stay as they are.
- **21. Say what's next, at the owner's choice.** The reply of `/housekeeping survey` and `plan` ends by saying
  that the agent carries out the procedure on the person's next message, for example "go ahead". Tests pin
  the text.
- **22. Where housekeeping lives.** `procedure()` adds one context line with `$.plugin.root`, so the agent can
  run the Node command and read FORMAT.md.
- **29. A subfolder.** The Node survey runs `git rev-parse --show-toplevel` first and uses it as the working
  folder and path base. `--repo <subfolder>` surveys that repository's whole tree, and says so.
- **30. Read order.** Read paths whose base name matches the tracker or guide patterns first, then the rest.
- **31. Same-named files.** Credit a path-qualified mention only to the target whose path ends with it,
  resolving `./` and `../` against the referring file. A bare name is credited to each same-named target and
  marked ambiguous.
- **32. A candidate with no extension.** For a target with no dot, bare-word hits are possible uses and are
  not ranked by count. A file starting `#!` is not prose.

## Task 4: the plugin, the Node command and git

Files: `hooks/register.tsx`, `hooks/adapter.ts`, `cli.ts`, `hooks/core/history.ts`, `.claude-plugin/plugin.json`.

- **2. A repository's git.exe.** The first line of `main` in `cli.ts` sets
  `process.env.NoDefaultCurrentDirectoryInExePath = '1'`. The child's `env` alone does not work. Test it on
  Windows with a tracked stand-in program in a fixture.
- **10. The version.** Set `version` to 0.2.0.
- **11. A command past its budget.** Register the hook so that an overrun replies with exit 1 and points at
  `node cli.ts`.
- **12. A pull request.** Add a README line: to check a pull request's own records, run with a settings copy
  whose mainBranch is HEAD. `check` says which branch it read when HEAD is on another branch.
- **13. A shallow clone.** Read `git rev-parse --is-shallow-repository`. When it is true, pass no snapshots and
  add one warning that the clone holds part of the history. DESIGN.md lines 227 and 261 say "given the whole
  history".
- **14. Signed commits.** Add `--no-show-signature` to the log and head calls, and update
  `tests/history.test.ts:24-25`.
- **18. A second `/housekeeping`.** Redraw the open pane (`$.ui.invalidate('ui.render')` after show), with a
  kit test that runs the command twice.
- **19. A small pane.** When the pane has no room, put the brief in the reply, or say how to scroll.
- **20. A cold cache.** `prompt.context` does not await the walk. It serves the last stored view, labelled with
  its commit, while a rebuild runs. With nothing stored, it says the view is being built. This is the round's
  one design change: if it needs more than that, stop and report.
- **26. The status line.** With a lane that has no stations, it says "no milestone yet".
- **28. Git failures.** Say "no branch" only when the repository opens and the name does not resolve.
  Otherwise give git's first error line, in the plugin as in the Node command. Add `--` after the revision.
- **Tied minor: the remote.** `map` and `check` say when local main is behind its remote copy, as DESIGN.md
  lines 231 and 261 say.
- **Tied minor: a blobless clone.** The command never fetches (`GIT_NO_LAZY_FETCH=1` or the like). A blob it
  cannot read is reported, not read as a missing file.

## Task 5: the procedures and the format

Files: `prompts/plan.md`, `prompts/survey.md`, `FORMAT.md`, `README.md`.

- **9. Approval, at the owner's "No: approve after seeing steps".** Add to `plan.md` (line 23) and
  `survey.md` (after its Rules line) that a "go" before the numbered steps are shown, or a guide-file rule to
  act at once, is not approval: the agent reports it and waits.
- **8. In the survey procedure.** Before it says no file holds pending work, the agent reads the guide files.
  It puts the suspects to the person: study it, it is a tracker, or it is not. It re-runs the survey with
  `--tracker` and `--not-tracker`. The answers live in the session and in the plan, and nothing is written
  before the plan is approved.
- **21.** README line 31 says the agent starts on the person's next message, with a note for `claude -p`.
- **22.** `plan.md` line 7 uses the folder the context names, and FORMAT.md joins line 3's list of what to
  read.
- **23.** `plan.md` step 7 and FORMAT.md's moving section: `.gitignore` gains `.housekeeping/` when it is
  missing.
- **3.** README says survey and plan obey the person's Read deny rules, and the Node command, run outside
  Claude Code, reads every tracked file.

## Task 6: the records

Files: `DESIGN.md`, `BACKLOG.md`, `research/`, `README.md` (lines the other tasks did not change).

- DESIGN section 9 gets one row per decision above, quoted exactly, with Why, Rejected and why, and If it
  breaks.
- DESIGN 3.8 gets the suspects design. DESIGN 3.4 says what the privacy scan covers, and section 4 says the
  survey's reads obey Read deny rules.
- `research/phase-2-check-minors.md` lists the 94 parked minors in described terms, grouped as the check
  grouped them. It adds the deferred minors the build ledger holds.
  - A minor that this round's fixes already settled is marked fixed, with its commit.
  - `BACKLOG.md` gets one row per group, each with its trigger and Land now in FORMAT.md's form.
- The plugin's own `check` passes on `BACKLOG.md`.

## Completion criteria

- Every finding above, and the suspects design, has its fix and its test, or a reason in the task's result.
- The gate passes after the last task.
- The name and word searches over the branch find nothing. They use the git-ignored lists in
  `research/raw/`.
- The check of the fixes run together finds no critical or important breakage, or brings what it finds to the
  owner.

## Stop rules

- Nothing is pushed and no pull request is opened.
- No fix is widened past its entry. No question these decisions leave open is settled by an agent.
- No further fix round starts without the owner.
