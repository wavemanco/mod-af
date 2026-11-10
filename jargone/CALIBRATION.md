# jargone: calibration (design note, 2026-11-10)

A design discussion with the maintainer about jargone's next version. Nothing here is built.
Each point is marked:
- **Decided**: the maintainer said so;
- **Proposed**: Claude suggested it, and the maintainer has not confirmed it yet.

## Where this comes from

jargone was compared with a one-line instruction, under a rule fixed before any results
([`research/comparison-plan.md`](./research/comparison-plan.md)). The figures below are from the
everyday run's report, which also holds the first run's
([`research/comparison-everyday-results.md`](./research/comparison-everyday-results.md)).

- **Software work** (the first run): session mode had 23.8% fewer unknown terms than jargone's
  standing instruction alone. The rule needed a third fewer. It also had more accuracy errors (85
  against 74). It failed.
- **Everyday replies:** session mode had 62.7% fewer unknown terms, and all three model measures
  held. But the judge that counted unknown terms worked almost the same way as session mode's own
  check, so the measure partly graded itself.
- **Everyday documents,** compared on the three every condition rewrote: `/jargone` had 28.7% fewer
  unknown terms than the one-shot rewrite. It failed.
- **The maintainer's reading:** reading the blind pairs, the maintainer understood both texts in
  most of them: "I understand both quite fine … there isn't a huge difference. That itself maybe a
  tell." No ratings were collected. The key to the 15 reply pairs was lost with the working machine
  on 2026-11-10, so those pairs can no longer be scored.

What the maintainer took from the pairs:
- "Which did you understand better?" gets "both" from a strong reader.
- In one pair, text A kept the term "seam" and explained it; text B explained the idea without the
  word. Which is better depends on the reader. Someone who wants to learn the term picks A; someone
  who just wants to get the work done picks B. The maintainer's guess is that most people would
  pick A.

## The idea

A fixed instruction is pitched at an average reader, and on average it works. What is left is the
particular reader: what they already know, and whether they want a term explained or avoided. A
plugin can ask and remember; an instruction cannot. So the plugin's job changes from checking every
reply to learning its reader.

The maintainer's image is **calibrating a compass**. A ship's compass is thrown off by the ship's own
iron. You sail a few known headings, note the error at each, and write a small "deviation card" to
correct by, then redo it when the ship changes.

## Decided

1. **Ship jargone's standing instruction** as a universal instruction. In Claude Code it lives in
   `~/.claude/CLAUDE.md` or an output style; in Claude chat, in the profile or project instructions,
   or a style (the comparison plan names these places).
2. **Ship the plugin too,** with the new job: it adapts to its user, like calibrating a compass.
3. **"Who is this for?" is a question for the person,** not a guess: replies to them, documents they
   write for others, or both.
4. **"Shorter or complete?" is an option for the person,** with a clear caveat: shorter replies may
   leave out an explanation they need.
5. **Ask about preference, not understanding:** "Which would you rather receive?", not "Which did
   you understand better?".
6. **A check-in measures the pitch:** "Was this pitched right: too basic, about right, or too
   technical?"
7. **A short start, then questions as they come up.**
8. **Changes to the card are proposed to the person,** never made silently, and not so often that
   they irritate.
9. **The short start asks each person how often they may be asked.** The person can change that
   answer later with a slash command.
10. **The command is `/jargone:settings`.**
11. **A reset keeps the words the person has learned.** How a person changes or drops a learned
    word is deferred: [`BACKLOG.md`](./BACKLOG.md), JAR-001.
12. **Research data lives on the lab branch** `claude/jargone-lab`. The root `CLAUDE.md` on `main`
    sets this for every plugin, along with saving work to GitHub as you go.

## Proposed, not yet confirmed

**The general rule behind 3 and 4.** Wherever the plugin would make a judgment call about the
person, it asks them instead, states the trade-off, and uses a default only if they skip the
question.

**How it learns:**
- **Asking:** a question is shown as a pair of texts where it can be, since people answer a pair
  more reliably than an abstract question.
- **Watching:** words the person uses count as known. "What does X mean?" marks X as new to them.
  "Too long", "just tell me" or "you don't need to explain that" are style readings.

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
  For: replies to me
  Terms: keep the term, explain it the first time
  Length: complete (explain new terms, even if longer)
  Know well: plugins, hooks, git
  New to me: tax, law
  Learned: seam (2026-11-10)
  Check-ins: now and then
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
- **The person's card never goes in a repository,** since it is a record of what they do not know.
  An audience card may live in a project if the person chooses.
- **A card change is written through the normal write path,** so it respects the person's
  permission settings. The person accepts each change, and accepting is when it is written.

**In Claude chat:**
- **There are no plugins.** A Skill runs the short start and suggests card text for the person to
  paste into their profile or project instructions.
- **That makes two copies,** one on the person's computer and one in chat, which can drift. Which
  one is the master is open.

**The short start: three questions.**
1. Who is this for: replies to me, documents I write, or both.
2. Shorter or complete, with its caveat.
3. How often it may ask:
   - **Choices:** at most once a session, at most once a week, only when asked, or never.
   - **Caveat:** fewer asks means the card learns more slowly.
   - **Scope:** the answer covers every kind of ask: card changes, check-ins, and questions as they
     come up.

**Keeping asks from irritating:**
- Never mid-task.
- At most one ask per session, at the start, with changes batched: "Since last time: you started
  using *seam* and *idempotent*. Mark them as known? All / pick / not now."
- Small changes wait until there are about three, or a week has passed.
- A change the person turns down is not proposed again.
- These numbers are placeholders inside the frequency the person chose.

**`/jargone:settings`:**
- **On its own,** it shows the card: the person's choices first, then what has been learned.
- **`/jargone:settings <line>`** (for example `asks`) asks that one question again, with its choices
  and caveat, rather than taking a typed value.
- **`/jargone:settings reset`** clears the choices, keeps the learned words, and runs the short
  start again.
- **It is answered by code, not the model,** so it is instant and costs nothing. To check before
  building: that such a command can show choices (stockflow's permission prompt suggests it can),
  and that it gets the `jargone:` name form.

**Two commands in all:** `/jargone:settings` and `/jargone:check <file>`. Session mode's on and off
switch (`/jargone-voice` in 0.1) becomes a line in settings.

**The default when a question is skipped:** keep the term and explain it the first time.

**No rewrite after each reply:**
- In the everyday run, the check and rewrite made 49.0% of session mode's cost.
- The person saw both the first reply and the rewrite.

**Documents for other people:** adapting there may mean keeping the author's voice while the text is
simplified, plus remembering what the author says about their audience.

**Testing it before calling it done:**
- **In daily use:** the pitch check-in, and whether "what does X mean?" questions fall off over a
  few weeks.
- **One blind test:** pairs of a calibrated reply and an instruction-only reply to the same
  question. The person is asked "Which would you rather receive?", and "no preference" is allowed.
  A tie counts as not preferring the plugin.
- **The pass mark is written down before the test,** as the comparison's rule was.

## Open questions

- Is the author's writing voice in scope for documents, or only what readers know?
- Which copy of the card is the master: the one in Claude Code or the one in chat?
- What is the pass mark for the blind test, and how long is "a few weeks"?
- Is the two-command shape right?
- What carries over from 0.2? Still on this branch: the checker (with J03, long sentences, and J05,
  nothing lost) and the curated word lists (commit 2251361). Lost: 0.2's wiring, which ran the check
  after each reply. The proposal above drops that.
