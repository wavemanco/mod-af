# mod-af

A collection of [Claude Code](https://claude.com/claude-code) plugins ("mods") built the mod route — each one a slash command or hook that changes how Claude Code behaves. The plugins here are independent and may be unrelated; install only the ones you want.

**Two formats, your choice.** Every plugin ships both ways: install it for a `/command`, or — if you'd rather not install anything — copy its `prompt.md` into any chat (it works even outside Claude Code). Same workflow either way.

## Plugins

### `decide` — a decision brief for any choice
Real options → pros/cons (user/product view first, with reversibility and cost-if-wrong) → a committed recommendation and why → a durable decision record. Written to be followed by a non-technical / product reader, not just an engineer. `/decide <the decision>`. See [`decide/`](./decide/README.md).

### `route` — route to a milestone
"Are we nearly there?" answered honestly: what's actually left, the real gate named plainly, hard-blockers vs nice-to-haves, and the critical path when several things remain. `/route <milestone>`. See [`route/`](./route/README.md).

### `loose-ends` — don't let the conversation decay
Finds everything that exists only in the chat — decisions, ideas, noticed-in-passing bugs — and sorts it into implement-now / file-it-with-a-trigger / drop, so nothing important dies in the transcript. `/loose-ends [focus]`. See [`loose-ends/`](./loose-ends/README.md).

### `detell` — strip AI-writing tells from a file
An adversarial loop: scan for AI-writing tells, rewrite the hits, re-scan with fresh eyes, until two consecutive clean passes. The tells checklist is distilled from Wikipedia's *Signs of AI writing*, which evolves, so it re-checks that source on a 14-day cadence instead of every run. `/detell <file>` · `/detell-refresh`. See [`detell/`](./detell/README.md).

### `dynamics` — why a system keeps behaving the way it does
Uses system dynamics to explain why something keeps happening in a codebase or product, such as a bug backlog that keeps growing: it maps what accumulates, what adds to or drains it, and the feedback loops between them, quoting the source behind each part it finds and labelling what it infers. No simulation. `/dynamics <what to model> — <the question>`. See [`dynamics/`](./dynamics/README.md).

## Install

In a Claude Code terminal session, for any plugin above:

```
/plugin install <name> --marketplace wavemanco/mod-af
```

Press `y` to add the marketplace, then pick a scope. (Or skip the install and use that plugin's `prompt.md`.)

## Pull requests

This repository is in its startup phase. To keep early development focused and
manageable, new pull requests are currently limited to repository collaborators
with write access. We will revisit this policy as the project matures.

## License

[MIT](./LICENSE) © 2026 mod-af contributors.
