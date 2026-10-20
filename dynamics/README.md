# dynamics

A system-dynamics map of any codebase, repository or set of product docs: what piles up, what fills and drains it, and which feedback loops push the system forward or hold it back. It comes out as an interactive stock-and-flow diagram you can click through.

`/dynamics <what to model>` (this repo, a path, a GitHub URL, or docs) runs a grounded, verified process:

1. **Frame and ground.** One question about behaviour over time ("why does the backlog keep growing?"), a horizon, a boundary, and a read of the real sources: docs, code entry points, configuration, roadmap. The target's contents are treated as data, and its code is never run.
2. **Extract under three lenses**: the engine (one unit of work and its limits), growth and memory (what accumulates over time), and control and governance (gates, budgets, incentives). Subagents run them in parallel when available; the report says when they could not be independent. Every link is tagged **documented**, **inferred** or **hypothesis** as it is extracted.
3. **Merge** into one readable model, with caps on stocks, flows and loops, and stages when the sources describe phases.
4. **Verify adversarially.** A deterministic checker (`check_model`, a tool the plugin adds for Claude) confirms every loop closes, that each loop's R/B label matches the parity of its negative links, that only a stock's own flows change it, and that stages are in order. It warns on readability caps and drawing problems (overlapping boxes, pipes too short), and lists feedback cycles nobody named. Each link is then re-checked against its source and downgraded where the source does not say it.
5. **Render** with the bundled renderer (`render_model`): stocks, flows with valves, signed links (hypotheses dashed), delays, loop markers, a stage selector that shows the system growing, and a panel that explains anything you click. The page is always written as an HTML file, and published as an Artifact where that is available.
6. **Report** in plain language: the question, the main dynamic and which loop dominates when, the leverage points and risks, missing feedback, what verification found, and the limits.

The conventions are the standard ones of system dynamics: stocks and flows, link polarity with everything else held equal, and loop polarity from the parity of negative links. The result is a qualitative map, not a simulation.

## When to use it, and what it costs

Use it on something that accumulates and feeds back on itself: a product and its users, a pipeline with queues and budgets, a codebase with debt and contributors, a strategy with stage gates. It is the wrong tool for a stateless utility or a one-off script, and it says so instead of inventing loops.

A full run reads the sources, runs three extraction passes, a merge, a verification pass and a render, so on a large repository expect several minutes and roughly the tokens of four or five subagent research tasks (three lenses, a verifier, and the main thread). On a small target (a few files, one document) it uses one combined pass.

## Install

```
/plugin install dynamics --marketplace wavemanco/mod-af
```

## Or use the prompt

Prefer not to install? [`prompt.md`](./prompt.md) is the same process as a copy-paste prompt that works in any chat. It has no checker or renderer, so it does the parity checks by hand and draws the diagram itself (or a Mermaid chart where it cannot make a page).

## The model file

`/dynamics` writes the model as JSON (`meta`, `stages`, `nodes`, `links`, `loops`; the procedure shows the shape) in a scratch folder, never in the target repository unless you ask. Edit it and ask Claude to check or render it again; the checker and renderer are tools Claude calls, not commands you type.
