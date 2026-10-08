# Intent: AI-SDLC metrics dashboard
Author: Amy Laws. Status: accepted.

## Problem
Intent 002 posts the AI-SDLC metrics as a comment on each pull request. That leaves the data spread across many PRs, so I can't see trends or compare stages without opening them one by one.

## Proposed outcome
- The metrics comments are pulled from the PRs across the project and shown in a dashboard.
- The data is pulled every evening by a scheduled job.
- The dashboard shows:
  - each metric over time;
  - the metrics grouped by stage (Plan, Design, Build), as in `AI-SDLC.md`;
  - a drill-down into one change;
  - leading against lagging metrics;
  - skill usage: which repository skills were used and how often, per change and over time;
  - token usage: input, output, cache read and cache write tokens by model, per change and over time.

## Affected users and systems
- Users: just me.
- Systems: the metrics comments on this repo's pull requests (from intents 002 and 008), a scheduled job, and the dashboard itself.

## Constraints
- Depends on intent 002. The dashboard reads the comments it creates.
- Depends on intent 008 for the skill and token rows. Those rows are recorded per contributor, so the dashboard must combine contributors' rows for the same PR.
- Reads from the PR comments, so it must be able to find and parse them reliably.
- Skill and token data is raw counts only. Dollar cost is not recorded (see `metrics.md`), so any cost shown must be calculated by the dashboard from token counts and a price I supply.
- Only repository skills are counted, and the figures are approximate (branch attribution misses work in sessions that never touched the branch). The dashboard should say so rather than present them as exact.
- A PR whose contributor has no session data has an empty `value` with the note `no session data captured`. The dashboard must show that as missing, not as zero.

## Open questions
- Where does the dashboard live and how do I view it?
- Where does the scheduled job run, and where does the collected data go between runs?
- What format must the metrics comments have so the job can read them reliably? That is settled in intent 002's spec.
- What happens to PRs opened before intent 002 ships, which have no metrics comment?
- What time of the evening, and in which time zone, should the job run?
- Which skill and token views are useful: skill counts per PR, skills over time, tokens per stage, or tokens per merged change?
- Should the dashboard show an estimated cost, and if so, where do the prices come from?
- Skill and token rows only exist for PRs updated after intent 008 shipped, and only for contributors who ran the capture locally. How should the dashboard treat earlier PRs and gaps?
