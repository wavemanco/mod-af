# The second check: the parked minors

The adversarial check of the first Phase 2 fix round (2026-11-05, at the tip now named ade02fa) confirmed 18
important findings and parked 82 minors. The owner chose a second fix round for all 18 and for the two minors
that share finding 13's cause (DESIGN.md section 9, 2026-11-12; plans/2026-11-12-phase-2-fixes-2.md). This
file holds the 82, in described terms and grouped as the check grouped them, then the findings the round
stopped. The check's full report stays in the local raw notes.

How to read a line:
- **The place** is the file and line the check gave, at the tip it checked. Paths are under `housekeeping/`
  unless they say otherwise. The second round moved some of the lines.
- **Open** means nothing settled it. **Partly fixed** and **Fixed** name the commit. "Disclosed" means the
  check already knew the class, and this shows more harm. Votes are given only where they split.
- Each group's open minors are one row in [`../BACKLOG.md`](../BACKLOG.md), named at the group's heading.

Of the 82, 73 are open, 1 is partly fixed and 8 are fixed: three by the second round's code and tests, four
by its records pass, and one by the history rewrite of 2026-11-11.

## Flagged for the owner (HK-069)

- **Open.** `hooks/register.tsx:91-94`: on an empty store, a prompt sent at launch gets "the short view is being built" for the whole conversation and is pointed at a command the agent cannot run, a cost of the first round's design for finding 20 that nobody weighed (votes tied 3 to 3).
- **Fixed** (the history rewrite of 2026-11-11). `plans/2026-11-04-phase-2.md:55, :320, :322`: test repository B's pinned package manager and its exact install and test commands stayed in the branch's history, though DESIGN said such words had become descriptions.
- **Open.** `prompts/plan.md:15`: moving outside work to the playbook can silently lift a release gate (votes important, minor, refuted minor).

## Privacy (HK-070)

- **Open.** `hooks/core/privacy.ts:4`: an address's top-level part takes the letters after it, so a package at a `.x` version, or an allowed address followed directly by CJK, falsely stops the page (votes important, minor, minor).
- **Open.** `hooks/core/brief.ts:73`: a BEGIN line with no END in a name wipes the rest of the short view; disclosed.
- **Open.** `hooks/register.tsx:48; hooks/core/brief.ts:42`: the status line's milestone and check's "On branch" line print unmasked.
- **Open.** `hooks/core/index.ts:30`: a row ID in an old commit that holds an address or a key stops the page for good.
- **Open.** `hooks/core/index.ts:41`: the privacy error names the wrong file for a row moved to Done.
- **Open.** `hooks/core/template.ts:310`: markup inside an address or a key gets it past the scan, and the screen shows it whole.
- **Open.** `hooks/core/privacy.ts:4`: an address whose domain holds a combining mark, and a JWT with no signature, pass; DESIGN 3.4 says so since the second round.
- **Open.** `hooks/core/privacy.ts:8`: the newer key shapes falsely stop the page on vendor placeholders and long all-caps words; disclosed.
- **Open.** `hooks/core/survey.ts:200`: the Suspects section prints more file names unmasked; disclosed.
- **Open.** `hooks/register.tsx:77, :93`: a stored view skips the newer mask, so after an update the older version's view reaches the agent unmasked; disclosed.

## Parsing and counts (HK-071)

- **Open.** `hooks/core/parse.ts:84`: a row table directly under an exact where-we-are or checklist heading vanishes with no warning.
- **Open.** `hooks/core/markdown.ts:75`: the stray-pipe warning fires on an indented table in a list and in an HTML comment, with a message that misleads.
- **Open.** `FORMAT.md:48`: it says every cut table warns, but four kinds of section are exempt, and a cut not-doing table is lost silently.
- **Open.** `hooks/core/brief.ts:26`: a Last done written in another shape gives no warning, so its duty is never due.
- **Open.** `hooks/core/brief.ts:17`: a duty period so long that its due day falls past the range of a date throws.
- **Open.** `hooks/core/page.ts:39`: an impossible later Last done silences a duty that is due.
- **Open.** `hooks/core/parse.ts:155`: a Done ID cell that mentions an open row reports that row as open and in Done; disclosed.
- **Open.** `cli.ts:130; hooks/register.tsx:196-197`: map's reply prints a cut count with no word on what was cut.

## The survey (HK-072)

- **Open.** `hooks/core/survey.ts:118`: a bare name is not marked ambiguous when the other file of that name is outside the top 15.
- **Open.** `hooks/adapter.ts:129`: a bare repository says nothing to move and exits 0.
- **Open.** `hooks/core/survey.ts:194; DESIGN.md:340; prompts/survey.md:11`: Not measured's fixed line is false, since data and code files do score (survey, suspects, records).
- **Open.** `hooks/core/survey.ts:28`: boxes written with more than one space are not counted.
- **Open.** `hooks/register.tsx:152; hooks/core/survey.ts:187`: the reply leaves out the denied files, and its "skipped" undercounts; since the second round it does name the count of files outside a subfolder session's folder, and no other denied files.
- **Open.** `hooks/adapter.ts:139`: an explicit ask rule is passed silently (votes important, refuted minor, minor); disclosed.
- **Open.** `hooks/adapter.ts:139`: another plugin's allow in the permission check lifts a real deny rule (votes important, minor, refuted minor).
- **Open.** `hooks/core/survey.ts:167`: with Read left out by `--tools`, Not measured says "denied by Read rules" where no rule exists; since the second round the survey then also sends the re-run to the slash route and drops the `--json` notes, which fails closed.
- **Open.** `hooks/core/survey.ts:200`: the cap of 15 cuts by path order, so real trackers can fall into "and N more".
- **Open.** `hooks/core/survey.ts:87`: configuration files that are plainly not trackers are put to the person.
- **Open.** `hooks/core/survey.ts:42`: a suspect's reason is not always true: a `#` comment is called a heading, and XXX a TODO.
- **Open.** `hooks/core/survey.ts:41`: a tracker kept as `.jsonl`, `.tsv`, `.json5` or `.xml` gets no suspect.
- **Open.** `hooks/core/survey.ts:191`: "No file reached" is false after `--not-tracker` removes the only candidate.
- **Open.** `hooks/core/survey.ts:30`: a file that only names TODO.md becomes a suspect.
- **Open.** `hooks/core/survey.ts:195`: from about 185 to 400 candidates, the Suspects section is cut out of the text; disclosed.
- **Open.** `hooks/adapter.ts:139`: the permission check on each file makes the slash survey 2 to about 3.5 times slower; disclosed (suspects, together).
- **Open.** `hooks/register.tsx:164`: a single-quoted path, or `--tracker` with no path, gets the bare usage line at exit 0.

## Procedures (HK-073)

- **Open.** `README.md:31`: under the README's `claude -p` route, with the same flags, the agent can neither read FORMAT.md nor apply the plan (suspects, procedures).
- **Open.** `prompts/survey.md:30`: a guide-file rule not to ask makes the agent answer the suspects itself.
- **Open.** `prompts/plan.md:7`: a plan can present the agent's readings as the person's answers.
- **Open.** `prompts/plan.md:7`: agents write a settings copy before approval, to read the branch's findings.
- **Open.** `FORMAT.md:17`: its silence on the value shapes a Done reader takes cost a fix commit in 4 of 11 applied plans; disclosed.
- **Fixed** (712e614). `prompts/plan.md:23`: finding 9's approval rule could flip in a summary after a compaction (votes important, minor, refuted minor); the compaction hook now keeps the rule and has the agent re-read the procedure, and what a real summary keeps is the owner's live check (HK-080).
- **Fixed** (712e614). `prompts/plan.md:18`: after a compaction the apply rules thinned out and the guide line went missing with check silent; the same hook has the agent re-read the whole procedure before its next step.

## The plugin (HK-074)

- **Open.** `hooks/register.tsx:80, :94`: a build that cannot succeed says "being built" in every session (plugin-live, git-node, together).
- **Open.** `hooks/register.tsx:75`: with HEAD unborn and main present, prompt.context still waits for the walk, 37 to 75 s at 300 commits (votes important, minor, minor).
- **Open.** `hooks/register.tsx:71`: a rev-parse that times out gives no view and no word.
- **Open.** `hooks/adapter.ts:61; cli.ts:113`: an unborn branch gets no "On branch" line.
- **Open.** `hooks/register.tsx:93`: another repository put in the same folder is served the first one's view.
- **Open.** `hooks/register.tsx:198`: after "ran past the 10 s", the abandoned map still writes its page and would publish it.
- **Open.** `hooks/register.tsx:256`: the reply says "10 s" after minutes of waiting, and the command it prints fails in Git Bash.
- **Open.** `hooks/register.tsx:254`: plan's overrun reply names only the Node survey (votes important, minor, refuted minor).
- **Open.** `hooks/register.tsx:191`: where the reply carries the view, the screen shows it twice; disclosed.
- **Open.** `hooks/register.tsx:148`: plan's findings carry no branch line and no behind line.
- **Open.** `README.md:42`: "check read main" is half true, since the settings are the checkout's.
- **Open.** `hooks/adapter.ts:40`: a second file added late in the history slows the walk by about 35 percent.

## Git (HK-075)

- **Open.** `hooks/core/history.ts:26`: a tree the clone does not hold reads as "not on main" (votes important, minor, minor); since the second round a treeless clone's walk stops first (2d174ee), which was not checked against this case.
- **Open.** `cli.ts:117`: a remote not named origin is never compared (votes minor, refuted minor, minor).
- **Open.** `cli.ts:117; hooks/core/brief.ts:45`: the README's pull-request route prints a false "Local HEAD is N behind" (git-node, procedures, records, tests, together).
- **Open.** `cli.ts:118`: a shallow clone's behind count is wrong after a `--depth` fetch.
- **Open.** `hooks/core/brief.ts:72`: on a shallow clone the short view says 0 warnings where check says 1 (git-node, together).
- **Open.** `hooks/register.tsx:74`: the stored view stays after `git fetch --unshallow`.
- **Open.** `hooks/core/history.ts:7`: a tag with the main branch's name is read silently.
- **Open.** `cli.ts:114`: a detached checkout says "On branch HEAD"; disclosed.
- **Open.** `hooks/core/history.ts:10`: a tip commit that is gone reads as "no branch".
- **Open.** `cli.ts:54, :89`: a `--repo` folder that does not exist reads as "git said ... ENOENT".
- **Open.** `hooks/core/history.ts:13`: a set `i18n.logOutputEncoding` breaks the subjects.
- **Open.** `hooks/core/brief.ts:62, :67`: the short view can say "next next release" and "before no milestone".

## Records

- **Fixed** (e07fc7e). `DESIGN.md:668, :672, :245, :673, :468`: lines the first round added claimed more than happened or than the README says; section 9's rows, 3.4's What passes and section 4 now say what holds.
- **Fixed** (f91e940). `research/phase-2-results.md:99, :110`: two statements that the first round's fixes made false.
- **Fixed** (f91e940). `research/phase-2-check-minors.md:115, :39, :117, :157`: four lines that overstated or misdescribed.
- **Fixed** (f91e940). `BACKLOG.md:33-41`: HK-060 to HK-068 said Filed 2026-11-04, though they were filed 2026-11-05.

## Tests that pin too little (HK-076)

All pass, and the code is right at the checked tip in each.

- **Open.** `hooks/core/findings.ts:88`: a row's first commit is pinned on one row only.
- **Open.** `hooks/adapter.ts:139`: no test pins that a failed permission check counts as a deny, or the absolute path it is given.
- **Open.** `hooks/core/survey.ts:190`: "nothing to move" in the text is not pinned.
- **Open.** `hooks/core/survey.ts:171`: three of Not measured's counts are not pinned.
- **Open.** `hooks/register.tsx:91`: session start's view and a failed rebuild are not pinned.
- **Open.** `hooks/register.tsx:228`: the behind line on a published map is not pinned.
- **Fixed** (8a0dd1f, with 5669ce6). `hooks/core/survey.ts:134`: a path mention's ending is now pinned.
- **Open.** `hooks/core/survey.ts:42`: the newer patterns' other members are not pinned; disclosed.
- **Partly fixed** (dc2c11e, c60545b). `tests/plugin.test.ts:55; prompts/plan.md:23`: plan.md's approval sentence and its guide-line sentence are now pinned in `node-tests/cli.spec.ts`, and survey.md's re-run lines by finding 1's test (f294a1b); the procedures' other sentences are not (procedures, tests).

## Stopped in the second round

- **Open** (HK-079). Finding 8's last step: the git-ignored reference settings copy in `research/raw/` still names its checklists by the start of their headings, since the task that fixed finding 8 could not read the reference repository and housekeeping's notes hold only the starts; `check` with that copy, run where the reference may be read, now names each whole heading in its checklist-heading warning.
- **Open** (HK-080). Finding 13's live check: `/housekeeping plan` in a repository with records, `/compact` before the numbered steps, then "go ahead", to see that the agent still uses the install folder and waits for approval; it needs a live session, which agents on this machine may not start, and the kit tests cover only what the hook hands the summarizer.
