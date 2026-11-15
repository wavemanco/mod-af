# Run `bare`: skill-only prototype

- Prompt: `/decide Should mod-af keep a hand-written prompt.md for each plugin, or generate it from the plugin's skill file? Keep it short.`
- Tool calls: Bash command; Bash command
- Skill used: yes, by the slash command
- Turns: 3; cost: $0.16

## The reply, as returned

I couldn't look at the mod-af code: the working folder is empty and the wider file search needed permission I don't have. So this brief rests on general reasoning, not on how mod-af actually works. The section at the end lists the two facts that would change the answer.

## The decision
Each plugin currently has two files that can describe it: a hand-written `prompt.md` and its skill file. The choice is whether to keep maintaining `prompt.md` by hand or build it from the skill file automatically. It matters because two copies of one description drift apart, and then users get behaviour that doesn't match what the plugin says it does. This is **easy to reverse**: either way, you can switch back later.

## Options

**A. Keep a hand-written prompt.md**
- **What it means:** someone writes and updates each plugin's prompt separately from its skill file.
- **Pros:** full control over wording. It works well if the prompt really needs to say something different from the skill file.
- **Cons:** two files to keep in step. People will forget to update one, and the plugin quietly behaves differently from what it claims. That gets worse as you add plugins.
- **Cost:** no build work up front. The upkeep never stops and grows with each plugin.

**B. Generate prompt.md from the skill file**
- **What it means:** the skill file is the only thing anyone edits, and `prompt.md` is produced from it on each build.
- **Pros:** one source of truth, so the two can't disagree. New plugins get a prompt for free.
- **Cons:** the generated prompt reads only as well as the skill file. Any wording that should appear in only one of the two needs a home somewhere.
- **Cost:** a small script, probably hours rather than days, plus a check that the build runs it.

**C. Generate it, with an optional hand-written add-on per plugin**
- **What it means:** same as B, but a plugin can add a short note of its own that gets attached to the generated prompt.
- **Pros:** you get B's consistency, plus a way out for the few plugins that need it.
- **Cons:** slightly more to explain, and some people will be tempted to lean on the add-on too much.
- **Cost:** about the same as B.

## Recommendation
**Go with C, which works out as B in practice: generate it by default.** Drift between two copies is the most likely way this goes wrong, and generating the file removes that risk entirely. The optional add-on covers the rare plugin that needs its own wording, so you don't have to keep hand-writing every file to handle a few exceptions. If no plugin ever needs the add-on, you've simply ended up with B.

## What would change this
- **The prompt and the skill file are meant to say different things.** For example, the prompt might be written for the model while the skill file is written for people browsing plugins. If so, they aren't duplicates, and generating one from the other would make the prompt worse. Keep A.
- **There are only one or two plugins and you don't expect more.** Then the drift risk is tiny, and writing a script isn't worth it yet.

If you tell me where mod-af lives, I'll check both of these against the real files. I can also write a short decision record covering the date, the choice, the reasoning, the alternatives and whether it's reversible. Tell me where you keep those, such as a decisions log or an ADR folder, or I'll put it inline.
