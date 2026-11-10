# jargone lab

This branch is jargone's lab: the data behind its research, such as trials, comparisons and
calibration tests. It is public. It is never merged into `main`; jargone's code lives on its own
branches, and this branch shares no history with them.

## Why it exists

On 2026-11-10 the cloud machine a working session ran on was replaced. Two comparisons' raw files
were lost with it, including the key to the blind pairs, because they were kept only on that
machine. Research data now comes here as soon as it exists.

## Layout

One folder per study, named `<date>-<study>/`, holding its plan, tasks, outputs, judges' files,
scripts and summary. The plan is committed before any result.

## What does not go here

- Secrets, tokens and email addresses.
- Content from private repositories, unless the maintainer agrees for that item.
- Model names. Raw files name each model by its role: writer, checker or judge.
- A person's reader card, unless that person agrees.

## When to commit

- As soon as files exist, before they are reviewed. Fixes go in as new commits.
- Before starting a long background job. Builders push their own output.
- Before ending a turn that waits on the maintainer.
- At least every 30 minutes during long work.
