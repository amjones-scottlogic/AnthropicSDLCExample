# Plan: Document how to run the metrics dashboard in the README
Spec: [spec/010-dashboard-readme.md](../spec/010-dashboard-readme.md). Intent: [intent/010-dashboard-readme.md](../intent/010-dashboard-readme.md). Status: approved.

## Approach
Add one `##` section, "Metrics dashboard", to the project `README.md`, after "Getting started". It is prose only: what the dashboard shows and that it is local, the prerequisites, a line saying first-time setup is needed (Docker Desktop, `gh auth login`, changing the Grafana admin password first), a line saying collection is run by hand, and a relative link to `grafana/README.md` for every step. Per the spec, it contains no `npm run metrics:*` commands, no URL and none of the "How it behaves" notes, so `grafana/README.md` stays the only copy of the steps. Nothing else changes.

## Files
Change:
- `README.md`: add the "Metrics dashboard" section after "Getting started".

Create:
- `plan/010-dashboard-readme.md`: this plan, committed first.

Not touched: `grafana/`, `scripts/`, `package.json`, `src/` (so `src-structure` does not apply), `e2e/`, `.github/`, `.claude/`, `CLAUDE.md`, `AI-SDLC.md`, `intent/`, any test. The rest of the README is left as it is (spec: out of scope).

## Order of work
Each step leaves the project working.
1. **Plan.** On `build/010-dashboard-readme` (cut from `main`, with the spec already marked approved in commit `81acb1c`), save this plan as `plan/010-dashboard-readme.md` with `Status: approved` and commit it alone.
2. **Write the section (Req 1 to 5).** Edit `README.md`:
   - Heading `## Metrics dashboard`, placed between "Getting started" and "Deployed app".
   - One sentence: a local Grafana dashboard over the AI-SDLC metrics comments on pull requests; it runs on your machine only and is not part of the published app.
   - Needs: Docker Desktop, the `gh` CLI signed in to GitHub, and Node/npm (as above).
   - First-time setup: name the three items, and say the Grafana admin password is changed first.
   - Collection is run by hand and nothing is scheduled, so data is only as fresh as the last collection.
   - Link: "Steps for starting, stopping, loading data and opening it are in [grafana/README.md](grafana/README.md)."
3. **Check the wording (Req 2, 3, 4, 5, 6).** Search `README.md` for `metrics:` and `127.0.0.1` (expect no matches). Compare each prerequisite and setup item with the "One-off setup" list in `grafana/README.md`. Run `git diff --stat main` and confirm only `README.md` and `plan/010-dashboard-readme.md` changed (plus the spec approval commit).
4. **Walk it through (Req 7).** Read the README as a newcomer, follow the link, and confirm `grafana/README.md` gets them to a running dashboard. Fix any gap in the docs; if the fix would mean editing `grafana/README.md`, stop and ask, because the spec puts it out of scope.
5. **Verify.** Run `npm run verify` and report its real output.

## Parallel work
None. One file changes, and the steps depend on each other.

## Tests
No automated test fits prose, and the spec says so. No existing test is changed, so no test needs unlocking. Done means:
- Req 1: the section exists and is findable in the README. Checked by reading it (step 4).
- Req 2, 3: prerequisites and setup items match `grafana/README.md`. Checked by comparison (step 3).
- Req 4: `grep` for `metrics:` and `127.0.0.1` in `README.md` finds nothing; the link resolves (relative path to an existing file).
- Req 5: no wording implies automatic or nightly refresh. Checked by reading.
- Req 6: `git diff --stat main` shows only `README.md` and the plan, apart from the spec approval.
- Req 7: the walk-through in step 4.
- Everything else: `npm run verify` passes (lint, typecheck, test, build, check:offline, test:e2e).

## Risks
- **Highest risk: drift.** The prerequisite and setup list is also in `grafana/README.md` and nothing checks they match. Contained by keeping the list to names only and comparing it in step 3.
- **Leaking steps into the README.** Easy to add a command or the URL "to be helpful"; that breaks Req 4. Contained by the grep in step 3.
- **Metrics comment.** `README.md` is classified as a non-stage file by `capture-metrics` (`stagesFor(['README.md'])` returns nothing), so the PR may show few stage rows. Expected, not a fault.
- `plan-sync` only blocks commits that change implementation files; a `.md`-only commit is not affected.

## Alternatives rejected
- **Restate the commands and URL in the README.** Gives a faster start but two copies to maintain. Rejected by the product owner in the spec.
- **Put the section near the top.** The dashboard is secondary to the todo app, and it shares the Node/npm prerequisite with "Getting started", so it sits after it.
- **A test that checks the README against `grafana/README.md`.** Disproportionate for a short list of names (spec, flagged concerns).

## Open questions
None.

## Deviations
None.
