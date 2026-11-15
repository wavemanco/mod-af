# Run `namespaced`: skill-only prototype

- Prompt: `/decide:decide Should mod-af keep a hand-written prompt.md for each plugin, or generate it from the plugin's skill file? Keep it short.`
- Tool calls: Bash command; Bash command
- Skill used: yes, by the slash command
- Turns: 3; cost: $0.18

## The reply, as returned

I couldn't find any mod-af code here (the working folder is empty), so this brief is based on how you described the setup: each plugin has a skill file, and today a separate `prompt.md` is written by hand alongside it. If I've got that wrong, tell me and I'll redo it.

## The decision
Should each plugin's `prompt.md` (the instructions the AI actually gets) be written by hand, or built automatically from the plugin's skill file? It matters now because every new plugin either adds a second file to keep in sync or doesn't. You can change your mind later at low cost.

## Options

**A. Keep a hand-written `prompt.md` for every plugin**
- **What it means:** Each plugin's prompt is written and maintained by hand, separately from its skill file.
- **Pros:** Full control over wording for each plugin. Nothing to build.
- **Cons:** Two files describe the same plugin, and they will drift apart. When that happens, users get behaviour that doesn't match the docs, and nothing warns you. The upkeep grows with every plugin you add.
- **Cost:** Nothing up front. A small, ongoing cost per plugin, plus bugs that are hard to spot.

**B. Generate `prompt.md` from the skill file**
- **What it means:** The skill file is the only source. The prompt is produced from it automatically, whenever you build or at load time.
- **Pros:** The prompt can't fall out of date with the skill file. Adding a plugin means writing one file. Behaviour is consistent across plugins.
- **Cons:** A plugin that needs unusual wording won't fit cleanly. You need a simple generator and a way to test it. A bug in the generator affects every plugin at once.
- **Cost:** Roughly a day or two to build, then close to zero upkeep.

**C. Generate by default, with an optional hand-written override**
- **What it means:** Same as B, except a plugin can ship its own `prompt.md` (or a section added on top of the generated one) when it really needs custom wording.
- **Pros:** Most plugins stay in sync automatically, and the unusual ones still have an escape hatch.
- **Cons:** Overrides can drift too, though only in a few places you know about. It's slightly more to explain to plugin authors.
- **Cost:** About the same as B, plus a few hours for the override.

## Recommendation
**Go with C: generate the prompt by default and allow an override.** The real risk here is quiet drift between two files, where the plugin does something different from what its skill file says. Generating the prompt removes that risk for almost every plugin. The override keeps the one real benefit of hand-writing, which is precise wording where it matters. Also have the generator print a warning whenever an override exists, so the exceptions stay visible.

## What would change this
- **If hand-written prompts consistently and noticeably beat generated ones** in real use, keep them hand-written (A) and add an automated check that flags drift.
- **If mod-af will only ever have a handful of plugins** that rarely change, the drift risk is small and A is fine.

Want me to write this up as a short decision record? Tell me where you keep those (a decisions log, an ADR folder, an issue), or I can put it in the working folder.
