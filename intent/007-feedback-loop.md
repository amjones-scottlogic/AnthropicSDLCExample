# Intent: Give Claude a feedback loop
Author: Andrew Jones (originator and sole user). Status: draft.

## Problem
Claude can run lint, typecheck, test and build here, but nothing tells it to do so before it says a piece of work is done, or what a pass looks like. `CLAUDE.md` lists the commands and CI runs them, so a red build is usually found after the work is handed over rather than by Claude itself. Claude can also make a failing test pass by changing the test instead of the code, and nothing stops that. For the UI there is no way for Claude to look at what it has built, so visual problems are only found when I open the app.

This comes from the "Give Claude a feedback loop" lesson in the AI-native SDLC playbook.

## Proposed outcome
- **Verification in `CLAUDE.md`.** A verification block that says what each check is, what a pass looks like, and that Claude runs them and reports the real output before it says work is done. The definition of done points at it. A single `npm run verify` that runs all the checks and exits non-zero on any failure.
- **Protected tests.** Claude cannot quietly weaken an existing test to get a green run. For a bug fix, the rule is: write a failing test first, then fix the code without changing that test. A plan can name a test to unlock it for changes. How this is enforced (a hook, a review rule, or both) is decided in the spec.
- **Playwright E2E tests with screenshots.** Playwright is added with support for taking screenshots, so Claude can look at the running app and check UI work against it. Screenshots are a working tool for Claude, not reference images kept in the repo. CI runs the Playwright tests in headless mode. E2E tests are used sparingly: only for the few journeys that unit tests cannot cover, not as the default way to test a change.

## Affected users and systems
- Users: just me, and Claude when it writes or reviews code here.
- Systems: `CLAUDE.md`, `package.json` scripts, `.claude/hooks/` and `.claude/settings.json`, the `plan` skill and `plan-reviewer` agent (where they mention testing), the `.github/workflows/ci.yml` pipeline, and a new Playwright setup with its tests.

## Constraints
- Keep it simple: no extra tooling beyond Playwright.
- Browser-only with no backend and no external hosts, as in `project-standards`; the E2E tests run against the built or dev app locally.
- Accessibility lint rules (jsx-a11y) stay on.
- No hook runs the checks at the end of every Claude turn; verification is run as part of finishing the work.
- E2E tests are sparing by design, so the suite stays small and quick.
- Must not contradict `project-standards`, `src-structure` or the coding standards.

## Open questions
- **Test protection:** which files are protected (all unit tests and E2E tests, or a narrower set)? The spec decides this along with how it is enforced.
