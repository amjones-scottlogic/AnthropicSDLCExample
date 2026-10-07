# Plan: Give Claude a feedback loop
Spec: [spec/007-feedback-loop.md](../spec/007-feedback-loop.md). Intent: [intent/007-feedback-loop.md](../intent/007-feedback-loop.md). Status: approved.

## Approach
Build it in the order the pieces depend on each other: Playwright and the `verify` script first, so there is one command to prove each later step; then the first E2E journey and the screenshot helper; then the `test-guard` hook; then CI; then the written guidance in `CLAUDE.md` and the skills. The hook is built after the E2E files exist but is installed with the plan unlocking them by path, so it never blocks the work it ships with. E2E runs against `vite preview` of the built `dist/`, the same artefact CI deploys. Where the spec's CI design says E2E runs before `check:offline` but requirement 1 puts `check:offline` first, this plan follows requirement 1 in both `verify` and CI so they match.

## Files
Create:
- `playwright.config.ts`: Chromium project only; `testDir: 'e2e'`, `testMatch: '**/*.e2e.ts'`; `outputDir: 'test-results/artifacts'`; `use.screenshot: 'only-on-failure'`; `use.baseURL: 'http://localhost:4173/AnthropicSDLCExample/'`; `webServer` runs `npm run preview -- --port 4173 --strictPort` against `baseURL`, `reuseExistingServer: !process.env.CI`; `forbidOnly` on CI, `retries: 0`.
- `e2e/tracker.e2e.ts`: the first journey (see Tests).
- `e2e/helpers/screenshot.ts`: `takeScreenshot(page, name)` saves a full-page PNG to `test-results/screenshots/<name>.png`.
- `tsconfig.e2e.json`: strict, `lib` ES2023 and DOM, `types: ["node"]`, includes `e2e` and `playwright.config.ts`.
- `.claude/hooks/test-guard.sh`: the protected-test hook.
- `.claude/hooks/test-guard.test.sh`: runs the hook against sample hook JSON in a throwaway git repo and checks allow/deny; run by hand, not in CI.

Change:
- `package.json` / `package-lock.json`: add dev dependency `@playwright/test`; scripts `test:e2e` (`playwright test`) and `verify` (`npm run lint && npm run typecheck && npm test && npm run build && npm run check:offline && npm run test:e2e`); `typecheck` also runs `tsc --noEmit -p tsconfig.e2e.json`.
- `tsconfig.json`: add `./tsconfig.e2e.json` to `references`.
- `vite.config.ts`: `test.exclude` is the Vitest defaults plus `e2e/**` (import `configDefaults` from `vitest/config`).
- `eslint.config.js`: add `test-results` and `playwright-report` to `ignores`.
- `.gitignore`: add `test-results/` and `playwright-report/`.
- `.claude/settings.json`: add a second `PreToolUse` entry, matcher `Edit|Write`, running `test-guard.sh`.
- `.github/workflows/ci.yml`: in the `ci` job, after `npm run check:offline`, add `npx playwright install --with-deps chromium` and `npm run test:e2e`.
- `CLAUDE.md`: Commands gain `verify` and `test:e2e` plus the one-off `npx playwright install chromium`; new Verification section (requirement 2); Conventions note that E2E tests are `e2e/*.e2e.ts` and used sparingly; Architecture lists `e2e/`.
- `.claude/skills/plan/SKILL.md`: the Tests section of the template says to name any existing test the plan will change (this unlocks it), and to cover a bug fix with a failing test first; E2E only for what unit tests cannot cover.
- `.claude/agents/plan-reviewer.md`: add checks that any protected test changed is named in the plan, no test was weakened to pass, and any new E2E test is justified as sparing.
- `.claude/skills/src-structure/SKILL.md`: add a short "Outside `src/`" note: `e2e/` holds Playwright tests and helpers for the whole built app.

Not touched: app code under `src/`, existing unit tests, `dist/`, `intent/`, `spec/`, `scripts/check-offline.mjs`.

## Order of work
Each step leaves the project working.
1. **Branch and plan.** `git switch -c build/007-feedback-loop`; commit this plan with `Status: approved`, alone.
2. **Playwright and `verify` (Req 1, 4).** `npm i -D @playwright/test`, `npx playwright install chromium`. Add `playwright.config.ts`, `tsconfig.e2e.json` and its reference, the Vitest exclude, the ESLint ignores, `.gitignore` entries, and the `test:e2e`, `typecheck` and `verify` scripts. With no E2E file yet, `npx playwright test --list` shows no tests and `npm test` is unchanged.
3. **Screenshot helper and first journey (Req 4, 5, 7).** Add `e2e/helpers/screenshot.ts` and `e2e/tracker.e2e.ts`. Run `npm run build && npm run test:e2e`, then `npm run verify` end to end.
4. **Test guard (Req 3).** Write `test-guard.sh`, then `test-guard.test.sh`, and make the cases pass. Register the hook in `settings.json` last, so the hook is not live while it is being written.
5. **CI (Req 6).** Add the two steps to `ci.yml`.
6. **Guidance (Req 2, 8).** Edit `CLAUDE.md`, the `plan` skill, `plan-reviewer` and `src-structure`.
7. **Prove it.** Run `npm run verify`. Run the negative checks under Tests. Run the `plan-reviewer` agent on the diff and fix its must-fix items.
8. **Push** only with human approval. The CI run on the PR is the proof for Req 6.

## Parallel work
None. The steps share `package.json`, `CLAUDE.md`, `settings.json` and `ci.yml`, and the whole change is small enough that splitting costs more than it saves.

## Tests
Unit tests are unchanged and must still pass. New E2E test and checks:

- **`e2e/tracker.e2e.ts`, one journey (Req 4, 5, 7).** Open the app, create the first workstream "Work" and add two actions, tick one as done, take a screenshot named `tracker-after-actions`, reload the page, and check the workstream, both actions and the done state are still there. This needs a real browser because it relies on `localStorage` surviving a reload, which jsdom cannot show. It also:
  - records every request the page makes and asserts none is to a host other than `localhost` (Req 7);
  - checks `test-results/screenshots/tracker-after-actions.png` exists afterwards (Req 5).
- **`e2e/` is the only place for E2E (Req 4).** `npm test` output lists no `e2e/` files, and `npx playwright test --list` lists only `*.e2e.ts` tests.
- **`.claude/hooks/test-guard.test.sh` (Req 3).** In a throwaway repo, with the hook fed sample `Edit` and `Write` JSON, including a Windows-style path with escaped backslashes:
  - tracked `*.test.ts`, `*.test.tsx` and `e2e/` file, no plan naming it: denied;
  - same file, an approved plan names its path: allowed;
  - same file, a plan with `Status: draft` names it: denied;
  - new untracked test file: allowed;
  - a non-test file such as `src/App.tsx`: allowed;
  - unparseable input: allowed (fails open).
- **Negative checks (Req 1, 5, 6), run by hand and not committed.**
  - Make the journey assert something false: `npm run verify` exits non-zero at `test:e2e`, and a failure screenshot appears under `test-results/artifacts`.
  - Make a lint error: `verify` stops at lint and never builds.
  - Edit an existing unit test through Claude with no plan naming it: the hook denies it.

Done means: `npm run verify` passes from a clean clone after `npx playwright install chromium`; `test-guard.test.sh` passes; the negative checks behave as above; the PR's CI run, including Playwright, is green; and `plan-reviewer` has no must-fix findings.

## Risks
- **Highest risk: the `test-guard` hook.** It runs on every `Edit` and `Write`, so a bug could block all editing, or let everything through. It is contained by building it before registering it, testing it in a throwaway repo, failing open on input it cannot parse, and keeping the edit to `.claude/settings.json` as a single removable entry. Windows paths (escaped backslashes, `C:` versus `/c/`) are the likeliest trap, so a matching test case is required; the hook matches tracked files by path suffix to avoid depending on `CLAUDE_PROJECT_DIR` format.
- **The hook cannot see shell edits.** `sed` and similar bypass it. Accepted in the spec; `plan-reviewer` is the backstop.
- **CI time and browser install.** Installing Chromium with `--with-deps` adds time to every PR. Accepted; the suite stays at one journey.
- **Port clash.** `--strictPort` on 4173 fails loudly rather than testing the wrong server; locally `reuseExistingServer` could reuse a stale preview of an old build, so `verify` always builds first.
- **Base path.** The app is served under `/AnthropicSDLCExample/`, so the journey must navigate relative to `baseURL` (`page.goto('./')`), not `/`.
- **Playwright and lint.** Playwright's fixture callback style can trip `react-hooks` rules on a function called `use`; the journey avoids that name.
- **Hook protects its own files.** Once `e2e/*.e2e.ts` is committed, later edits to it are denied unless this approved plan names the path, which the Files section does.

## Alternatives rejected
- **A `Stop` hook running `verify` each turn:** the intent rules it out as too slow.
- **A separate CI job for E2E:** more YAML and a second `npm ci`; one ordered job matches `verify`.
- **Protecting tests by review rule only:** the failure happens mid-session, before a reviewer sees it.
- **Protecting tests with `chmod` or a git pre-commit hook:** `chmod` is awkward on Windows, and a pre-commit hook fires after the edit rather than preventing it.
- **E2E tests inside `src/`:** they cover the whole built app, not one domain, and `src-structure` is organised by domain.
- **Playwright against `npm run dev`:** tests would not match the built, deployed artefact.
- **Reference screenshots and visual diffs:** ruled out by the intent.

## Open questions
None.

## Deviations
None.
