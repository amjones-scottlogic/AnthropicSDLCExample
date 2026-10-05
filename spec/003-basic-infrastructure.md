# Spec: Basic infrastructure for building and deploying the todo app
Intent: [intent/003-basic-infrastructure.md](../intent/003-basic-infrastructure.md). Status: approved.

## Summary
A working base for the project so the todo app (intent 001) can be built, checked and published: a React application skeleton, test tooling, a CI workflow that builds and tests every change, and automated deployment to GitHub Pages. It exists because the repo has no framework, tests, CI or hosting yet. It adds no todo features.

## Requirements

1. **Application skeleton.** The repo contains a React app that builds to static files and shows a placeholder page.
   - `npm install` then `npm run build` succeeds from a clean checkout and produces a static `dist/` folder.
   - `npm run dev` serves the app locally.
   - The source is TypeScript in strict mode, and `npm run typecheck` fails on a type error.
   - The built output needs no server beyond static file hosting.
2. **Test tooling.** Unit and component tests can be written and run.
   - `npm test` runs the suite once and exits non-zero on any failure.
   - The repo includes a passing smoke test that renders the placeholder page and checks its content.
   - Component tests can find controls by accessible role and label.
3. **Accessibility lint.** Common accessibility mistakes in React markup are caught automatically.
   - `npm run lint` fails on a violation, for example an input with no label.
4. **CI.** Every pull request and every push to `main` is built and checked.
   - The workflow runs lint, typecheck, tests and build, and fails if any step fails.
   - It runs without secrets.
5. **Deployment.** A merge to `main` publishes the built app to GitHub Pages.
   - Deployment only runs after lint, typecheck, tests and build pass.
   - The published page loads at the Pages URL with its assets, so the base path is correct.
   - Pull requests do not deploy.
6. **Stable address.** The Pages URL is documented in the README and does not change unless the repo is renamed or moved.
7. **Standards hold.** The setup does not undermine the project standards.
   - The built app makes no network calls at runtime, including to CDNs, web fonts or analytics. All dependencies are bundled.
   - No backend or server-side code is added.
8. **Merge gate.** A change cannot be merged to `main` unless the CI checks are green, but the repository owner can override this.
   - `main` is protected with the CI workflow as a required status check.
   - The owner can bypass the rule in a deliberate, visible way (for example an admin bypass), so a broken pipeline never locks the repo.
9. **Documented.** The README states how to install, run, test, build and where the app is deployed.

## Design

- **Build tool and framework:** Vite with React, in TypeScript (strict mode) from the start, using Vite's `react-ts` template. Vite is the common, minimal way to get a static React build and a dev server. TypeScript is used from the start because retrofitting it later is costlier. Vite only strips types, so `tsc --noEmit` runs separately as the typecheck.
- **Test tooling:** Vitest with React Testing Library and jsdom. Vitest shares Vite's config, so there is no second build pipeline. Testing Library queries by role and label, which nudges tests towards accessible markup and suits requirement 8 of the todo spec.
- **Lint:** ESLint with the TypeScript, React and `jsx-a11y` plugins. This is the automated half of the accessibility standard; contrast and keyboard use still need manual checks.
- **Scripts:** `dev`, `build`, `test`, `lint`, `typecheck` in `package.json`, so CI and a developer run the same commands.
- **CI:** one GitHub Actions workflow, `ci.yml`, triggered on `pull_request` and on push to `main`. It checks out, installs with `npm ci`, then runs lint, typecheck, test and build. Node version is pinned in the workflow.
- **Deployment:** a deploy job in the same workflow, or a second workflow, that runs on push to `main` only, after the checks pass. It uploads `dist/` with the official Pages actions (`upload-pages-artifact`, `deploy-pages`) using the Pages "GitHub Actions" source. The trigger is a merge to `main` because that is the one reviewed, human-approved path to production.
- **Base path:** the app is served at `https://<owner>.github.io/<repo>/`, so Vite's `base` is set to `/<repo>/`. Without this, assets 404 on Pages.
- **No router:** consistent with spec 001, so no single-page-app fallback or 404 rewrite is needed on Pages.
- **Dependencies:** all installed from npm and bundled at build time. No runtime CDN links or remote fonts, which keeps the no-external-calls standard.
- **Merge gate:** a branch protection rule (or ruleset) on `main` requiring the CI workflow's check to pass before merging, with the owner allowed to bypass it. The bypass keeps the gate a safeguard rather than a lock. Unlike the workflow files, this is a repository setting, so it is set up by hand.
- **Manual one-offs:** Pages must be enabled in the repository settings with "GitHub Actions" as the source, and the merge gate above must be configured. Neither can be done from code. They are one-off setup steps, so they are recorded in the plan and pull request that introduce the infrastructure, not in the README.

## Out of scope

- Any todo app feature (intent 001).
- Metrics or the AI-SDLC tooling (intent 002).
- A custom domain, preview deployments for pull requests, or multiple environments.
- Required reviews or other branch rules beyond the CI check.
- Coverage thresholds, end-to-end browser tests, and automated contrast checks.
- Dependency update automation and security scanning.

## Open questions

None. The intent's questions are answered and closed:

- **Technology:** Vite, React, TypeScript, Vitest, React Testing Library, ESLint with `jsx-a11y` (see Design).
- **Deployment trigger:** a push to `main`, after checks pass.
- **Pages URL:** the project site URL derived from the repo name, `https://amjones-scottlogic.github.io/AnthropicSDLCExample/`. It is fixed as long as the repo name and owner stay the same (see flagged concerns).

## Flagged concerns

- **Origin is tied to the repo name.** localStorage is bound to the origin, and the Pages URL includes the repo name. Renaming or moving the repo changes the origin and strands existing data. The URL should be treated as fixed before real data is stored; this spec records it but cannot prevent a rename.
- **Local copy is a different origin.** `npm run dev` and the hosted site use different origins, so data entered in one will not appear in the other. Worth knowing, not a defect.
