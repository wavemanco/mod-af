# Run `natural`: skill-only prototype

- Prompt: `Should mod-af keep a hand-written prompt.md for each plugin, or generate it from the plugin's skill file? Keep it short.`
- Tool calls: Bash command
- Skill used: no
- Turns: 2; cost: $0.13

## The reply, as returned

I'd generate it from the skill file. I couldn't check this against mod-af itself, because the working directory is empty, so this is the general answer.

**Why generate:**
- **One source of truth.** A hand-written prompt.md gets out of sync once someone edits the skill and forgets the prompt. That's the most common failure with duplicated docs.
- **Less upkeep.** Each new plugin means writing one file, not two.
- **Enforceable.** A CI check can rebuild the prompts and fail if a committed prompt.md differs from what the skill produces.

**When hand-written makes sense:** if prompt.md really needs different content from the skill file (a different audience, tone or length), it isn't a copy, and generating it would give you a worse version.

**Middle ground:** generate the prompt.md and let each plugin add an optional override or appendix (say, a `prompt.extra.md` merged in at build time). Mark the generated file "do not edit" so nobody changes it by hand.

If you point me at the repo, I can check whether the current prompt.md files actually differ from the skill files. That would settle it.
