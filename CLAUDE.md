# CLAUDE.md

This project follows the AI-native SDLC described in [AI-SDLC.md](AI-SDLC.md). Read it for the stages, triggers and roles before starting work.

- Intents go in `intent/` (use the `capture-intent` skill). Only the product owner accepts one.
- Specs are written by the `write-spec` GitHub Action when an intent is merged to `main`. Do not run `/write-spec` locally unless the Action is unavailable.
- Specs must respect the `project-standards` skill.
- Never push without human approval.
