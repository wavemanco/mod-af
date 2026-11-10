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
| JAR-001 | **Change or drop a learned word** (deferred by the maintainer on 2026-11-10: a reset keeps learned words, and how to change them is a matter for later) | A person can mark a word on their card as not known after all, or remove it. To settle when this is specified: whether it is done through `/jargone:settings`, by editing the card file, or both; and whether a word marked "not known" can later be learned again from what the person writes. | The learned-words part of calibration is specified in detail, before it is built; or the first time a person asks to change or drop a learned word. | OPEN |
