# jargone: calibration (design note, 2026-11-10)

A design discussion with the maintainer about jargone's next version. Nothing here is built.
Each point is marked:
- **Decided**: the maintainer said so;
- **Proposed**: Claude suggested it, and the maintainer has not confirmed it yet.

Quotations from the maintainer correct typing slips only. The first version of this note was checked
against the discussion and the repository by two independent reviewers. Their findings and what
changed are at the end.

## Where this comes from

jargone was compared with a one-line instruction, under a rule fixed before any results
([`research/comparison-plan.md`](./research/comparison-plan.md)). The figures below are from the
everyday run's report, which also holds the first run's
([`research/comparison-everyday-results.md`](./research/comparison-everyday-results.md)). In the
plan's rule, the model measures are one part and the maintainer's ratings another; when the two
disagree, the ratings decide.

- **Software work** (the first run): session mode had 23.8% fewer unknown terms than jargone's
  standing instruction alone (pooled). The rule needed a third fewer. It also had more accuracy
  errors (85 against 74). It failed on the model measures.
- **Everyday replies:** session mode had 62.7% fewer unknown terms (pooled), and all three model
  measures held. But the judge that counted unknown terms worked almost the same way as session
  mode's own check, so the measure partly graded itself.
- **Everyday documents,** compared on the three documents every condition rewrote: `/jargone` had
  28.7% fewer unknown terms (pooled) than the one-shot rewrite under jargone's standing instruction.
  The rule needed a third fewer, so it failed on the model measures. Against the one-shot that also
  added Karpathy's line, `/jargone` had more unknown terms (5.1 against 4.0 per 1,000 words). This
  uses the like-for-like reading, which the report leaves for the maintainer to confirm. Read over
  each condition's own rewrites instead, every part of the rule holds.
- **The maintainer's ratings were never completed.** Three picks were saved on the blind-pairs page:
  pair 1, B; pair 12, A; pair 13, B. All three are reply pairs. The keys to all 20 pairs were lost
  with the working machine on 2026-11-10. The five document pairs could still be matched from clues
  in the texts (links and lengths the report describes); the 15 reply pairs cannot. So the human
  part of the rule was never scored.
- **The maintainer's reading of the pairs:** "I understand both quite fine … there isn't a huge
  difference. That itself maybe a tell." And on the question: "my answer to most questions is I
  understand both of them".

The maintainer's example from pair 1: text A kept the term "seam" and explained it; text B explained
the idea without the word. The maintainer: "A user who wants to understand the concept and know the
term too might choose A while someone just focused on getting the work done by understanding it in
the moment would choose B. My guess is that most folks would be on the A side of things." The
maintainer's own saved pick on that pair is B. That pick answered "Which did you understand
better?", so it does not show which text the maintainer would rather receive.

## Decided

1. **Ship jargone's standing instruction** as a universal instruction. In Claude Code it lives in
   `~/.claude/CLAUDE.md` or an output style; in Claude chat, in the profile or project instructions,
   or a style (the comparison plan names these places).
2. **Ship the plugin too.** The direction is the maintainer's question: "What if the plugin adapts to
   user's style. Like calibrating a compass?"
3. **What it adapts to is a question for the person:** how things are explained to them, their
   writing voice, or both. (The maintainer, on that question: "this itself is a calibration question
   to ask the user.")
4. **"Shorter or complete?" is an option for the person,** with a clear caveat: shorter replies may
   leave out an explanation they need.
5. **The blind-pair question changes** from "Which did you understand better?" to "Which would you
   rather receive?". The maintainer: "It reframes the question and makes it more usable."
6. **How it is tested is agreed before building.** The measures: a check-in now and then, "Was this
   pitched right: too basic, about right, or too technical?", and whether "what does X mean?"
   questions drop over a few weeks. The bar: better pitched for the person than the instruction
   alone. (The maintainer endorsed this passage: "this and also the way you tweaked the current
   question".)
7. **A short start, then questions as they come up.** These are the maintainer's words. They answered
   Claude's leaning: a short start with the who-it-is-for question and the length question, and the
   rest as they come up. Claude reads the reply as adopting that leaning; the maintainer did not
   name the questions.
8. **Changes to the card are proposed to the person,** never made silently, and not so often that
   they irritate.
9. **The short start asks each person how often they may be asked.** The person can change that
   answer later with a slash command.
10. **The command is something like `/jargone:settings`** (the maintainer's suggested name).
11. **A reset keeps the words the person has learned.** How a person changes or drops learned words
    is deferred: [`BACKLOG.md`](./BACKLOG.md), JAR-001.
12. **Research data lives on the lab branch** `claude/jargone-lab`, which is public with the
    maintainer's agreement. The root `CLAUDE.md` on `main` sets this for every plugin, along with
    saving work to GitHub as you go. The blind-pairs page stays where it is, on claude.ai, by the
    maintainer's choice; it is not copied to the branch.

## Proposed, not yet confirmed

**Claude's framing of the idea.** A fixed instruction is pitched at an average reader, and on average
it works. What is left is the particular reader: what they already know, and whether they want a
term explained or avoided. A plugin can ask and remember; an instruction cannot. So the plugin's job
would change from checking every reply to learning its reader.

**Claude's reading of the compass image.** A ship's compass is thrown off by the ship's own iron. You
sail a few known headings, note the error at each, and write a small "deviation card" to correct by,
then redo it when the ship changes. Here the standing instruction is the compass, the person is the
error, and the card is a short profile of them. The error also changes with the heading, as a
person's knowledge changes with the topic.

**The general rule behind decided items 3 and 4.** Wherever the plugin would make a judgment call
about the person, it asks them instead, states the trade-off, and uses a default only if they skip
the question.

**Every calibration question asks about preference,** and is shown as a pair of texts where it can
be, since people answer a pair more reliably than an abstract question.

**How it learns from the conversation:** words the person uses are proposed as known. "What does X
mean?" proposes X as new to them. "Too long", "just tell me" or "you don't need to explain that" are
style readings. Each becomes a proposed card change, never a silent one (decided item 8).

**The card:**
- **One card per person,** with topics as sections inside. Style choices are written once. Knowledge
  is recorded by topic ("know well: plugins, git"; "new to me: tax law"), plus a few words ("learned:
  seam"). After a while a learned word folds into its topic, so the card stays short.
- **Separate topic cards would drift:** they would repeat the style lines, and the copies would come
  to disagree.
- **The whole card goes to the model each session,** and the model uses the section that fits, so
  no step has to detect the topic.
- **Each audience gets its own card** for documents written for other people (for example "my
  product managers").
- **An example card:**

  ```
  Adapts: how things are explained to me
  Terms: keep the term, explain it the first time
  Length: complete (explain new terms, even if longer)
  Asks: at most once a week
  Know well: plugins, hooks, git
  New to me: tax, law
  Learned: seam (2026-11-10)
  ```

**Where cards are saved:**
- **In a folder in the person's home directory,** outside every project: `~/.claude/jargone/me.md`
  for the person's card and `~/.claude/jargone/readers/<name>.md` for audience cards.
- **Not inside the plugin's folder:** an update or reinstall replaces that folder, and an uninstall
  deletes it.
- **Not in plugin state either:** jargone's `$.state` keeps values for one session only
  (`types/index.d.ts`).
- **To check before building:** whether the plugin route offers a data folder that survives
  updates.
- **The plugin never saves a person's card in a repository,** since it is a record of what they do
  not know. An audience card may live in a project if the person chooses. For research, the lab
  branch may hold a person's card only with that person's agreement (its README says so).
- **A card change is written through the normal write path,** so it respects the person's
  permission settings. The person accepts each change, and accepting is when it is written.

**In Claude chat:**
- **There are no plugins.** A Skill runs the short start and suggests card text for the person to
  paste into their profile or project instructions.
- **That makes two copies,** one on the person's computer and one in chat, which can drift. Which
  one is the master is open.

**The short start: three questions.** Questions 1 and 2 are Claude's leaning, which the maintainer's
reply appears to adopt (decided item 7). Question 3 is decided item 9. The wording, choices and
caveats of all three are proposed.
1. **What it adapts to,** with decided item 3's choices: how things are explained to me, my writing
   voice, or both. If my writing voice: who are my usual readers? (Claude's earlier form of this
   question offered "replies to me, documents I write for others, or both". Replies match "how
   things are explained to me"; documents for others match "my writing voice".)
2. **Shorter or complete,** with its caveat.
3. **How often it may ask:**
   - **Choices:** at most once a session, at most once a week, only when asked, or never.
   - **Caveat:** fewer asks means the card learns more slowly.
   - **Scope:** the answer covers every kind of ask: card changes, check-ins, and questions as they
     come up.

**When it asks, within the frequency the person chose:**
- **Never mid-task.**
- **A question that comes up** (for example, the first time it has to choose between keeping a term
  and avoiding it) is asked in one line at the end of the reply it concerns, with that reply in
  front of the person.
- **A check-in** is asked the same way, at the end of a finished reply.
- **Card changes are batched** and proposed at the start of a session: "Since last time: you started
  using *seam* and *idempotent*. Mark them as known? All / pick / not now." Small changes wait until
  there are about three, or a week has passed.
- **At most one ask per session** of any kind.
- **A change the person turns down is not proposed again.**
- The numbers are placeholders.

**`/jargone:settings`:**
- **On its own,** it shows the card: the person's choices first, then what has been learned.
- **`/jargone:settings <line>`** (for example `asks`) asks that one question again, with its choices
  and caveat, rather than taking a typed value.
- **`/jargone:settings reset`** clears the choices and runs the short start again. It keeps the
  learned words and the "know well" topics they fold into (decided item 11). Keeping the "new to
  me" lines too is Claude's extension.
- **It is answered by code, not the model,** so it is instant and costs nothing. To check before
  building: that a command answered by code can show the person choices, and that the command gets
  the `jargone:` name form. Plugin code can ask the person from a tool: `dynamics`' check and render
  tools on `main` put a permission question with `$.ui.ask` (`dynamics/hooks/register.ts`,
  `mayRun`). No command has been shown to do it.

**The commands:**
- `/jargone:settings`, as above.
- `/jargone:check <file>`: 0.1's `/jargone-check`, renamed.
- Session mode's on and off switch (`/jargone-voice` in 0.1) becomes a line in settings.
- 0.1's `/jargone` skill, which rewrites a document for a named reader, is an open question below.

**The default when a question is skipped:** keep the term and explain it the first time. This
follows the maintainer's guess about most people. The maintainer's own pick on the seam pair was the
other text. That pick answered a different question, but it is still a reason to ask rather than
assume.

**No rewrite and no model check after each reply:**
- In the everyday run, the check and rewrite made 49.0% of session mode's cost.
- In use, the person reads both the first reply and the rewrite. Counted that way, session mode had
  19.4% fewer unknown terms than the standing instruction alone, short of a third (a figure worked
  out after the results).

**Documents for other people:** adapting there may mean keeping the author's voice while the text is
simplified, plus remembering what the author says about their audience.

**The blind test, within decided item 6:** after a few weeks, pairs of a calibrated reply and an
instruction-only reply to the same question, with "Which would you rather receive?" and "no
preference" allowed. A tie counts as not preferring the plugin. The pass mark is written down before
the test, as the comparison's rule was.

## Open questions

- If a person wants their writing voice kept, how does keeping it work?
- Which copy of the card is the master: the one in Claude Code or the one in chat?
- What is the pass mark for the blind test, and how long is "a few weeks"?
- Is the command set right?
- Does 0.1's `/jargone` document rewrite stay? It fell short of the rule against a one-shot rewrite
  in both runs: 11.1% and 28.7% fewer unknown terms, where a third was needed. The first run also
  had more accuracy errors (28 against 13).
- Is the like-for-like reading of the everyday documents the right one? The report leaves it for
  the maintainer to confirm.
- Does 0.1's warn-only note after each reply stay? It runs code checks (J01, J03 and J07), not a
  model, and the trial found most of J01's and J07's findings were false alarms.
- Should `jargone/research/` move to the lab branch, as the root `CLAUDE.md` now says research data
  should? It was written before the lab branch existed.
- What carries over from 0.2? On this branch at commit 2251361: the checker (with J03, long
  sentences, and J05, nothing lost) and the curated word lists; 0.2's wiring is marked there as not
  done. A later version of the wiring, which ran a model check after each reply, was finished on the
  working machine but never committed, and was lost with it on 2026-11-10 (as Claude reported to the
  maintainer in the session that day). The proposal above drops the model check and the rewrite
  after each reply.

## Review of this note

Two independent reviewers checked the first version (commit 3146e05). One compared it with the
maintainer's own words in the discussion; the other checked every figure and claim against the
repository. Round 1 found 23 problems: 2 high, 16 medium, 5 low. The main ones:
- **It said no ratings were collected.** Three picks had been saved on the blind-pairs page after
  the last time Claude read it.
- **It filed Claude's words as the maintainer's decisions.** Decided item 3 used Claude's later
  options rather than the ones the maintainer answered. "From a strong reader" was Claude's phrase.
  "The idea" stated a proposal as settled.
- **It left out decisions:** the endorsed measures and bar for testing; that the blind-pairs page
  stays on claude.ai; that the lab branch is public with the maintainer's agreement.
- **Its own sections disagreed.** "One ask per session, at the start" left no room for questions as
  they come up. A reset that keeps learned words did not say it keeps the topic lines they fold
  into. Learning from the conversation read as silent changes. The example card had no line for
  asks.
- **Figures lacked their comparison:** what the documents figure was measured against, and that
  every verdict was on the model measures only.
- **It contradicted the lab branch's README** on whether a person's card may go in a repository.

Round 2 checked only the fixes (commit 60e9233). Of the 23, 20 were fixed and 3 partly. It found 12
new problems: 1 high, 4 medium, 7 low, mostly caused by the fixes themselves. All were addressed in
this version. The main ones:
- **A fix put a false claim in place of a stale one.** The first version cited the superseded
  stockflow as proof that a command answered by code can show choices. The fix cited `dynamics`'
  `/dynamics-check` instead and dropped the check before building. But that command never asks the
  person: the ask is wired into it and never called. Only `dynamics`' tools ask. This is the
  corpus's signature mistake: a stand-in (the ask is wired into the command) read in place of the
  thing itself (the ask is called).
- **A fix overreached on what was decided.** It called the short start's three questions decided,
  citing an item that does not say so, and renamed the first question with decided item 3's name
  but kept other choices. The example card then matched neither.
- **The section recording the review said every finding was fixed** before anyone had checked the
  fixes.
- **Figures were misstated:** that `/jargone` "did not beat" a one-shot rewrite (it had fewer unknown
  terms, but not a third fewer), and the documents verdict without its unconfirmed reading.
- **The maintainer's pick on the seam pair** was read as a preference, though it answered the
  question decided item 5 retires.

The round-2 fixes have not been reviewed again.
