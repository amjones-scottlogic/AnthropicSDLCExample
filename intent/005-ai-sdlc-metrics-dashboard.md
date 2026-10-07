# Intent: AI-SDLC metrics dashboard
Author: Andrew Jones (originator and sole user). Status: draft.

## Problem
Intent 002 posts the AI-SDLC metrics as a comment on each pull request. That leaves the data spread across many PRs, so I can't see trends or compare stages without opening them one by one.

## Proposed outcome
- The metrics comments are pulled from the PRs across the project and shown in a dashboard.
- The data is pulled every evening by a scheduled job.
- The dashboard shows:
  - each metric over time;
  - the metrics grouped by stage (Plan, Design, Build), as in `AI-SDLC.md`;
  - a drill-down into one change;
  - leading against lagging metrics.

## Affected users and systems
- Users: just me.
- Systems: the metrics comments on this repo's pull requests (from intent 002), a scheduled job, and the dashboard itself.

## Constraints
- Depends on intent 002. The dashboard reads the comments it creates.
- Reads from the PR comments, so it must be able to find and parse them reliably.

## Open questions
- Where does the dashboard live and how do I view it?
- Where does the scheduled job run, and where does the collected data go between runs?
- What format must the metrics comments have so the job can read them reliably? That is settled in intent 002's spec.
- What happens to PRs opened before intent 002 ships, which have no metrics comment?
- What time of the evening, and in which time zone, should the job run?
