# mod-af

A collection of [Claude Code](https://claude.com/claude-code) plugins ("mods") built the mod route — each one a slash command or hook that changes how Claude Code behaves. The plugins here are independent and may be unrelated; install only the ones you want.

**Two formats, your choice.** Every plugin ships both ways: install it for a `/command`, or — if you'd rather not install anything — copy its `prompt.md` into any chat (it works even outside Claude Code). Same workflow either way (where a plugin adds tools, its prompt form does that step by hand).

## Plugins

### `decide` — a decision brief for any choice
Real options → pros/cons (user/product view first, with reversibility and cost-if-wrong) → a committed recommendation and why → a durable decision record. Written to be followed by a non-technical / product reader, not just an engineer. `/decide <the decision>`. See [`decide/`](./decide/README.md).

### `route` — route to a milestone
"Are we nearly there?" answered honestly: what's actually left, the real gate named plainly, hard-blockers vs nice-to-haves, and the critical path when several things remain. `/route <milestone>`. See [`route/`](./route/README.md).

### `dynamics` — a verified stock-and-flow map of any system
Point it at a codebase, a repository or a set of product docs and it maps what piles up, what fills and drains it, and which feedback loops push the system forward or hold it back. Three independent lenses extract the model from the real sources, a bundled checker verifies it mechanically (every loop closes, R/B labels match the signs, only a stock's own flows change it), each link is re-checked against its source and tagged documented, inferred or hypothesis, and a bundled renderer draws an interactive diagram you can step through by stage. `/dynamics <what to model>`. See [`dynamics/`](./dynamics/README.md).

### `loose-ends` — don't let the conversation decay
Finds everything that exists only in the chat — decisions, ideas, noticed-in-passing bugs — and sorts it into implement-now / file-it-with-a-trigger / drop, so nothing important dies in the transcript. `/loose-ends [focus]`. See [`loose-ends/`](./loose-ends/README.md).

### `detell` — strip AI-writing tells from a file
An adversarial loop: scan for AI-writing tells, rewrite the hits, re-scan with fresh eyes, until two consecutive clean passes. The tells checklist is distilled from Wikipedia's *Signs of AI writing*, which evolves, so it re-checks that source on a 14-day cadence instead of every run. `/detell <file>` · `/detell-refresh`. See [`detell/`](./detell/README.md).

## Install

In a Claude Code terminal session, for any plugin above:

```
/plugin install <name> --marketplace wavemanco/mod-af
```

Press `y` to add the marketplace, then pick a scope. (Or skip the install and use that plugin's `prompt.md`.)

## Adding a plugin to this collection

Each plugin is a self-contained folder with its own `.claude-plugin/plugin.json` and `hooks/`, plus a `prompt.md` (the copy-paste form) and a `README.md`. A plugin may also carry `assets/` (files its hooks read through `$.plugin.root`) and `tests/` (`*.test.ts`, run with `claude plugin test <plugin-name>`). To add one:

1. Create `<plugin-name>/` holding `.claude-plugin/plugin.json`, `hooks/hooks.json`, and the hooks module it names.
2. Add an entry to [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json): `{ "name": "<plugin-name>", "source": "./<plugin-name>" }`.
3. Run `claude plugin validate <plugin-name>` (and `claude plugin test <plugin-name>` if it has tests) before committing.
