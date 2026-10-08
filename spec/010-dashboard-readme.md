# Spec: Document how to run the metrics dashboard in the README
Intent: [intent/010-dashboard-readme.md](../intent/010-dashboard-readme.md). Status: approved.

## Summary
The AI-SDLC metrics dashboard (intent 005) is documented only in `grafana/README.md`, so a reader of the project `README.md` would not know it exists. This adds a short dashboard section to the project README that says what the dashboard is, what it needs, and that first-time setup is required, and sends the reader to `grafana/README.md` for every step. The steps and commands live only there. It is documentation only: nothing about how the dashboard works changes.

## Requirements

1. **Findable.** The project `README.md` has a section about the metrics dashboard, with a heading that names it (for example "Metrics dashboard").
   - Acceptance: reading the README top to bottom, a new reader meets the section and learns what the dashboard shows and that it is local to their machine.
2. **Says what it needs.** The section lists what must be in place: Docker Desktop, the `gh` CLI signed in to GitHub, and Node/npm (already required by the README).
   - Acceptance: each prerequisite matches the one-off setup in `grafana/README.md`.
3. **Flags first-time setup.** The section says there is one-off setup (Docker Desktop, `gh auth login`, and changing the Grafana admin password, which must be done first because a fresh Grafana uses a well-known default) and that `grafana/README.md` has the steps.
   - Acceptance: all three items are named, and the section does not tell the reader to skip or defer the password change.
4. **One home for the steps.** The section links to `grafana/README.md` for how to start, stop, load data and open the dashboard, and says that is where they are kept. It contains no `npm run metrics:*` commands, no URL and none of the "How it behaves" notes.
   - Acceptance: the link resolves, and a search of the README for `metrics:` and `127.0.0.1` finds nothing.
5. **Describes the dashboard as it is.** The section says collection is run by hand and nothing is scheduled, so data is only as fresh as the last collection.
   - Acceptance: no wording implies automatic or nightly refresh.
6. **Documentation only.** No change to `grafana/`, `scripts/`, `package.json`, `src/` or any test.
   - Acceptance: the diff touches `README.md` and the SDLC artefacts (spec, plan) only.
7. **Followable end to end.** A reader who has never seen the project can get from the README to a running dashboard using only the README and the page it links to.
   - Acceptance: walked through once by hand, with any gap fixed in the docs.

## Design
- Add one `##` section to `README.md`, placed after "Getting started", since it is a second way to run something locally and shares the Node/npm prerequisite. It is a short paragraph, a prerequisites list, a line on first-time setup, a line on manual collection, and the link.
- Commands and the URL are deliberately left out so there is one copy to maintain. `grafana/README.md` is the single source; this section has nothing to drift except the prerequisite list.
- Link with a relative path (`grafana/README.md`) so it works on GitHub and locally.
- Nothing is added to the app, the build or CI, so the `project-standards` constraints are unaffected: no new network calls, no data handling, no UI.
- No automated test fits prose. Verification is the manual walk-through in requirement 7, plus `npm run verify` to show nothing else moved.

## Out of scope
- Any change to how the dashboard works, its setup, or `grafana/README.md` itself.
- Scheduling collection (intent 005 deliberately left it manual).
- Bringing the rest of the README up to date. Its "Getting started" and "Status" sections are out of step with the repo (no mention of `test:e2e`, `verify`, `grafana/`, `plan/`). Only the dashboard section is in scope.

## Open questions
None.

## Flagged concerns

- **Intent bullets 1 and 3 pull apart.** The intent asks the README to explain how to start, stop, load data and open the dashboard, and also to point to `grafana/README.md` so the steps live in one place. At the product owner's direction this spec follows the pointer: the README names what is needed and where the steps are, and does not restate commands or the URL. So the README alone does not say how to start the dashboard; the reader has to follow the link. Intent 010 still lists those items as README content and was not edited.
- **Prerequisite list can drift.** The README names Docker Desktop, `gh` and the password change, which are also in `grafana/README.md`. Nothing checks they match. Accepted as a small risk.
