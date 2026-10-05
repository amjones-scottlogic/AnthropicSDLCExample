# CLAUDE.md

This project follows the AI-native SDLC described in [AI-SDLC.md](AI-SDLC.md). Read it for the stages, triggers and roles before starting work.

- Intents go in `intent/` (use the `capture-intent` skill). Only the product owner accepts one.
- Specs are written by the `write-spec` GitHub Action when an intent is merged to `main`. Do not run `/write-spec` locally unless the Action is unavailable.
- Build starts from an approved spec: use the `plan` skill in plan mode and get the plan approved before changing code. If implementation departs from the plan, update the plan in the same commit (the `plan-sync` hook enforces this).
- Specs must respect the `project-standards` skill.
- Never push without human approval.

## Commands

Requires Node 22 and npm.

- `npm run dev`: serve locally with hot reload
- `npm test`: run the Vitest suite once
- `npm run lint`: ESLint, including jsx-a11y rules
- `npm run typecheck`: TypeScript strict-mode check
- `npm run build`: build static files into `dist/`

CI runs lint, typecheck, test and build on every PR; make all four pass before asking for review.

## Conventions

- TypeScript strict mode; React function components.
- Tests sit next to the code they cover (`App.tsx` / `App.test.tsx`), using Vitest and Testing Library. Shared test setup is in `src/test/`.
- Accessibility is enforced by lint (jsx-a11y); don't disable those rules.
- Browser-only: no backend, data stays on the user's device (see the `project-standards` skill).

## Architecture

- `src/`: the React app (`main.tsx` entry, `App.tsx` root).
- `intent/`, `spec/`, `plan/`: SDLC artefacts, numbered `NNN-*.md` so each intent, spec and plan pair up.
- `.claude/`: skills and hooks (`push-gate`, `plan-sync`).
- `dist/` is build output; never edit it.

## Common mistakes

Add a line here each time Claude repeats a mistake twice.

- (none yet)
