# Intent: Capture AI-SDLC metrics
Author: Andrew Jones (originator and sole user). Status: draft.

## Problem
Each stage of the AI-native SDLC has leading and lagging metrics, and nothing in this project captures them yet. Without them I can't tell how well the process is working as I apply it.

## Proposed outcome
- A simple way to capture the leading and lagging metrics for every stage of the AI-SDLC in this project.
- The raw data is recorded, not just summaries, so it can easily be displayed as charts and graphs later.
- For now, a skill captures all the metrics we define, taking them from git history where possible.

## Affected users and systems
- Users: just me.
- Systems: this repo, its git history, and a new Claude skill in `.claude/skills/`. Metric definitions come from the lessons in the AI-native SDLC playbook.

## Constraints
- Keep it simple: no extra tooling unless we have to.
- Use git history as the source wherever possible.
- Store raw data, in a form that is easy to turn into charts and graphs.

## Open questions
- Which metrics do we capture? Each lesson defines its own leading and lagging metrics, so the list grows as we work through the stages.
- What format and location should the raw data have, so it is simple to store and easy to chart?
- How will the charts and graphs be displayed? That may be a later intent.
- Which metrics can't be taken from git history, and how do we record those?
- When does the skill run: on demand, or at the end of each stage?
