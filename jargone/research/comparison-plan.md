# Is jargone better than a one-line instruction? (plan, fixed before any results)

Written 2026-10-31, before any output was generated. If jargone is not markedly better than a
simple instruction, it should not be a plugin: a universal instruction would do the job in Claude
Code (`~/.claude/CLAUDE.md` or an output style) and in Claude chat (profile instructions, project
instructions or a custom style).

## Conditions

Same writing model, same tasks; only the instruction differs.

| | Condition | Where it lives |
|---|---|---|
| C1 | No instruction (control) | nothing |
| C2 | "Explain about 80% of the way to ASD-STE100." (Karpathy's line) | `CLAUDE.md` |
| C3 | jargone's standing instruction alone (write for the named reader, define terms, one idea per sentence) | `CLAUDE.md` |
| C4 | C2 and C3 together | `CLAUDE.md` |
| C5 | jargone session mode: C3, then the per-reply model check, then one rewrite when terms remain | `CLAUDE.md` plus the check, run by script |

For documents: a one-shot "rewrite this for <reader>" with the best of C2 to C4, against the full
`/jargone` method.

C5 is run by script with the same steps as the plugin's session mode (the 0.2 build was not finished
when the comparison ran). The script and its prompts are saved with the results.

## Tasks

- **Replies:** 30 self-contained prompts from real work, 15 coding and 15 not (explain a concept,
  compare options, summarise findings, explain an error or a change), each with the context it
  needs. The reader is "a non-specialist maintainer".
- **Documents:** the three documents from the first trial, plus two more.

## Measures, all judged blind (conditions shuffled and unlabelled)

1. **Primary: unknown terms per 1,000 words.** A model briefed as the reader, shown only the output,
   lists every word or phrase it would not understand.
2. **Key points:** for each task, the points a reader must take away are written from the task
   alone, before any output exists; a reader model answers questions on them.
3. **Accuracy:** every claim in the output is checked against the task's facts.
4. **Cost:** words, tokens and seconds. For C5, the extra check and any rewrite are counted, and the
   fact that the person sees both the first reply and the rewrite.
5. **Human:** the maintainer rates 10 blind pairs (5 coding, 5 not, chosen at random): the best of
   C2 to C4 against C5, order hidden, "which did you understand better?".

## Decision rule

The best simple instruction is whichever of C2, C3 and C4 has the fewest unknown terms per 1,000
words on replies.

jargone stays a plugin only if all of these hold against that best simple instruction:
- it has at least a third fewer unknown terms per 1,000 words;
- its key-point score is no more than 5 points lower;
- it has no more accuracy errors;
- the maintainer prefers it in at least 7 of the 10 pairs.

If the maintainer's ratings and the model measures disagree, the maintainer's ratings decide, and
the disagreement is reported. For documents the same rule applies, plus the "nothing lost" check
(J05) and the meaning changes found. Cost is reported for the maintainer to judge; it is not part of
the rule.

If jargone fails the rule, the best simple instruction ships as a universal instruction for Claude
Code and Claude chat. The document check for lost content (J05) may then be kept as a small,
separate tool, if it alone proves worth it.

## Addendum (2026-10-31): everyday, non-coding work

Added after the first results were seen, at the maintainer's request: the first task set came from
software work only, and jargone must also serve people drafting everyday documents, for example in
Claude chat. This extension is fixed before any of its output is generated.

- **Replies:** 20 self-contained requests of the kind people bring to Claude chat outside software:
  health, money, housing, law, school, work, government services and science news. Each names its
  reader (for example a tenant, a patient's relative, a parent, a small-business owner, a retired
  person) and carries the facts the writer needs. Facts are taken from public-domain sources or are
  clearly invented for the task.
- **Documents:** 5 dense public-domain texts (United States government works: a regulation excerpt,
  a court opinion excerpt, a benefits or coverage rule, an accident or safety report summary, a
  federal notice), 300 to 900 words each, each for a named everyday reader.
- **Conditions, measures and judging:** as above. The instruction lives in `CLAUDE.md` for the run;
  in Claude chat it would live in the profile instructions or a project's instructions, which this
  run approximates.
- **Human check:** 10 more blind pairs for the maintainer: 5 replies (best of C2 to C4 against C5)
  and 5 documents (best one-shot against `/jargone`, the reader-facing text only).
- **Decision:** the rule above applies to this set separately. If jargone fails on both sets, the
  best simple instruction ships everywhere. If it passes only on everyday documents, the
  recommendation is a document tool (the chat Skill) plus the instruction for sessions. If it passes
  on both, it stays a plugin.
