# route

"Are we nearly there?" answered honestly. `/route <milestone>` gives you the real route between where the project is now and a milestone you name — not a vague "almost there".

- **The milestone** — what "done" concretely means.
- **What's actually left** — every open item, each marked **hard blocker** vs **nice-to-have** (strictly — most things aren't blockers) and **decision** vs **work**, with who owns it. A decision that implies downstream work says so.
- **The real gate** — the single thing (or smallest set) actually in the way right now, named plainly. If what people associate with this milestone is really a *later* milestone's gate, it separates the two.
- **The critical path** — when more than one blocker remains, the dependency-ordered chain that determines the timeline (the long pole), vs what can run in parallel.

It grounds itself in the real state — code, tracker, docs — before answering.

## Install

```
/plugin install route --marketplace wavemanco/mod-af
```

## Or use the prompt

[`prompt.md`](./prompt.md) is the same workflow as a copy-paste prompt for any chat.
