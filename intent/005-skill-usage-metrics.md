# Intent: Capture skill usage in the PR metrics
Author: Amy Laws (originator). Status: draft.

## Problem
The PR metrics comment (intent 002) doesn't say which skills were used while the PR was built. I want that as extra data for the dashboard, which is covered in a separate intent.

## Proposed outcome
- The PR metrics comment also records which skills were used in the PR and how many times each was used.
- "Used in the PR" means every commit on the PR branch.
- The data comes from the output of the Claude `usage` and `cost` commands.
- The `cost` figures are recorded in the comment alongside the skill counts.
- The skill counts and cost figures are recorded as raw data, in the same form as the other metrics, so the dashboard can chart them later.
- They are posted in the existing metrics comment and refreshed with it when more commits are pushed.

## Affected users and systems
- Users: just me.
- Systems: the existing `capture-metrics` skill and script, the PR metrics comment, and the Claude `usage` and `cost` command output.

## Constraints
- Keep it simple: build on the existing metrics capture, no new tooling unless we have to.
- Record raw counts and figures, not just a summary.
- Displaying the data is out of scope. The dashboard is a separate intent.

## Open questions
- Does the `usage` or `cost` output actually list skills and how many times each was invoked? If not, where does that data come from?
- Can that data be tied to the commits on a PR branch, given the commands report on sessions and not on commits?
- What happens when a session spans several branches or PRs?
