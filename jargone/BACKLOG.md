# jargone — backlog

Work consciously postponed, each item with a concrete specification and the event that makes it due.
Nothing here is built until its trigger fires. The design these items belong to is in
[`CALIBRATION.md`](./CALIBRATION.md).

**Filing.** Search this table first (open and closed rows) so an item is not filed twice. A new item
takes the next `JAR-` number, which is never reused or renumbered. Rows are never deleted: a finished
item is marked `DONE YYYY-MM-DD · <test that fails without it>`, a dropped one
`DECLINED YYYY-MM-DD · <reason>`.

| Id | Item | Specification | Trigger | Status |
|---|---|---|---|---|
| JAR-001 | **Change or drop learned words** (deferred by the maintainer on 2026-11-10: a reset keeps learned words, and "changing them or dropping them" is "a backlog matter we can revisit later") | A person can change or drop the learned words on their card. To settle when this is specified: what "changing" a word means (one reading, Claude's: marking it as not known after all); whether dropping covers one word at a time, a wipe of all of them (Claude proposed a separate "reset all"), or both; whether it is done through `/jargone:settings`, by editing the card file, or both; whether changing or dropping also reaches the topic lines, and words that have folded into them (for example, taking "git" out of "Know well"); and whether a dropped word can later be learned again from what the person writes. | The learned-words part of calibration is specified in detail, before it is built; or the first time a person asks to change or drop a learned word. | OPEN |
| JAR-002 | **Share or reconcile cards between Claude Code and chat** (deferred by the maintainer on 2026-11-10: each mode keeps its own card, "true to use"; sharing must be "a user-generated need") | A person can use one mode's card in the other. To settle when this is specified: whether that means copying a card across once, merging two cards, or keeping them separate with an import; and which lines may cross (style choices, knowledge, or both). | A person asks to use their Claude Code card in chat, or their chat card in Claude Code. | OPEN |
