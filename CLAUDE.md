# Working in this repository

mod-af is a developmental territory for plugins. Each plugin grows in its own folder; the ones
that are ready move up to repositories of their own, alone or together. This file holds the rules
for all of them; a plugin's own rules go in a CLAUDE.md inside its folder, so they move with it.

## Save work to GitHub as you go

Cloud sessions run on a temporary machine. Its disk, this checkout included, is lost when the
machine is recycled, which can happen while a session sits idle. Only what is pushed survives.

- Commit and push each piece of work as soon as it is finished, before it is reviewed.
  Fixes from the review go in as new commits.
- Work in progress may be committed on a work branch, with "work in progress" in the message.
  It can be squashed when the branch is merged.
- Push before starting a long background job. A builder or helper agent commits and pushes
  its own finished output, so it survives even if its report never arrives.
- Push before ending a turn that waits on the maintainer or on a background job.
- During long work, push at least every 30 minutes.

## Lab branches

- Each plugin's research data (study plans, tasks, outputs, judges' files and results) goes on
  its own lab branch, `claude/<plugin>-lab`. A lab branch shares no history with the code and is
  never merged. Its README says what goes there.
- Research data is never kept only on the session's machine.
