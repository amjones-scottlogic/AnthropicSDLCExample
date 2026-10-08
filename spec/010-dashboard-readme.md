# Spec: Document how to run the metrics dashboard in the README
Intent: [intent/010-dashboard-readme.md](../intent/010-dashboard-readme.md). Status: draft.

## Summary
The AI-SDLC metrics dashboard (intent 005) is documented only in `grafana/README.md`, so a reader of the project `README.md` would not know it exists. This adds a short dashboard section to the project README that says what the dashboard is, what it needs, how to start, stop and load data into it, where to open it, and the first-time setup, and points to `grafana/README.md` as the place the full steps live. It is documentation only: nothing about how the dashboard works changes.

## Requirements

1. **Findable.** The project `README.md` has a section about the metrics dashboard, with a heading that names it (for example "Metrics dashboard").
   - Acceptance: reading the README top to bottom, a new reader meets the section and learns what the dashboard shows and that it is local to their machine.
2. **Enough to run it.** The section covers, briefly:
   - what it needs installed (Docker Desktop, the `gh` CLI, and Node/npm already required by the README);
   - how to start and stop it, and how to load data (the `npm run metrics:up`, `metrics:down` and `metrics:collect` commands);
   - where to open it (`http://127.0.0.1:3000`, the **AI-SDLC metrics** dashboard).
   - Acceptance: every command and URL named in the section matches `package.json` and `grafana/README.md`.
3. **First-time setup.** The section covers Docker Desktop, `gh auth login`, and changing the Grafana admin password (before anything else, since a fresh Grafana uses a well-known default).
   - Acceptance: all three are present, and the password step says to change it on first sign-in.
4. **One home for the steps.** The section links to `grafana/README.md` for the full steps and behaviour and says that is where they are kept. It does not restate the "How it behaves" notes.
   - Acceptance: the link resolves, and the README contains no dashboard detail beyond requirements 1 to 3 and 5.
5. **Describes the dashboard as it is.** The section says collection is run by hand and nothing is scheduled, so data is only as fresh as the last `metrics:collect`.
   - Acceptance: no wording implies automatic or nightly refresh.
6. **Documentation only.** No change to `grafana/`, `scripts/`, `package.json`, `src/` or any test.
   - Acceptance: the diff touches `README.md` and the SDLC artefacts (spec, plan) only.
7. **Followable end to end.** A reader who has never seen the project can get from the README to a running dashboard using only the README and the page it links to.
   - Acceptance: walked through once by hand on a clean read, with any gap fixed in the docs.

## Design
- Add one `##` section to `README.md`, placed after "Getting started", since it is a second way to run something locally and uses the same Node/npm prerequisite. It is short: a one-sentence description, a prerequisites list, a three-row command table, the URL, the first-time setup as a short list, and the pointer to `grafana/README.md`.
- Commands and the URL are copied from `grafana/README.md`, which stays the source. If they ever change there, this section is the copy to update, which is why the section stays small and why requirement 4 forbids restating behaviour.
- Link with a relative path (`grafana/README.md`) so it works on GitHub and locally.
- Nothing is added to the app, the build or CI, so the `project-standards` constraints are unaffected: no new network calls, no data handling, no UI.
- No automated test fits prose. Verification is the manual walk-through in requirement 7, plus `npm run verify` to show nothing else moved.

## Out of scope
- Any change to how the dashboard works, its setup, or `grafana/README.md` itself.
- Scheduling collection (intent 005 deliberately left it manual).
- Bringing the rest of the README up to date. Its "Getting started" and "Status" sections are out of step with the repo (no mention of `test:e2e`, `verify`, `grafana/`, `plan/`). Only the dashboard section is in scope.

## Open questions
None carried forward from the intent. One new one is under Flagged concerns.

## Flagged concerns

- **The intent asks for both detail and a pointer.** It wants the README to explain needs, start/stop, data loading, URL and first-time setup, and also to "point to `grafana/README.md` for the steps, so they live in one place". Those pull apart: any command written in the README is a second copy. This spec resolves it by keeping the README to a brief summary (the commands and setup items by name) and treating `grafana/README.md` as the authority for steps and behaviour. If the product owner wants no duplicated commands at all, the README section shrinks to a description, prerequisites and the link, and requirement 2 is only partly met by the README itself. Please confirm which.
- **Copy can drift.** Even a brief copy of commands can fall out of date when `grafana/README.md` changes. Nothing checks it. Accepted as a small risk given the section's size; a test or generated section would be disproportionate.
