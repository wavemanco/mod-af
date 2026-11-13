# Phase 2 check: the parked minors

The adversarial check of Phase 2 (2026-11-04) confirmed 32 findings to fix and parked 100 minors. Two of
the minors were history questions, which the owner answered before the fix round (DESIGN.md section 9), and
four tied on their votes and went into the fix round (plans/2026-11-04-phase-2-fixes.md). This file holds the
other 94, in described terms and grouped as the check grouped them, then the minors that the build's own
ledger deferred and that no backlog row holds. The check's full report stays in the local raw notes.

How to read a line:
- **The place** is the file and line the check gave, at the tip it checked (eb3723c after the history
  rewrite). Paths are under `housekeeping/` unless they say otherwise. The fix round moved some of the lines.
- **Open** means nothing settled it. **Partly fixed** and **Fixed** name the fix round's commit. **A note**
  records something a builder said that holds no defect.
- Each group's open minors are one row in [`../BACKLOG.md`](../BACKLOG.md), named at the group's heading.

No finding of the fix round was stopped: each of the round's first five tasks closed every finding it held.

## Privacy and secrets (HK-060)

- **Open.** `hooks/core/findings.ts:23, :33, :36, :41; hooks/core/index.ts:36`: check's findings quote a key or an address in the clear, and they reach plan's context and CI logs.
- **Partly fixed** (d574c1d). `hooks/core/privacy.ts:3; hooks/core/index.ts:36`: text that is no address or key (a file name with an at sign, a git remote, a kebab word starting `sk-`) still stops check and map with no override, and the message says "personal address" with no sample; the round ended only the stops that the page's escapes made.
- **Open.** `hooks/core/survey.ts:65`: the survey masks the guide lines it quotes but not the paths it lists.
- **Open.** `hooks/core/privacy.ts:19`: example subdomains and the reserved `.test`, `.example` and `.invalid` domains are refused, though DESIGN allows example addresses.
- **Open.** `hooks/core/index.ts:29`: a hit in a not-doing row names only "the page".
- **Open.** `hooks/core/index.ts:30`: the privacy error can name a row whose hit is in a cell the page does not show.
- **Open.** `hooks/core/privacy.ts:3`: one backslash before the at sign, or an HTML entity for it, gets an address past the scan.
- **Open.** `hooks/register.tsx:209`: the short view enters every session's context with no mark that it is the repository's data.
- **Open.** `hooks/register.tsx:31; hooks/adapter.ts:29-32`: plan's findings and the short view carry text from a pair and settings that the person's Read rules deny, since only the survey's reads obey them.
- **Open.** `hooks/core/survey.ts:25`: the guide-file pattern takes `agents.py`, `agents.yaml` and `agents.env`, so their lines are listed as guide lines and spend the budget.

## Survey (HK-061)

- **Open.** `hooks/core/markdown.ts:13, :14; hooks/core/survey.ts:18, :44; hooks/core/privacy.ts:3`: a crafted line in any tracked file can make a regular expression hang, the Node command until killed and the plugin with a reply that blames the plugin; no natural trigger was found.
- **Fixed** (401cfbc, f31618d). `hooks/core/survey.ts:119`: the stop notice sat in Skipped, where the 20,000-character cut could hide it; Not measured now comes right after the header, and the reply names any limit that stopped the reading.
- **Open.** `hooks/core/survey.ts:121`: the Skipped list is unbounded and crowds the references and guide lines out of the text in a sparse checkout.
- **Open.** `hooks/core/survey.ts:43`: a byte order mark hides a heading or box on a file's first line.
- **Open.** `cli.ts:40; hooks/adapter.ts:115`: during a merge conflict each unmerged file is listed, and read, three times.
- **Open.** `hooks/core/survey.ts:118`: a tracker saved as UTF-16 is counted under "binary or lockfile" and not named.
- **Partly fixed** (90b9afb, 5669ce6). `hooks/core/survey.ts:76`: a name joined to another by a dot before it no longer counts as a reference, and since the second round a percent-encoded link does; a name with a suffix after it (`BACKLOG.md.bak`) still counts, and case variants still do not.
- **Open.** `hooks/core/survey.ts:82`: "(machine)" marks `.txt`, `.rst`, `.org` and extensionless prose files as if they were code.
- **Open.** `hooks/core/survey.ts:43`: ID headings and boxes inside code fences count, while tables there do not.
- **Open.** `hooks/core/survey.ts:85`: the text's five files per target are the ones with most mentions, so machine readers, which often name a file once, are the first hidden.
- **Open.** `hooks/core/survey.ts:27`: the guide lines leave out a sentence that calls a file the canonical tracker without one of the pattern's words.
- **Open.** `tests/survey.test.ts:147`: a file that is not UTF-8 is read and counted, the opposite of the Phase 2 plan's Review Focus 3, and only a code comment says so.
- **Open.** `hooks/adapter.ts:120; cli.ts:47`: both readers check only a path's last part for a link, so a linked parent folder lets them read a file outside the repository.
- **Open.** `prompts/survey.md:13`: DESIGN says the survey reports GitHub Issues and Projects, but neither procedure mentions them, and one live run in eight missed them.

## Parsing and counts (HK-062)

- **Open.** `hooks/core/facts.ts:31; hooks/core/lanes.ts:59`: a trigger starting "Everything" or "Everyone" makes its row a duty, whose station then reads reached.
- **Open.** `hooks/core/history.ts:8; hooks/core/findings.ts:82`: reading main's first parents gives a false stale warning when a branch's records merge on a later day than they were written.
- **Open.** `hooks/core/brief.ts:28; hooks/core/page.ts:11; hooks/core/findings.ts:54`: HK-016 is partly done, since the short view, the page data and the cycle check still keep the last row of a duplicate ID.
- **Open.** `hooks/core/markdown.ts:48`: rows under a second level-one heading after a Done section read as closed.
- **Partly fixed** (6636cb4). `hooks/core/parse.ts:131`: two Done readers on one section, or an all-empty Done row, still inflate the closed count, though an ID in more than one Done entry now gives a warning.
- **Open.** `hooks/core/facts.ts:54, :60; hooks/core/template.ts:349; hooks/register.tsx:44`: a duty with Land now yes counts as land now but is left out of the list behind that count.
- **Open.** `hooks/core/lanes.ts:60`: a checklist's milestone that is on no path gates nothing, with no finding.
- **Open.** `hooks/core/parse.ts:50`: with the empty text left out of `values.nothing`, an empty cell or a trailing comma stays as a value.
- **Open.** `hooks/core/markdown.ts:57`: a table inside an HTML comment counts as open rows.
- **Open.** `hooks/core/history.ts:8`: run from a subfolder with `--settings`, the Node command reads an empty history and says nothing.
- **Open.** `hooks/core/parse.ts:108`: a backlog saved as UTF-16 reads as 0 rows with no error.
- **Open.** `hooks/core/parse.ts:78`: a table with neither an ID nor an Item column gives no finding, though its rows are plainly rows.
- **Open.** `hooks/core/parse.ts:148`: a checklist line holding U+2028 is dropped with no finding, so its milestone reads reached.
- **Open.** `hooks/core/history.ts:10`: git takes a file path holding a wildcard as a pattern, so a missing file reads as empty and check passes.
- **Open.** `cli.ts:80`: a `..` or absolute path in the settings crashes the Node command, the plugin passes over the same failure, and a path that leaves and re-enters its folder gives 0 rows.
- **Open.** `hooks/core/settings.ts:52`: an ID pattern with nested repeats can hang the Node command.
- **Open.** `hooks/core/lanes.ts:16; hooks/core/findings.ts:30`: the lanes' work grows with the cube of a long chain of waits.
- **Open.** `hooks/core/template.ts:469; hooks/core/lanes.ts:52`: a station can read "reached" and "1 open row before it" at once.

## Short view, page and replies (HK-063)

- **Open.** `hooks/core/template.ts:518`: an empty lane on the page still says "Every milestone on this path is reached.", though HK-037 is in Done and the status line now says "no milestone yet" (6913008).
- **Open.** `hooks/core/index.ts:39-40`: the page-size warning reaches neither map's output nor the page.
- **Open.** `hooks/core/brief.ts:35, :45, :47`: the short view does not say when it shows only part of a list.
- **Open.** `hooks/core/brief.ts:24`: a cut that falls inside a surrogate pair prints U+FFFD.
- **Partly fixed** (df828ec). `hooks/adapter.ts:49; cli.ts:98; hooks/core/brief.ts:30`: the Node brief no longer throws on an unborn HEAD, but a detached HEAD still reads "On branch HEAD" and the count still says "1 commits".
- **Open.** `hooks/register.tsx:63`: the cache stamp holds no plugin version, so an updated plugin's short view waits for main to move.
- **Open.** `hooks/register.tsx:208`: the status line is not refreshed when prompt.context rebuilds the view.
- **Open.** `hooks/register.tsx:51`: HK-035's fix leaves "Duties due" in the automatic view as of the day it was built while main stays still, and only a code comment and this file say so.
- **Open.** `hooks/core/brief.ts:53; hooks/register.tsx:137`: a control character in a shown title blanks the whole pane while check passes, and the same bytes reach the terminal raw through the Node brief and `claude -p`.
- **Open.** `hooks/register.tsx:44; hooks/core/template.ts:350`: the status line says "0 need you" while the short view lists an agent's row with a small choice under "Needs you".
- **Open.** `hooks/register.tsx:199`: the pane reads titles as Markdown, so `__init__` shows as a bold "init".
- **Open.** `hooks/register.tsx:106`: No or Esc at init's write dialog prints a refusal written for the model and does not say what was left unwritten.
- **Open.** `hooks/register.tsx:137`: replies repeat the plugin's name ("housekeeping: housekeeping: short view open"), in the terminal and under `claude -p`.
- **Open.** `hooks/register.tsx:79, :194`: init run from a subfolder does not say where it wrote, and caught errors repeat the plugin's name.
- **Open.** `hooks/register.tsx:170`: HK-036's fallback takes the first claude.ai link in the publish text over the link just published to; seen in the test kit only.
- **Open.** `hooks/register.tsx:158, :160`: a failed read of the stored link drops the partition line and the page's path from the reply.
- **Open.** `hooks/register.tsx:128`: an unknown subcommand or extra argument gets the usage line with exit 0 under `claude -p`.

## The Node command and git (HK-064)

- **Open.** `cli.ts:71`: with no local main, check, map and brief exit 2 and point at the setting even when origin's main and the whole history are there; a message offering a way out must name HEAD for a pull request, or it gives finding 12's false pass.
- **Open.** `hooks/core/history.ts:8`: with `GIT_LITERAL_PATHSPECS=1` the `:(literal)` paths that Phase 2 added match nothing.
- **Open.** `cli.ts:35`: `--repo` under a `GIT_DIR` or `GIT_INDEX_FILE` from another repository reads that repository under the named one's settings.
- **Open.** `hooks/register.tsx:23`: with `GIT_DIR` set and no `GIT_WORK_TREE`, a subfolder is taken as the top, so HK-030 does not hold and init writes its files one folder too deep.
- **Open.** `cli.ts:17`: `--out` is accepted and ignored on check and brief.
- **Open.** `cli.ts:108`: no document says which Node versions the command needs, and on Node 23.6 to 24.1 it would print nothing and exit 0 (simulated, not run).

## Procedures (HK-065)

- **Partly fixed** (7e593bc). `prompts/survey.md:30`: a "go" before a plan's steps are shown is no longer approval, but the survey's offer still suggests a slash command the agent cannot run, and no rule says how long that holds.
- **Open.** `prompts/plan.md:15`: step 3 has the agent put a heading into a shell command as the file writes it, quotes and all.
- **Open.** `prompts/plan.md:15`: the Filed command can return a side branch's day while its sentence says the day the item entered main, also matches longer IDs, and breaks on an apostrophe.
- **Open.** `prompts/plan.md:16-18`: "history stays as it is" and "no link is left pointing at a moved item" contradict where history links a moved item.
- **Open.** `prompts/plan.md:15, :32`: "an item keeps its ID" collides with "unique across both files", and the procedure does not say what to do when both files hold one ID.
- **Partly fixed** (a69b963, d64e739). `FORMAT.md:37`: FORMAT.md now gives a duty's "Last done:" form and check warns on a bad day or period, but "no dates in triggers" is still missing there and not flagged.
- **Open.** `prompts/plan.md:15`: nothing says where a row's Trigger and Land now come from, or what yes requires.
- **Open.** `prompts/plan.md:17`: on a strict reading, an action recorded only in history can be dropped without a word.
- **Open.** `prompts/plan.md:24`: the test step names no command, makes no provision for tests that spend money, and does not say what to do when the tests cannot run.
- **Open.** `prompts/plan.md:18`: the agent-guide line goes in with a placeholder path that cannot run.
- **Open.** `FORMAT.md:17`: FORMAT.md does not say that `file` in the done, checklists and whereWeAre settings is the role name, `backlog` or `playbook`, not a path.
- **Open.** `.claude-plugin/marketplace.json:34`, at the repository's root: the marketplace entry still lists only map, check, init and the short view.

## Records (HK-066)

- **Partly fixed** (ee65dff, 302b6cd). `FORMAT.md:46, :48, :53, :56`: line 48 on skipped tables was made truer, though the second check found it still says every cut warns where four kinds of section are exempt; line 46 on fences says the code's fence warning since the second round; lines 53 and 56 still say less than the code on first-row lookups and the where-we-are date.
- **Open.** `DESIGN.md:620, :650-653; hooks/register.tsx:155; hooks/adapter.ts:95`: DESIGN section 10 item 13 and two code comments still describe the rules from before HK-030 and HK-033, including that the page's direct write moved to the top of the git tree, which the owner has yet to be told.
- **Partly fixed** (55a8c67, c739375, and research/README.md in the commit that adds this file). `README.md:3, :5, :77, :87; DESIGN.md:197`: the words the Phase 2 edits left stale in the README, research/README.md and DESIGN 3.4's list of the Node command's subcommands were replaced, but README line 5's new words, that under plan the agent commits only the steps you approve, did not hold in the second check (its finding 2, where only the procedure's words were changed).
- **Open.** `research/phase-2-results.md:21, :40, :113; BACKLOG.md:76`: a few small claims in the results and in HK-001 say more than the raw reports do.
- **Open.** `BACKLOG.md:13, :24, :25`: HK-052 is an open row that is mostly done, though a failed publish on a second run is still not driven by a test, and HK-051 and HK-003 say stale things.
- **Open.** `BACKLOG.md:27, :29`: HK-054 says the plan's five commits are in the raw notes though only their hashes are, and HK-056 can read as if the owner had decided.
- **Fixed** (by this file). `BACKLOG.md`: the deferred minors lived only in a ledger in the session's scratch folder, with no row.

## Tests that would not catch a break (HK-067)

The code is right at the checked tip in each of these.

- **Open.** `tests/plugin.test.ts:41, :57, :63`: the plugin tests swap the survey's prompts for stand-ins and answer its git and file reads, so a break there can leave the suite green while the live survey lies or fails.
- **Partly fixed** (d574c1d). `hooks/core/survey.ts:92; hooks/core/privacy.ts:7, :9; hooks/core/index.ts:31-32`: a test now pins where a hit is located, in a row and in where-we-are, but none fails if the survey's guide-line mask goes, and most letters of the GitHub and Slack token prefixes are not tried.
- **Partly fixed** (df828ec). `tests/plugin.test.ts:70, :75; tests/brief.test.ts:33-38`: the Node command's behind-remote count and branch line now run on a real clone and fetch, but the plugin's are tested only with values typed in.
- **Open.** `hooks/core/parse.ts:92; hooks/core/lanes.ts:52`: a row with no ID, or a standing duty among a station's stops, can enter the counts with the suites green.
- **Open.** `hooks/core/survey.ts:25, :26, :63`: each of the survey's classification patterns is pinned on one member only.
- **Open.** `hooks/core/survey.ts:75, :76, :82`: self-references, longer names and the escaping of names in the reference counts are not pinned.
- **Open.** `hooks/core/survey.ts:110, :149`: no test asserts formatInventory's header counts or the count in its cut note.
- **Open.** `hooks/register.tsx:128, :63, :77, :119, :170, :175`: no test reaches several guards in the plugin's commands, among them the usage line, without which a mistyped command would write and publish.
- **Open.** `hooks/core/settings.ts:22; hooks/core/parse.ts:78`: edges of the settings and of the dropped-row rules are not pinned, a mainBranch that is not a string among them.
- **Open.** `node-tests/cli.spec.ts:81, :110`: two node specs match git's English wording and fail under a translated git.

## Deferred in the build's ledger (HK-068)

The minors that the reviews of Phase 2's ten build tasks deferred, apart from those the check's list above or
a backlog row already holds (HK-054, HK-058). The places are as the reviews gave them; where a review gave no
line, the line is the one at this file's commit.

- **Open.** `hooks/core/settings.ts:17` and tests: a literal invisible byte order mark sits in the source, where an escape would show it.
- **Open.** `hooks/core/index.ts` (HK-020): no test drives the head commit's date into the parse; only the parse with that date is tested.
- **Open.** `hooks/core/lanes.ts` (HK-016): computeLanes' maps are tested only through the stop order and the facts.
- **Fixed** (ee65dff). `tests/parse.test.ts` (HK-006): the where-we-are heading now has its test.
- **A note.** `hooks/core/parse.ts` (HK-018): the mistyped-header warning goes past the brief's two named cases, as the row asked.
- **Open.** `tests/history.test.ts` (HK-015): the test pins git's arguments, not a merge commit's side branch, since the tests run no git.
- **Open.** `hooks/core/findings.ts:21`: an arrow function's parameter `w` shadows the warning helper `w`.
- **A note.** HK-009 adds the lane but no finding, as its row's smallest fix allows.
- **Open.** `tests/history.test.ts` (HK-026): only git's argument list is checked, with no real file whose name holds a wildcard.
- **Open.** `hooks/register.tsx:17` (HK-033): the Artifact tool's real not-found and deleted texts are still unverified, under a shortcut comment.
- **Open.** `tests/plugin.test.ts` (the cached view): the cached-view test was loosened from exactly one rev-parse to rev-parse calls only and no history walk.
- **A note.** Phase 2's Task 4 Done rows each carry their commit.
- **Open.** `tests/brief.test.ts` (HK-038, HK-037): the line-length test does not pin the 120-character cut, and the HK-037 node spec was never seen failing before its fix.
- **A note.** `hooks/core/index.ts:47-48`: the page-size check counts characters as bytes, which holds because the page writes every non-ASCII character as an escape, as the code's comments say, and `tests/page.test.ts` pins the template and the built page as ASCII.
- **A note.** `DESIGN.md` 3.4: the masking bullet's "decided 2026-11-03; section 9" holds, since section 9's row of that day on a privacy hit in a commit subject records it.
- **A note.** Phase 2's Task 5 fix round took its gate result from its report; every later task's gate has passed since.
- **Fixed** (a8d709a, then c484ff2 and f31618d). `hooks/adapter.ts` (readTracked): the plugin tests reach it through `/housekeeping survey`, now with a Read deny and a failed listing.
- **Open.** `hooks/core/survey.ts:23`: the name pattern takes words such as "spending" and "openai" in a prose file's name as tracker words.
- **Open.** `cli.ts:54`: a `--repo` folder that does not exist prints Node's spawn error as what git said.
- **A note.** A local brief for Phase 2's Task 6 still gives the old size limit and "top two"; it is not in the repository.
- **Open.** `hooks/core/survey.ts:224-229`: guide lines are still cut in path order when the candidates and the capped references leave too little room.
- **Open.** `hooks/core/survey.ts:195-198`: the candidates are listed without a cap in the text.
- **Fixed** (401cfbc). `hooks/register.tsx` (survey's reply): the suffix after the reply's count is now the round's wording of what was measured.
- **A note.** `prompts/plan.md` adds a "How this file is kept" step and a closing line on the branch beyond its brief; both come from the design.
- **Open.** `hooks/register.tsx:138, :147`: plan finds the repository's top twice, once itself and once through the load, one extra git call.
- **Open.** `research/phase-2-results.md` (test repository A): the "no link points at a moved item" pass rests on a pattern the agent wrote over git grep, and the stand-in for A's docs-scanning test reads word edges differently on non-ASCII text; the raw report says both.
- **A note.** Test repository A's survey was not blind, which the committed results say, with the inventory-only figure as the fair one.
- **Fixed** (62e4e85). `research/phase-2-results.md` (test repository B): the closed and open split is now called a reading of status words with five hand overrides, the run is said not to be blind, the privacy pass is said to rest partly on what the index copies, and the shared path's milestones were checked again on the rebuilt page.
- **Fixed** (401cfbc, 761fda6). `hooks/core/survey.ts` (PROSE): a tracker kept as YAML, JSON or CSV no longer scores on its name, but it is now a suspect, and the person can name it with `--tracker`.
- **Fixed** (eb3723c). `BACKLOG.md` (HK-001): its Landed cell names its commits.
- **A note.** FORMAT.md's skipSections line was edited in Phase 2's Task 10 outside that brief's file list, for a gap the dry run found.
- **A note.** plans/2026-11-04-phase-2.md still states Task 6's first name and status-word rules, kept as the record of what was planned; phase-2-results.md records the change.
