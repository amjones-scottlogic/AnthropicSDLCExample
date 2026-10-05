# CLAUDE.md

This project follows the AI-native SDLC described in [AI-SDLC.md](AI-SDLC.md). Read it for the stages, triggers and roles before starting work.

- Intents go in `intent/` (use the `capture-intent` skill). Only the product owner accepts one.
- Specs are written by the `write-spec` GitHub Action when an intent is merged to `main`. Do not run `/write-spec` locally unless the Action is unavailable.
- Build starts from an approved spec: use the `plan` skill in plan mode and get the plan approved before changing code. If implementation departs from the plan, update the plan in the same commit (the `plan-sync` hook enforces this).
- Specs must respect the `project-standards` skill.
- Never push without human approval.
