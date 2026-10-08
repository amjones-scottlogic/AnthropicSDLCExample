# Intent: Document how to run the metrics dashboard in the README
Author: Amy Laws (originator). Status: draft.

## Problem
The metrics dashboard (intent 005) runs locally from files in the repo, but the only instructions for running it are in `grafana/README.md`. Someone reading the project README wouldn't know the dashboard exists or how to start it.

## Proposed outcome
- The project README explains how to run the dashboard: what it needs installed, how to start and stop it, how to load the data, and where to open it.
- It also covers first-time setup: Docker Desktop, `gh auth login` and changing the Grafana admin password.
- The README has a short section that points to `grafana/README.md` for the steps, so they live in one place.
- Someone new to the project can find the dashboard from the README and follow it through to a running dashboard.

## Affected users and systems
- Users: anyone who wants to view the AI-SDLC metrics.
- Systems: the project `README.md`, and the dashboard setup in `grafana/` (intent 005).

## Constraints
- Describe the dashboard as it is: collection is run by hand, nothing is scheduled.
- Don't change how the dashboard works. This is documentation only.

## Open questions
None.
