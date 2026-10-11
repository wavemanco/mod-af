# detell

Strip AI-writing tells from a file, adversarially, until the text is clean.

## What it does

`/detell <file>` runs a loop:

1. **Scan** the file against a checklist of AI-writing tells — puffery, overused vocabulary, copula avoidance, negative-parallelism tics ("not just X, but Y"), rule-of-three padding, participial significance tails, weasel attribution, summary-isms, formatting tics (em-dash overuse), and chatbot tone.
2. If there are hits, **rewrite** only those spans into plain, specific prose, keeping every fact and the author's voice.
3. **Re-scan with fresh eyes**, because a rewrite commonly introduces a new tell (fixing an em-dash by adding "moreover"; breaking a triple into a "not just X" contrast).
4. Stop only after **two consecutive clean passes**.

It never invents content, drops information, or adds puffery. It removes tells and preserves meaning.

## The evolving source

The checklist is distilled from [Wikipedia's *Signs of AI writing*](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), which is updated as new tells are discovered. Re-fetching it every run would be wasteful, so `detell` records when it last checked and only prompts a refresh when the checklist is older than 14 days. When a refresh is due it fetches the source, re-distills the tells, and calls `/detell-refresh` to persist the new checklist durably across sessions.

- `/detell <file>` — de-tell the file (prompts a source refresh first if the checklist is stale).
- `/detell-refresh <path>` — persist a re-distilled checklist from a file, stamping today as the last-checked date.

## Install

```
/plugin install detell --marketplace wavemanco/mod-af
```

## Or use the prompt

Prefer not to install? [`prompt.md`](./prompt.md) is the same de-tell loop as a copy-paste prompt for any chat. (The plugin additionally manages the 14-day source re-check; the prompt form leaves that to you.)
