# Spec: Give Claude a feedback loop
Intent: [intent/007-feedback-loop.md](../intent/007-feedback-loop.md). Status: draft.

## Summary
Make Claude check its own work before it hands anything over. `CLAUDE.md` says what each check is, what a pass looks like and what "done" means, and one `npm run verify` runs every check. Existing tests are protected from quiet edits. Playwright is added for a few end-to-end tests, with screenshot support so Claude can look at the running app. CI runs the same checks, including Playwright headless. It adds no app features.

## Requirements

1. **One verify command.** `npm run verify` runs lint, typecheck, unit tests, build, `check:offline` and the E2E tests, in that order.
   - It exits non-zero on the first failing check, and says which check failed.
   - A clean run exits zero.
2. **Verification in `CLAUDE.md`.** `CLAUDE.md` has a Verification section that:
   - lists each check with what a pass looks like;
   - defines done as `npm run verify` passing, run before Claude says work is complete;
   - tells Claude to report the real output of the run, not a summary of what it expects;
   - gives the bug-fix rule: write a failing test first, show it fails, then fix the code without changing that test.
3. **Protected tests.** Claude cannot edit an existing test file unless an approved plan names it.
   - Protected files: every git-tracked unit test (`*.test.ts`, `*.test.tsx`) and every tracked file under `e2e/`.
   - An edit to a protected file is denied, with a message saying the plan must name the file.
   - A file is unlocked when a `plan/*.md` on the current branch lists its path.
   - New test files are not protected until they are committed.
4. **Playwright E2E tests.** Playwright runs a small suite from `e2e/`, against the built app.
   - Chromium only, headless by default.
   - The suite covers only journeys a unit test cannot, for example data surviving a page reload.
   - It starts with one or two such journeys, and the plan lists them.
   - `npm test` (Vitest) does not pick up E2E files, and `npm run test:e2e` does not pick up unit tests.
5. **Screenshots for Claude.** A test helper saves a named screenshot of the page.
   - Screenshots go to a git-ignored folder and are never committed or compared against.
   - Claude can open the saved image to check how the UI looks.
   - Playwright also saves a screenshot when a test fails.
6. **CI.** The CI job runs the E2E tests headless after the build step, in the existing workflow.
   - It installs Chromium before running them.
   - A failing E2E test fails the job, and so blocks the deploy.
7. **Standards still hold.** The E2E setup adds no network calls to the app.
   - `check:offline` still passes on the build.
   - Lint, including jsx-a11y, covers the new files.
8. **Documented for the SDLC.** The `plan` skill and `plan-reviewer` agent are told to:
   - name any existing test a plan will change, which unlocks it;
   - check that E2E tests are used sparingly.

## Design

- **`verify` script.** An npm script in `package.json` that chains the existing scripts with `&&`, so it stops at the first failure and the failing script's own output shows which check it was. `test:e2e` is added to the chain last, since it is the slowest. Chaining existing scripts means CI and local runs cannot drift apart.
- **`CLAUDE.md`.** A new Verification section replaces nothing; the Commands list stays. The pass description for each check is one line (for example "Vitest ends with `Tests N passed`, no failures"). The bug-fix rule lives here and in the `plan` skill.
- **Test protection hook.** A new `.claude/hooks/test-guard.sh`, registered in `.claude/settings.json` as a `PreToolUse` hook with matcher `Edit|Write`, in the same style as `push-gate.sh` and `plan-sync.sh` (reads the hook JSON from stdin, no `jq`). It reads the target `file_path`. If the path matches a protected pattern and is tracked by git (`git ls-files --error-unmatch`), it looks for the path in `plan/*.md`; if it is not named, it returns a deny. Why a hook and not only a review rule: the failure it prevents happens mid-session, before any reviewer sees the diff. It is a guard against quiet weakening, not a security boundary: edits made through the shell (such as `sed`) are not caught, and `plan-reviewer` checks for them at review.
- **Playwright setup.**
  - `@playwright/test` is a dev dependency, with `playwright.config.ts` at the repo root.
  - Config: Chromium project only, `testDir: 'e2e'`, `screenshot: 'only-on-failure'`, and output to `test-results/`.
  - Server: `webServer` runs `npm run preview` and the config sets `baseURL` to the preview URL including the `/AnthropicSDLCExample/` base path. `test:e2e` expects `dist/` to exist; `verify` builds before it runs, and CI does the same.
  - Tests live in `e2e/` at the repo root, not in `src/`, because they test the whole built app, not one domain.
  - The `src-structure` skill is updated to mention `e2e/`.
- **Screenshot helper.** `e2e/helpers/screenshot.ts` exports a function taking the page and a name and writing `test-results/screenshots/<name>.png`. `test-results/` and Playwright's report folder are added to `.gitignore`. Keeping the helper under `e2e/` means it is a test tool and is not shipped in the app.
- **Keeping the runners apart.** Vitest config excludes `e2e/`. TypeScript and ESLint are extended to include `e2e/` (a `tsconfig` for it, or the node config extended) so typecheck and lint cover the new files. Playwright and Vitest share the `*.test.ts` and `*.spec.ts` naming problem, so E2E files use `*.e2e.ts`.
- **CI.** The existing `ci` job gets two steps after `npm run build`: `npx playwright install --with-deps chromium`, then `npm run test:e2e`. They run before `check:offline`, so the job stays one ordered list and the same as `verify`. No separate job, to keep the pipeline simple.

## Out of scope
- A hook that runs checks at the end of every Claude turn.
- Reference screenshots kept in the repo or visual-diff tests.
- Browsers other than Chromium, mobile emulation or cross-browser runs.
- Protecting files other than tests.
- Blocking shell edits to test files.
- A browser MCP server for Claude.
- Changes to the app's features, and any metrics work.

## Open questions
None. The intent's open question on which files are protected is answered in requirement 3.

## Flagged concerns
- **Hook coverage is partial.** The test-guard hook sees `Edit` and `Write` calls only. A test weakened through a shell command gets past it. This is accepted for a guard against quiet edits, and `plan-reviewer` is the second check, but the product owner should know it is not airtight.
- **`verify` gets slower.** It now builds and starts a browser, so it takes noticeably longer than the unit tests alone. This is why E2E stays small, and why `npm test` still runs alone for quick checks.
- **Playwright's browser download.** Installing Chromium fetches from outside this repo. It is dev and CI tooling only, so it does not break the "no external requests" standard, which covers the app. Worth confirming that reading.
- **`src-structure` is a skill the spec edits.** The skill says not to invent a new top-level layout under `src/`. `e2e/` is outside `src/`, so there is no conflict, but the skill needs the one-line mention.
