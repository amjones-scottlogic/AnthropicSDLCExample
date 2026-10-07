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
- `npm run check:offline`: fail if the built HTML or CSS refers to an external host (run after build)
- `npm run test:e2e`: Playwright end-to-end tests against the built app (run `npm run build` first; one-off setup: `npx playwright install chromium`)
- `npm run verify`: every check above in order, stopping at the first failure

CI runs lint, typecheck, test, build, check:offline and test:e2e on every PR; make `npm run verify` pass before asking for review.

## Verification

Run `npm run verify` before you say any work is done, and report its real output, not what you expect it to say. If a check fails, fix the cause and run it again. Don't hand over work with a red check.

| Check | A pass looks like |
| --- | --- |
| `lint` | ESLint prints nothing and exits 0 |
| `typecheck` | the three `tsc` runs print nothing and exit 0 |
| `test` | Vitest ends with `Test Files N passed` and no failures |
| `build` | Vite ends with `built in` and writes `dist/` |
| `check:offline` | prints `No external URLs in built HTML or CSS.` |
| `test:e2e` | Playwright ends with `N passed` and no failures |

- Done means `npm run verify` passes.
- Bug fixes: write a failing test first and show that it fails, then fix the code without changing that test.
- Existing tests are protected: a hook blocks edits to them unless the approved plan names the test in its Tests section. Fix the code, not the test. The unlock only works on a `build/NNN-*` branch, where it reads `plan/NNN-*.md`; on any other branch every existing test stays protected.
- UI work: take a look at it. A test can call `takeScreenshot(page, 'name')` from `e2e/helpers/screenshot.ts`, then open `test-results/screenshots/name.png`. Screenshots are never committed.

## Conventions

- TypeScript strict mode; React function components.
- Tests sit next to the code they cover (`App.tsx` / `App.test.tsx`), using Vitest and Testing Library. Shared test setup is in `src/test/`.
- E2E tests are `e2e/*.e2e.ts` (Playwright). Use them sparingly, only for journeys a unit test cannot cover, such as data surviving a reload.
- Accessibility is enforced by lint (jsx-a11y); don't disable those rules.
- Browser-only: no backend, data stays on the user's device (see the `project-standards` skill).

## Architecture

- `src/`: the React app (`main.tsx` entry, `App.tsx` root), organised by domain. Follow the `src-structure` skill when adding or moving files.
- `intent/`, `spec/`, `plan/`: SDLC artefacts, numbered `NNN-*.md` so each intent, spec and plan pair up.
- `e2e/`: Playwright tests and helpers for the whole built app.
- `.claude/`: skills and hooks (`push-gate`, `plan-sync`, `test-guard`).
- `dist/` is build output; never edit it.

## Common mistakes

Add a line here each time Claude repeats a mistake twice.

- (none yet)
