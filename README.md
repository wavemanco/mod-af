# mod-af

A collection of [Claude Code](https://claude.com/claude-code) plugins ("mods") built the mod route — each one a slash command or hook that changes how Claude Code behaves. The plugins here are independent and may be unrelated; install only the ones you want.

## Plugins

### `detell` — strip AI-writing tells from a file

Runs an adversarial loop over a file: scan it for AI-writing tells, rewrite the hits, then re-scan with fresh eyes (a rewrite can introduce new tells), repeating until two consecutive clean passes. The tells checklist is distilled from Wikipedia's *Signs of AI writing*, which changes as new tells are catalogued, so the plugin re-checks that source on a cadence (every 14 days by default) instead of every run.

- `/detell <file>` — de-tell the file (or the draft in focus).
- `/detell-refresh <file>` — persist a re-distilled checklist (the model calls this after re-fetching the source).

See [`detell/README.md`](./detell/README.md) for details.

## Install

In a Claude Code terminal session:

```
/plugin install detell --marketplace wavemanco/mod-af
```

Press `y` to add the marketplace, then pick a scope.

## Adding a plugin to this collection

Each plugin is a self-contained folder with its own `.claude-plugin/plugin.json` and `hooks/`. To add one:

1. Create `<plugin-name>/` holding `.claude-plugin/plugin.json`, `hooks/hooks.json`, and the hooks module it names.
2. Add an entry to [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json): `{ "name": "<plugin-name>", "source": "./<plugin-name>" }`.
3. Run `claude plugin validate <plugin-name>` before committing.
