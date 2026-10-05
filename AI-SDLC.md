# AI-SDLC Tracker

A running record of how we apply the AI-native SDLC to this project. Add a section at each stage.

## Setup
- Repo initialised, README added.

## Deploy: approval gates
- Source: AI-native SDLC Playbook, "Hooks as Approval Gates".
- Added a `PreToolUse` hook (`.claude/hooks/push-gate.sh`) that pauses every `git push` for human approval (permission decision `ask`).
- Replaced the lesson's production-deploy gate: this app has no deploy step, so push is the closest release checkpoint.
