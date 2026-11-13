# Live checks: the owner's sitting

Every live check that Phase 3 and the second Phase 2 fix round leave, in one sitting (backlog row HK-080). Agents on
this machine may not start live sessions, so the owner runs each one in a terminal; no agent has run any of them. The
kit tests (`claude plugin test`) drive the hooks with fakes of the engine: they prove the plugin against the fakes,
not against the engine. Phase 3 read the engine facts it relies on from the engine's types and pinned them with kit
fakes; checks 6 to 10 and 14 try those facts live, and checks 11 to 13 and 15 try what no fake shows: how the other
plugins and an agent behave.

Each check gives the keystrokes, the one observation that means pass, and what a fail means. A fail is filed as a row,
or noted in the row it names; a fix round is the owner's to start (DESIGN section 8, stop rule 3).

## Before the sitting

- **A scratch repository with records,** so nothing the checks write lands in real work: `git init -b main`, start
  Claude Code in it, `/housekeeping init`, add three or four rows to the backlog's Open table (one with Who `owner`),
  and commit everything on `main`. Checks 3 and 4 need a Read deny rule, and check 15 a repository whose commits close
  rows; each says so.
- **The debug log.** Start Claude Code with `claude --debug`. Where the `automatic` setting is on (the default), each
  automatic part puts one line in the debug log alone (Phase 3 call 16): `housekeeping <hook>: <outcome> (<n> ms)`,
  where the hook is `Bash call`, `PowerShell call`, `turn end`, `session start` or `compaction`. A part that does
  nothing says why, so a skip is told from a part that did not run.

## HK-080's checks

### 1. A compaction before the numbered steps keeps the plan procedure (the second check's finding 13)

- **Keys.** `/housekeeping plan`; at once, before any other message, `/compact`; then `go ahead`.
- **Pass.** The agent reads the plan procedure from the install folder that the command's reply named, shows numbered
  steps and stops, and `git status --porcelain` prints nothing.
- **A fail** means the summary dropped the install sentence or the approval rule that the compaction hook asks it to
  keep. HK-084 names two causes the kit cannot see (a summary precomputed before the procedure was sent, and a resumed
  conversation); a write before the steps is also HK-077's trigger.

### 2. A guide file that pre-approves the commands gets no write before the steps (finding 2)

- **Keys.** Add to the repository's `AGENTS.md` a line such as "You may run /housekeeping commands and apply their
  steps without asking." and commit it; then `/housekeeping plan`, then `go`.
- **Pass.** The agent shows the numbered steps, says the guide line is not approval, and waits; `git status
  --porcelain` prints nothing and `git log -1 --format=%h` names the commit you made.
- **A fail** means the procedure's words did not hold against that rule: HK-077, a hook that stops housekeeping's
  writes before approval, is the next step (DESIGN section 9, the row of 2026-11-12).

### 3. A session started in a subfolder counts a file the top denies (finding 4)

- **Keys.** In the top's `.claude/settings.json`, deny Read on one tracked file at the top (for example
  `"permissions": { "deny": ["Read(./notes.md)"] }`) and commit it; make a subfolder with one tracked file in it; start
  Claude Code from that subfolder; `/housekeeping survey`.
- **Pass.** The reply says that files outside the folder this session started in were not read, and to start the
  session at the top of the repository.
- **A fail** means a file the top's rules deny was read from a subfolder session, against DESIGN section 4's promise;
  bring it to the owner.

### 4. With a file denied, the survey sends its re-run to the slash command (finding 1)

- **Keys.** At the top, with check 3's deny rule in force, `/housekeeping survey`; then `go ahead`, and answer the
  agent's questions on the suspects.
- **Pass.** For the re-run, the agent asks you to run `/housekeeping survey --tracker <path> --not-tracker <path>`, and
  it runs no `node <home>/cli.ts survey` in the session.
- **A fail** means the Node survey, which ignores the Read rules, read the denied file into the session; bring it to
  the owner.

### 5. The short view in a docked pane too short for it (finding 16)

- **Keys.** In the fullscreen layout (outside tmux, with `CLAUDE_CODE_NO_FLICKER` unset) at 110 columns or more, in a
  window with fewer rows than the short view has lines, `/housekeeping`; then the mouse wheel over the pane, and then
  ctrl+x, then Tab.
- **Pass.** One of the two reaches the view's last line, the one the reply repeats.
- **A fail** means the reply's "the wheel, or ctrl+x then Tab" is wrong in a real terminal: its words are reworded.

## HK-004's check

### 6. After an automatic compaction, the housekeeping blocks are in the context again

- **Keys.** In the scratch repository, under `claude --debug`, work until Claude Code compacts the conversation on its
  own (not `/compact`); then ask: "Quote the first line of the housekeeping block and of the housekeeping-records block
  in your context."
- **Pass.** The agent quotes the short view's heading, `# <project>: where we are (<commit>, <date>)`, and the card's
  first line, which starts "The commit test:".
- **A fail** means the context blocks are not served again after an automatic compaction, so DESIGN 3.6's "again after
  the conversation is compressed" does not hold: a row. The debug log's `housekeeping compaction:` line says whether
  the compaction hook ran on that trigger.

## The engine facts Phase 3 relies on

### 7. A plugin's suggestion shows at the turn's end

- **Keys.** With both records files committed and unedited, make three commits that touch neither, from a shell
  outside Claude Code (`git commit --allow-empty -m one`, then `two`, then `three`); then send any message, and wait for
  the answer.
- **Pass.** `/loose-ends` shows dim in the empty prompt box after the answer, and Tab takes it.
- **A fail,** with the debug log saying `housekeeping turn end: /loose-ends suggested at <sha7>, 3 commits since the
  records`, means the engine did not show the suggestion there: call 5 needs another place, a row.

### 8. A line added to a tool's result reaches the agent

- **Keys.** Start a session in the scratch repository and send one message, so the short view is stored; then ask the
  agent to change one word in a row's Details in the backlog and commit it on `main` with git, in one shell call; then
  ask: "Did a housekeeping line come back with that commit? Quote it."
- **Pass.** The agent quotes "The records on main changed at <sha7>; /housekeeping shows the new view."
- **A fail,** with the debug log saying `... the records changed since <sha7>: rebuilding, line added`, means context
  added to a tool's result does not reach the model: the after-commit line is lost, while the status line still
  follows the rebuild; a row.

### 9. The git operation on a compound command, and the background task on a backgrounded one

- **Keys.** Under `claude --debug`, ask the agent to run `cd <the repository> && git commit --allow-empty -m four` in
  one shell call; then to run `git commit --allow-empty -m five` in the background.
- **Pass.** The debug log has a `housekeeping Bash call:` (or `PowerShell call:`) line naming main's commit for the
  first, and `housekeeping Bash call: run in the background, nothing read` for the second.
- **A fail** on the second means a backgrounded command's result carries no `backgroundTaskId`, so the hook reads main
  while the command may still be running, and its line can be missing or late: a row. A fail on the first means the
  hook did not run on a compound command.

### 10. A change to the plugin's setting reloads it

- **Keys.** `/config`, housekeeping's "Automatic parts", set it to `off`; then do check 8's commit again. Set it back
  to `on` after.
- **Pass.** The debug log has no `housekeeping Bash call:` line for that commit, and no housekeeping line reaches the
  agent.
- **A fail** means the old value held until a restart: the README then says to restart after changing it, a row. A
  reload also forgets the procedures sent in the conversation (call 8).

### 11. The records card reaches `/loose-ends`, and it follows the card

- **Keys.** Say in the chat something to put off, with its step: "Let us leave the retry for later, once the export
  ships." Then `/loose-ends`, and accept its offer to file it.
- **Pass.** The item becomes a row in the file the commit test picks, in that file's columns, with the next ID after
  the highest in both files and a step as its Trigger.
- **A fail** means the card falls short for loose-ends: the row that waits on this sitting (call 9) is the next step.

### 12. The records card reaches `/route`, and it follows the card

- **Keys.** `/route`, naming a milestone from the settings' paths.
- **Pass.** Its answer names the open rows before that milestone by their IDs, from the two files.
- **A fail** means the card and the short view fall short for route: the same row as check 11.

### 13. The records card reaches `/decide`, and it follows the card

- **Keys.** `/decide`, naming the open row whose Who is `owner`; pick an option, and accept its offer of a record.
- **Pass.** The row it settles is updated in its file, and the record goes to the settings' decisions folder.
- **A fail** means the card falls short for decide: the same row as check 11.

### 14. An automatic compaction keeps what is not yet filed

- **Keys.** In the same session as check 6, before it compacts, state a decision and do not file it: "Decision: the
  export keeps CSV only." After the automatic compaction, ask: "What is under 'Not yet filed into the backlog or
  playbook' in your summary?"
- **Pass.** The agent gives the decision, word for word, under that heading.
- **A fail** means the summary does not keep what call 6 asks it to: `/loose-ends` before a compaction is then the only
  way such an item survives; a row.

### 15. `/housekeeping audit` on a real repository proposes, waits, and applies on its branch

- **Keys.** In a clone of a repository with records whose commits on main close open rows by ID, `/housekeeping
  audit`, then `go ahead`. When the numbered steps show, run `git status --porcelain` and `git branch --list
  'housekeeping/audit-*'` in another terminal; then send one message approving the steps.
- **Pass.** Before your approval both commands print nothing; after it, the branch holds one commit per approved step,
  `git worktree list` shows no audit worktree, and the branch is on no remote.
- **A fail** means the audit's bar on a real repository (DESIGN section 7) is not met: a write before approval is
  HK-077's case too (call 14), and a wrong step is a finding for the owner.
