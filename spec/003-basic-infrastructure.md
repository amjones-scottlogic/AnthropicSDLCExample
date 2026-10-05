# Spec: Basic infrastructure for building and deploying the todo app
Intent: [intent/003-basic-infrastructure.md](../intent/003-basic-infrastructure.md). Status: draft.

## Summary
A working base for the project so the todo app (intent 001) can be built, checked and published: a React application skeleton, test tooling, a CI workflow that builds and tests every change, and automated deployment to GitHub Pages. It exists because the repo has no framework, tests, CI or hosting yet. It adds no todo features.

## Requirements

1. **Application skeleton.** The repo contains a React app that builds to static files and shows a placeholder page.
   - `npm install` then `npm run build` succeeds from a clean checkout and produces a static `dist/` folder.
   - `npm run dev` serves the app locally.
   - The built output needs no server beyond static file hosting.
2. **Test tooling.** Unit and component tests can be written and run.
   - `npm test` runs the suite once and exits non-zero on any failure.
   - The repo includes a passing smoke test that renders the placeholder page and checks its content.
   - Component tests can find controls by accessible role and label.
3. **Accessibility lint.** Common accessibility mistakes in React markup are caught automatically.
   - `npm run lint` fails on a violation, for example an input with no label.
4. **CI.** Every pull request and every push to `main` is built and checked.
   - The workflow runs lint, tests and build, and fails if any step fails.
   - It runs without secrets.
5. **Deployment.** A merge to `main` publishes the built app to GitHub Pages.
   - Deployment only runs after lint, tests and build pass.
   - The published page loads at the Pages URL with its assets, so the base path is correct.
   - Pull requests do not deploy.
6. **Stable address.** The Pages URL is documented in the README and does not change unless the repo is renamed or moved.
7. **Standards hold.** The setup does not undermine the project standards.
   - The built app makes no network calls at runtime, including to CDNs, web fonts or analytics. All dependencies are bundled.
   - No backend or server-side code is added.
8. **Documented.** The README states how to install, run, test, build and where the app is deployed.

## Design

- **Build tool and framework:** Vite with React, in plain JavaScript. Vite is the common, minimal way to get a static React build and a dev server. Plain JavaScript keeps the setup small; TypeScript can be added later if wanted.
- **Test tooling:** Vitest with React Testing Library and jsdom. Vitest shares Vite's config, so there is no second build pipeline. Testing Library queries by role and label, which nudges tests towards accessible markup and suits requirement 8 of the todo spec.
- **Lint:** ESLint with the React and `jsx-a11y` plugins. This is the automated half of the accessibility standard; contrast and keyboard use still need manual checks.
- **Scripts:** `dev`, `build`, `test`, `lint` in `package.json`, so CI and a developer run the same commands.
- **CI:** one GitHub Actions workflow, `ci.yml`, triggered on `pull_request` and on push to `main`. It checks out, installs with `npm ci`, then runs lint, test and build. Node version is pinned in the workflow.
- **Deployment:** a deploy job in the same workflow, or a second workflow, that runs on push to `main` only, after the checks pass. It uploads `dist/` with the official Pages actions (`upload-pages-artifact`, `deploy-pages`) using the Pages "GitHub Actions" source. The trigger is a merge to `main` because that is the one reviewed, human-approved path to production.
- **Base path:** the app is served at `https://<owner>.github.io/<repo>/`, so Vite's `base` is set to `/<repo>/`. Without this, assets 404 on Pages.
- **No router:** consistent with spec 001, so no single-page-app fallback or 404 rewrite is needed on Pages.
- **Dependencies:** all installed from npm and bundled at build time. No runtime CDN links or remote fonts, which keeps the no-external-calls standard.
- **Manual one-off:** Pages must be enabled in the repository settings with "GitHub Actions" as the source. This cannot be done from code and is listed in the README.

## Out of scope

- Any todo app feature (intent 001).
- Metrics or the AI-SDLC tooling (intent 002).
- A custom domain, preview deployments for pull requests, or multiple environments.
- Coverage thresholds, end-to-end browser tests, and automated contrast checks.
- Dependency update automation and security scanning.

## Open questions

Answered from the intent and standards:

- **Technology:** Vite, React, Vitest, React Testing Library, ESLint with `jsx-a11y`, plain JavaScript (see Design).
- **Deployment trigger:** a push to `main`, after checks pass.
- **Pages URL:** the project site URL derived from the repo name, `https://amjones-scottlogic.github.io/AnthropicSDLCExample/`. It is fixed as long as the repo name and owner stay the same (see flagged concerns).

New:

- **JavaScript or TypeScript?** This spec picks plain JavaScript for simplicity. Say if you would rather have TypeScript from the start; it is cheaper now than to retrofit.
- **Branch protection:** should `main` require the CI checks to pass before merge? This spec does not configure it, since it is a repository setting, but without it a failing change can still reach `main` and be deployed only if checks pass at deploy time.

## Flagged concerns

- **Pages availability.** GitHub Pages on a private repository needs a paid GitHub plan, and a Pages site may be publicly reachable depending on plan and settings. I could not check this repo's visibility or plan. If the repo is private on a free plan, deployment (requirement 5) cannot be satisfied as written. The data stays in each visitor's own browser either way, but the app itself would be public.
- **Origin is tied to the repo name.** localStorage is bound to the origin, and the Pages URL includes the repo name. Renaming or moving the repo changes the origin and strands existing data. The URL should be treated as fixed before real data is stored; this spec records it but cannot prevent a rename.
- **Local copy is a different origin.** `npm run dev` and the hosted site use different origins, so data entered in one will not appear in the other. Worth knowing, not a defect.
