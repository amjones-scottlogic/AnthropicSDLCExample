# AI-SDLC

How the AI-native SDLC runs in this project: the stages, what triggers each one, and who does what. Metrics are at the end.

## Stages

### Plan
- **Trigger:** an originator has an idea or problem.
- **Role:** the originator brainstorms with Claude and reviews the result. The product owner accepts it into Design or closes it.
- **Outcome:** a committed intent in the originator's own words.

### Design
- **Trigger:** the product owner accepts an intent.
- **Role:** Claude drafts requirements and design together, constrained by the project standards and flagging concerns. The product owner reviews the draft, resolves flagged concerns, and decides whether it goes to Build.
- **Outcome:** a committed spec, reviewed through a pull request.
- **Automation:** the `write-spec` GitHub Action writes the spec and opens the pull request when an intent is merged to `main`.

### Build
- **Trigger:** the product owner approves a spec.
- **Role:** the engineer starts Claude in plan mode with the intent and spec, and asks for an implementation plan naming the files to change, the order of work and the tests that validate it. The engineer interrogates the plan (what could break, what are the risks, what are the alternatives) and iterates until someone who was not in the conversation could execute it. The engineer approves the plan before any code changes. A tech lead or architect also reviews higher-risk changes; routine ones are engineer-approved. Claude then implements the plan. A reviewer later checks the merged diff against the committed plan.
- **Outcome:** an approved plan (`plan/NNN-*.md`) committed alongside the code, kept in sync if implementation diverges, and a change that merges in a single pass.
- **Automation:** the `plan` skill writes the plan. The `plan-sync` hook blocks a `git commit` that changes implementation files without also changing the plan, unless the message carries a `Plan-Checked:` trailer confirming the plan still matches.
- **Context:** `CLAUDE.md` is committed at the repo root and read by Claude at the start of every session. It holds the build, test and lint commands, team conventions, an architecture overview and a list of common mistakes. It stays under one page. When Claude repeats a mistake twice, the engineer adds a line to it. Changes go through the normal pull request, so the instructions stay reviewable and auditable in git history.
- **Note:** as guardrails mature (a refined `CLAUDE.md`, encoded policies, automated hooks), auto mode becomes appropriate for routine, lower-risk changes. Plan mode stays the default for changes with unclear scope or several implementation paths.

### Deploy
- **Trigger:** a push to the remote.
- **Role:** a human approves every push.
- **Outcome:** nothing is released without a human decision.

## Metrics

Definitions only. Each stage has a leading and a lagging metric, measured from git history where possible.

| Stage | Leading | Lagging |
|---|---|---|
| Plan | Time from first conversation to the intent being committed | Share of intents accepted into Design; edits to an intent after its spec is committed |
| Design | Time from the intent commit to the spec commit | Spec commits after the first plan commit for the same change |
| Build | Share of changes that merge on the first implementation; time from plan approval to merged PR; time to first merged PR for a new team member | Rework cycles per change; how often the merged diff still matches the committed plan; how often Claude repeats a mistake already listed in `CLAUDE.md` |
| Deploy | To be defined | To be defined |
