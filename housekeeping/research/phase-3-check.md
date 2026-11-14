# The narrow check of Phase 3

The plan's "How the build runs" set a narrow check over the whole Phase 3 branch after Task 5. Its findings are
filed here, and the owner decides any fix round. The one exception is a secret, an address or a denied file reaching
a page or the agent, which the controller fixes at once.

The check ran at the tip 6124015 over `b14fdcf..6124015`. It had four lenses, each in its own clone: privacy and the
shell; the automatic parts; `owed` and the audit; and the records. One skeptic voted on each finding rated above
minor. It used the 12 agents its script allowed, ran for about 32 minutes, and started no live session. No lens could
see the engine itself: the kit's fakes stand in for it, and `research/live-checks.md` holds what the owner checks
live. The full results stay in the local raw notes. The before and after lists of untracked files in the
checkouts showed nothing new but the build ledger.

## What held

Each lens tried these itself, beyond the tests.

**Privacy.**
- Keys of every shape the plugin knows, and addresses, are masked in commit subjects in `owed`'s listing.
- Commit bodies and their trailers never reach the listing.

**Denied paths.**
- A denied path is counted, never named or read: renamed, on both sides of a rename, in a merge, or named by a
  Trigger.
- No denied content reaches the hits: `owed`'s and the audit's one-sided pathspecs do not pair a rename from a denied
  path.

**Shell marks.** Every shell-unsafe name the lens tried got its mark.

**The after-commit hook.**
- The shell hook runs the command once on every path, a throw before or after it included.
- It matches the word `git` as the plan says.
- A backgrounded command is not read.
- A subagent gets no line.
- Three git commands during one rebuild make one walk.

**With `automatic` off,** nothing runs and the card and the compaction paragraph stay.

**The README's per-part costs** match the code.

**`owed` against FORMAT.**
- The code-name rule matches FORMAT's table.
- Triggers fire end to end on added and removed lines, on paths with spaces and on both sides of a rename.
- Gone, settled and taken rows are listed.
- The last line is the head.

**The reference repository.** `check` gives byte-identical output at the base and the tip, and its checkout was left
as it was.

**The prompts and the backlog.**
- `prompts/survey.md`, `prompts/plan.md` and the agent-guide line are unchanged since b14fdcf.
- Every commit the new Done rows name is on the branch, and the new IDs were free.

## Fixed at once, under the plan's rule

In d8cacbf, with tests:

1. **A newline in a changed path forged listing lines.** The lines could show a denied path as an allowed one of a
   real commit, and the procedure then reads such a path with `git show`.
   - Found by the privacy lens and held by its skeptic.
   - `owed` now writes a control character or a line or paragraph separator, in a path or a subject, as `\uXXXX`.
     Each entry stays on its own line, with its mark.
2. **The audit's check after applying ran `owed --base main`.** In a repository whose main branch has another name,
   the check failed and the procedure then deleted the approved branch. With a stale local `main`, it read and named
   paths beyond the audit's own commits.
   - Found by two lenses and held by both skeptics.
   - It is now `--base <main>` (in `prompts/audit.md`, its pinned spec and the plan).
3. **A commit subject that names a denied path showed it,** under a header saying such paths are never named.
   - Held by its skeptic, rated minor.
   - A denied path named whole in a subject is now hidden; a longer name that holds it is not. A subject that named
     only its file name still showed it; the owner's round hid that too (item 19, 7e13c72).
4. **The audit's first line, and `owed`'s and the audit's stops, quoted the `mainBranch` setting and the refs
   unmasked.** These are now masked like the listing.

## Records corrected, with no change to behaviour

In 9effe92's DESIGN commit and the commit that adds this file:
- DESIGN 3.10 now says what Phase 0 found: a throwaway plugin with one dependency. Housekeeping with its three
  dependencies has not been tried.
- DESIGN 7 says the audit's bar was met for `prompts/audit.md` as it stood at 9608adc. Three later changes were not
  run again.
- DESIGN 3.9 and `owed.ts` no longer call `owed` a pure function of the base and the head: it also reads main's tip.
- The README now says the automatic hooks run `git rev-parse`, and write their debug line, in any repository, and the
  rest only where `.housekeeping.json` exists.
- The README said the suggestion's "once per HEAD" kept only the last HEAD (since changed: the latest 32 are kept,
  item 11, 2d80353).
- `research/live-checks.md`:
  - "Before the sitting" now builds a milestone and a survey suspect, so checks 4 and 12 can be done.
  - Check 1 no longer looks for an install folder in the reply.
  - Check 6 accepts the stored-view label.
  - Check 9 says what its pass does not show.
  - Check 10 tells "needs a restart" from "never reaches the plugin".
  - A new check 16 covers where the stale-map line and the debug lines go.
  - A missing debug line can now mean a failure.
- HK-094's and HK-095's Triggers no longer name `DESIGN.md`, which the code-name rule read as a file to watch.
- The audit fixture's comment said B-1's code retried twice, so it acted as a seventh decoy (since fixed: item 18,
  a542563).

## The owner's fix round (2026-11-13)

The owner, 2026-11-13: "let's proceed with a fix round on the 19 filed findings (and any other minor or otherwise
findings you might have found but not surfaced within the 19)." All 19 are fixed, each with a test seen failing first:
1, 2, 3, 9, 10 and 11 in 2d80353; 4, 5, 12 to 17 and 19 in 7e13c72; 6, 7, 8 and 18 in a542563. The gate after them: 356
kit tests and 54 Node tests pass, and validate passes. Ranked as filed; two were held by their skeptic, and the rest
were rated minor and not put to one.

1. **`automatic` turns off only for the exact text `off`.** "Off", " off", "false" and "no" leave every automatic part
   on, with no notice.
   - Held, rated minor by the skeptic and important by the lens.
   - Fix: compare after trimming and lowering the case.
2. **After a rebuild that failed, or whose store write was refused, every later git command starts a full history
   walk again and adds its line again.** The one-minute retry guard of the prompt path is skipped.
   - Held, minor.
   - Fix: honour the failure record in the after-commit path.
3. **While one rebuild runs, each git command's result gets the after-commit line,** so one change of the records
   gives several lines. Fix: add it only from the call that starts the rebuild.
4. **With the commit log cut short, "Last commit read" still names the head,** so the audit would move Last done past
   commits it never read. Fix: end the listing with the last commit read in full, and keep Last done where it is
   when the listing says the log was cut.
5. **`/housekeeping audit` with nothing after its start** (just after init, say) hands a listing that advises
   `--base`, which the audit does not take, and has no "Last commit read". Found by two lenses. Fix: a reply of its
   own, with no procedure handed.
6. **The audit's check for uncommitted record edits before approval, `git status`, can rewrite `.git/index`.** Fix:
   `git --no-optional-locks status`.
7. **The audit's start command is written unquoted:** Bash refuses it and PowerShell tries to run `literal`. Fix:
   quote the pathspec, and move the quoting sentence above the first command.
8. **The audit puts the settings' names into commands with no quoting rule.** Fix: quote them, or put a name with
   other characters in no command, as the history messages do.
9. **The debug lines miss two cases:** a firing whose work throws writes none, and a settings file that does not parse
   is logged as "no settings file". Found by two lenses. Fix: log `failed: <error name>`, masked, and tell the two
   settings cases apart.
10. **A `/loose-ends` suggestion the prompt box did not show is still marked as made for that HEAD.** Fix: store the
    HEAD only when the engine says it was shown.
11. **"Once per HEAD" keeps only the last HEAD,** and two worktrees of one repository share the key. The records now
    say so. Fix, if wanted: key by worktree too.
12. **On Windows, a changed path holding a backslash is never scanned for code names,** and is not counted as not
    read. Fix: count it as not read.
13. **A body whose last line is "Closes: B-1" has it dropped as a trailer,** where git sees no trailer. Disclosed in
    part before. Fix: drop only git's trailer block.
14. **An unterminated private-key marker in one subject masks the rest of the listing,** "Last commit read"
    included. Disclosed for the short view before. Fix: mask line by line.
15. **A path written in bold, or as a Markdown link, in a Trigger never fires.** Fix: read the link's target and drop
    emphasis, and add both to FORMAT's table.
16. **A note reads "The the changed paths of the range was cut short".** Fix: the template's wording.
17. **With a tag named like the main branch, `owed` and the audit read the tag.** Fix: resolve `refs/heads/<name>`
    first.
18. **The audit fixture's B-1 tries three times in all, not one try and three retries.** Fix: `attempt > RETRIES`, so
    it is a real closing in a later acceptance run.
19. **The shortcut of fix 3 at once:** a subject that names a denied path's file name alone still shows it. Fix, if
    wanted: hide the last segment too.

## Beyond the 19, and what became of each

Read from the lenses' notes of what held and what they could not run, the builders' concerns and the controller's own
reading:
- **The refuted case below,** a co-author's name in the subject's own paragraph: fixed in 7e13c72 all the same, since
  the listing promises no author. A `-by:` trailer written there is cut off with its name.
- **A SHA-256 repository's audit from its root** used the SHA-1 empty tree and failed: fixed in 7e13c72; the procedure
  names both (a542563).
- **The audit's commands in a partial clone** would fetch what the clone lacks, against "no fetches": the procedure
  now stops there (a542563).
- **README line 5 said "your permissions apply" to every write.** A plugin's own tool call asks nothing, so a write
  `init` makes goes ahead unless a rule denies it; the README now says so, and that the agent's own tools ask as the
  settings say.
- **The README said installing housekeeping from the marketplace installs its three dependencies,** which Phase 0
  showed only for a throwaway plugin with one: the README says so, and live check 17 tries housekeeping itself.
- **DESIGN 9's row of 2026-11-03 on filing** still read as if the catch-up were coming: it now points at call 4 and
  CALLS.md.
- **map, check, the short view and the hooks read a tag named like the main branch** too, as `owed` and the audit did
  before 7e13c72: filed as HK-103, beyond this round's findings.
- **Two rebuilds that land out of order could leave the status line at the older one.** The hooks lens could not
  order two walks in the kit, so it is unconfirmed: filed as HK-104.
- **What only a live session shows,** from the lenses' notes: whether the person's path-scoped permission rules
  reach the audit's worktree under the system temp folder, how the engine's Read rules match a path holding a newline,
  and PowerShell's quoting of the audit's commands. Since the re-check's round: the first is a step of live check
  15; the second is HK-106; the third needs no live session, since the audit stops on a name PowerShell could read
  as code (e7a1638).

## Refuted

**A trailer in the subject's own paragraph shows the co-author's name.** With no blank line, git's subject is the
whole first paragraph. The skeptic found it reproduces, but git does not count it as a trailer, the plan and design
define it this way, and the harm is small; the address in it is masked. Parked.

## The narrow re-check of the round (2026-11-13)

The owner chose "Narrow re-check". It ran at 14df3ff over `6124015..14df3ff`: the four fixes made at once, the records,
CALLS.md and the owner's round. Three lenses each worked in their own clone (`owed` and its privacy, the automatic
parts, the audit procedure and the records), and one skeptic voted on each serious finding. It used 7 agents of the 9
its script allowed, ran for about 31 minutes, and started no live session. The before and after lists of untracked
files showed nothing new. It found 25 findings. Of the four put to a skeptic, three held and one was refuted.

The owner chose "Yes, all 25" (2026-11-13). All 25 are fixed, the refuted one included, each code finding with a test
seen failing first: the critical one, the procedure's and the settings' in e7a1638; `owed`'s in 16f68c1; the
automatic parts' in 022634d; the records in the commit after it. The gate after them: 365 kit tests and 55 Node tests
pass, and validate passes. As filed:

**Held by its skeptic:**
1. **Critical: in Windows PowerShell, a curly single quote ends a single-quoted string.** The quoting rule in
   `prompts/audit.md` keeps out of commands only a name holding a straight quote. So a `mainBranch` such as
   `main’;<command>;#`, which git accepts as a branch name, runs `<command>` when the agent follows the procedure in
   PowerShell. The skeptic ran it on this machine, and the controller confirmed the quote's effect with a harmless echo.
   Smallest fix: keep any settings name that is not plain (letters, digits, space, `.`, `_`, `/`, `-`, as SHELL_SAFE)
   out of every command, say so and stop; pin it in the spec.
2. **Three of the procedure's commands still hold `<main>` unquoted:** the Node `owed`, the `git worktree add` that
   makes the audit branch, and the check after applying. The rule says "as the commands below do". Rated minor; the
   same fix as 1 covers it, with the rest of the commands quoted and the spec checking each.
3. **`bare()` cuts any `<word>-by: ` from a subject.** "Refactor export, drive-by: fixes B-005" no longer names B-005,
   which it did at 6124015, and "stand-by: mode" cuts a subject short. Rated minor. Smallest fix: cut only a trailer
   key followed by a name and an address, and match IDs on the whole subject.

**Refuted:** with a tag named like the main branch, `owed --base <main>` reads the tag. The code does, but git refuses
the procedure's own `git worktree add` on the ambiguous name before the check is reached, and an explicit base read the
tag at 6124015 too.

**Minor, not put to a skeptic:**
- `owed`:
  - `untrailed()` is narrower than git's trailer rule: a CRLF body, a Signed-off-by paragraph with prose, and a URL
    line let trailers reach matching that 6124015 dropped.
  - The hiding misses `./secret.txt` and another case of the name, eats ordinary words where a denied file's name is
    one (`a`, `token`, `README`), and can rewrite its own replacement text.
  - A newline in the `mainBranch` setting still forges a line through `owed`'s note.
  - `bare()`'s pattern is slow on a long run of spaces, and leaves a name after a `-by:` with no space, or a `Cc:`.
- The automatic parts:
  - A rebuild that a prompt retries after a failure never refreshes the status line.
  - The after-commit debug line says "rebuilding" when the retry gate starts none.
  - The record of lines already said outlives `/clear`.
  - The README does not say that any other `automatic` text reads as on.
- The audit procedure:
  - Its commands read a tag named like the main branch, where the plugin's reader reads `refs/heads`.
  - With the commits cut short, Proposing still writes the duty row's Last done.
- FORMAT says bold is dropped around a Trigger word, but `__docs/a.md__` still never fires.
- The records:
  - HK-102 and this file name 9effe92 for the four fixes made at once; they are in d8cacbf (9effe92 is the DESIGN
    commit after it).
  - "Records corrected" still says in the present that the README keeps only the last HEAD and that B-1 acts as a
    decoy.
  - DESIGN 7 counts three later changes to the procedure since the acceptance run; there are four, and the fixture
    changed too.
  - DESIGN 9's row of 2026-11-13 sits after a blank line, outside the table.
  - CALLS.md row 1 still says the same commits always give the same list, which DESIGN 3.9 no longer says (main's tip
    counts too).
  - Three of CALLS.md's "Revisit if" cells name no step that can be seen to happen.
  - This file sends three live-only items to live check 15, which has no step for them.
  - Live check 7 does not explain the new "not shown" debug line.

They are HK-105.
