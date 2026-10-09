# Intent: SDLC progress in the Grafana dashboard
Author: Amy Laws. Status: accepted.

## Problem
I can't see at a glance which intents, specs and plans are still in progress. I have to open the `intent/`, `spec/` and `plan/` folders and compare them against the merged builds by hand. The Grafana dashboard shows the AI-SDLC metrics (intent 005) but nothing about where each piece of work currently sits in the SDLC.

## Proposed outcome
- The Grafana dashboard has a panel showing the current stage of every intent, with a row per item number:
  - slug and stage: awaiting spec, awaiting plan, in build, or built;
  - the Status of its intent, spec and plan.
- It shows how long each item has been in its current stage, so work that has stalled stands out.
- Stages are worked out from what is merged to `origin/main`: which of the intent, spec and plan files exist, and whether a `Build NNN` commit has landed.
- The data is refreshed on demand with a command I run by hand before opening the dashboard, as metrics collection is today. Nothing is scheduled.

## Affected users and systems
- Users: just me.
- Systems: the existing Grafana dashboard and its data loading (intent 005), `intent/`, `spec/`, `plan/`, and the `Build NNN` commits on `main`.

## Constraints
- Reads from `origin/main` only, so local branches do not change what the dashboard shows.
- Builds on intent 005 and shows up in the same dashboard, in the same local, run-it-yourself setup.
- Browser app rules (`project-standards`) do not apply, as this is tooling, but nothing leaves my machine.

## Open questions
- "Built" currently means a commit whose subject starts `Build NNN`. Items 001 and 003 were built under differently worded commits, so they would show as in build. Do I fix the old commits' matching (for example by hand-listing them) or accept it?
- Time in stage needs a date for when each file first appeared on `main`. Is the first commit that added the file the right date?
- Is the Status word of the intent, spec and plan worth showing, or is the stage on its own enough?
