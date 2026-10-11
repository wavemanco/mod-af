# loose-ends

An anti-decay audit for a conversation. Long working sessions accumulate decisions, ideas, and noticed-in-passing problems that live only in the chat — and vanish when it ends. `/loose-ends` catches them before they're lost.

It scans the conversation and sorts what it finds into three buckets:

- **Implement now** — small and in-scope; it offers to just do them.
- **File it** — worth keeping but not now. Each gets a one-line description, a **home** (issue / task / backlog / decisions log / doc / code comment — whatever the project uses), and a concrete **trigger** (the event that should bring it back, never a vague "later").
- **Drop** — raised but decided against or obsolete; noted so it isn't re-litigated.

Then it offers to file the keepers where they belong.

Optional focus: `/loose-ends security` (or any topic) narrows the sweep.

## Install

```
/plugin install loose-ends --marketplace wavemanco/mod-af
```

## Or use the prompt

[`prompt.md`](./prompt.md) is the same workflow as a copy-paste prompt for any chat.
