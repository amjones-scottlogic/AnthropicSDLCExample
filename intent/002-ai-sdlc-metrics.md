# Intent: Capture AI-SDLC metrics
Author: Andrew Jones (originator and sole user). Status: accepted.

## Problem
Each stage of the AI-native SDLC has leading and lagging metrics, and nothing in this project captures them yet. Without them I can't tell how well the process is working as I apply it.

## Proposed outcome
- A simple way to capture the leading and lagging metrics for every stage of the AI-SDLC in this project.
- Every metric defined in `AI-SDLC.md` is captured. The list grows as we work through the stages and new lessons define more metrics.
- The raw data is recorded, not just summaries, so it can easily be displayed as charts and graphs later.
- For now, a skill captures all the metrics we define, taking them from git history where possible.
- Metrics that can't be taken from git history (for example time from first conversation to intent, concurrent sessions, time spent orchestrating rather than waiting) are gathered from Claude session stats.
- The skill runs at the end of each stage, triggered by a GitHub Action when a pull request is opened.

## Affected users and systems
- Users: just me.
- Systems: this repo, its git history, Claude session stats, and a new Claude skill in `.claude/skills/`. Metric definitions come from the lessons in the AI-native SDLC playbook.

## Constraints
- Keep it simple: no extra tooling unless we have to.
- Use git history as the source wherever possible.
- Store raw data as CSV files in `metrics/`, in a form that is easy to turn into charts and graphs.
- Displaying charts and graphs is out of scope here; that is a later intent.

## Open questions
- What Claude session data is actually available to read, and does it cover the metrics git can't (concurrent sessions, orchestrating versus waiting, time from first conversation to intent)?
- Does one PR open mark the end of every stage, given that intents, specs and plans each arrive in their own PR?
- A GitHub Action runs on GitHub's servers and can't see Claude session stats stored on my machine. How do the session-based metrics reach it?
- Deploy metrics are still to be defined in `AI-SDLC.md`, so none can be captured for that stage yet.
