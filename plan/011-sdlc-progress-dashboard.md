# Plan: SDLC progress in the Grafana dashboard
Spec: [spec/011-sdlc-progress-dashboard.md](../spec/011-sdlc-progress-dashboard.md). Intent: [intent/011-sdlc-progress-dashboard.md](../intent/011-sdlc-progress-dashboard.md). Status: approved.

## Approach
Add a second collector beside the PR-metrics one. `scripts/collect-sdlc-stages.mjs` fetches `origin/main`, reads the files in `intent/`, `spec/` and `plan/` and the first-parent history with `git`, works out each item's stage with a pure `classify` function, and pushes one snapshot into the existing local Loki under its own job. A new entry point, `scripts/collect-all.mjs`, runs the existing `collect` and the new collector independently, and `npm run metrics:collect` points at it, so there is still one command. The existing `collect` function and its tests are not touched, which keeps the PR-metrics behaviour fixed. The dashboard gains a top section with a stage table, a count per stage and a "stages last loaded" panel, all reading the newest snapshot. Loki helpers are reused by exporting two functions, not copied.

## Files
Create:
- `plan/011-sdlc-progress-dashboard.md`: this plan, committed first.
- `scripts/collect-sdlc-stages.mjs`: `classify`, `builtItems`, `collectStages`; talks to `git` through an injected function, to Loki through the existing helpers.
- `scripts/collect-sdlc-stages.test.mjs`: unit tests (see Tests).
- `scripts/collect-all.mjs`: runs `collect` and `collectStages`, one failure does not stop the other, exits non-zero if either failed; keeps the `--loki <url>` option.
- `scripts/collect-all.test.mjs`: unit test for the above.

Change:
- `scripts/collect-metrics.mjs`: add `export` to `lokiFetch` and `push`. Nothing else.
- `package.json`: `metrics:collect` becomes `node scripts/collect-all.mjs`.
- `grafana/dashboards/ai-sdlc-metrics.json`: new "SDLC progress" row and three panels at the top, below "Last collector run"; every existing panel's `gridPos.y` moves down by the new section's height; new variable `sdlc_stage`.
- `grafana/dashboard.test.mjs`: **existing test, changed** (see Tests).
- `grafana/README.md`: `metrics:collect` now also loads the SDLC stages from `origin/main` and needs `git` and a reachable `origin`; describe the new panels and the stage rules.
- `spec/011-sdlc-progress-dashboard.md`: add the merge-commit form to the "built" rule (requirement 3 and Design), as decided with the product owner. Committed with the plan.

Not touched: `src/`, `e2e/`, `.github/`, `.claude/`, `CLAUDE.md`, `AI-SDLC.md`, `README.md` (its dashboard section only says setup is needed and collection is by hand, both still true), `scripts/collect-metrics.test.mjs`, `grafana/compose.yaml`, `grafana/provisioning/`.

## Order of work
Each step leaves the project working.
1. **Branch, plan, spec amendment.** Cut `build/011-sdlc-progress-dashboard` from `main`. Save this plan with `Status: approved`. Amend the spec's "built" rule: a first-parent commit on `origin/main` counts as the build of NNN if its subject starts `Build NNN`, or starts `Build` and ends `(spec NNN)`, or is `Merge pull request #N from <owner>/build/NNN-...`. Commit these together. (Satisfies the decision on 004 and 007; spec req 3.)
2. **Classifier, tests first (req 2, 3, 4).** Write `classify` tests in `collect-sdlc-stages.test.mjs` and see them fail. Then write `classify` and `builtItems` until they pass. Pure functions, no git, no Loki.
3. **Collector (req 1, 2, 4, 6, 7, 9).** Add `collectStages`:
   - `git fetch origin main`; on failure return exit code 1 with `git fetch failed: ...`.
   - Read `origin/main` only: `git ls-tree --name-only origin/main intent/ spec/ plan/`, `git show origin/main:<path>` for the first `Status:` word, `git log origin/main --first-parent --format=%H%x09%aI%x09%s` for the Build commits, and `git log origin/main --first-parent --diff-filter=A --format=%aI -- <path>` (oldest line) for the date a file first landed. Checked: this gives the merge date for a file that arrived in a merged PR.
   - Files that do not match `NNN-*.md` are listed in the run output, not dropped silently.
   - Push each row as one JSON line, `job="ai-sdlc-stages"`, label `stage` (`awaiting-spec`, `awaiting-plan`, `in-build`, `built`), body `run_id`, `main_commit`, `number`, `slug`, `stage_since`, `intent_status`, `spec_status`, `plan_status`. Timestamp is the run time.
   - Export the two Loki helpers in `collect-metrics.mjs` and import them here.
4. **One command (req 1).** Add `collect-all.mjs` and its test; point `metrics:collect` at it.
5. **Dashboard (req 5, 6, 7, 8).** Edit the dashboard JSON, then `dashboard.test.mjs`. Panels:
   - Table "SDLC items (latest snapshot)": query `{job="ai-sdlc-stages", stage=~"$sdlc_stage"} | json`; transformations sort by time descending and group by `number`, taking the first value of each field, so only the newest snapshot of each item shows; `stage_since` converted to a time field and shown as "x days ago"; stage cell coloured (red awaiting spec, yellow awaiting plan, blue in build, green built). Panel `timeFrom` is wide (one year) so the newest snapshot is always in range.
   - Bar chart "Items per stage": count of the newest snapshot's lines per `stage`.
   - Logs panel "SDLC stages last loaded": newest line of `{job="ai-sdlc-stages"}`, showing its time and `main_commit`.
   - Variable `sdlc_stage`: multi-select, default every stage except `built`.
6. **Docs.** Update `grafana/README.md`.
7. **Check against the real thing.** Start the stack, run `npm run metrics:collect` twice, compare with the repo (see Tests), look at the panels, then run `npm run verify`.

## Parallel work
None. The collector and the dashboard touch separate files, but the dashboard's grouping and time display can only be verified with real snapshots from the collector, and the work is small.

## Tests
Existing test changed (named so the test-guard unlocks it):
- `grafana/dashboard.test.mjs`: the test "queries only fields the collector sends" requires every query to use `job="ai-sdlc-metrics"` or `ai-sdlc-metrics-runs` and fields the PR collector sends. Change it to also allow `job="ai-sdlc-stages"`, with its own known labels and body fields (`number`, `slug`, `stage_since`, `intent_status`, `spec_status`, `plan_status`, `run_id`, `main_commit`). Add a test that the new panels exist (stage table, items per stage, stages last loaded) and that the `sdlc_stage` variable defaults to every stage but `built`. No existing assertion is weakened for the PR panels.

New tests (`scripts/collect-sdlc-stages.test.mjs`, Vitest, as in `collect-metrics.test.mjs`, with a fake `git` and a fake Loki):
- Each stage rule: intent only, intent and spec, plan with no build, built.
- Built forms: `Build 010: ...`, `Build the todo tracker (spec 001)`, `Merge pull request #9 from o/build/004-app-theme`; a non-matching merge (`from o/spec/004-...`) does not count.
- A spec with no intent file is still one row; a plan with two `Status:` lines uses the first; a missing `Status:` is empty.
- `stage_since` for each stage, from a fixture history.
- Fetch failure and unreachable Loki each return exit code 1 with a message naming the cause.
- A file that does not match `NNN-*.md` is listed in the output.
- `scripts/collect-all.test.mjs`: both collectors run when the first fails; exit code is non-zero if either failed, zero if both pass.

Checked by hand (not automatable):
- With the stack up, `npm run metrics:collect` against the real `origin/main`. Expected today: 001, 002, 003, 004, 005, 007, 008, 010 built; 006 and 009 awaiting spec; 011 in build once this plan is merged (before that, awaiting plan).
- Run it twice with a change between (a fixture `origin` with a moved item): the table shows only the newest stage for each item, once.
- Look at the panels: colours, "x days ago", the built toggle, the age panel.

Done means `npm run verify` passes, the checks above are as expected, and the PR-metrics panels and `collect` tests are unchanged.

## Risks
- **Highest risk: the table showing only the newest snapshot.** It relies on Grafana's group-by transformation keeping the first row after a descending sort, and on a time-field display for `stage_since`. If either does not behave, old snapshots would show as duplicate rows. Contained by step 7's two-run check on the real stack before this is called done. Fallback if group-by fails: add a `latest` flag to the newest run's lines via a second small heartbeat line holding `run_id`, and filter the table on it. That would be a deviation recorded in this plan.
- **Moving every existing panel's `gridPos.y`.** Done mechanically in one pass and checked by the existing dashboard tests, which find panels by title, not position.
- **Git history shapes.** Merge, squash and plain commits all appear in this repo. The built rule has three forms and tests for each; an unexpected subject shows as "in build", which the spec already flags as a known limit.
- **Windows and `git`.** Paths in `git show origin/main:<path>` use forward slashes; the script passes arguments as an array, no shell.
- **`metrics:collect` now needs `git`.** Documented; a failure in one half does not block the other.
- **Network.** The only new network call is `git fetch origin main`, as the spec records.

## Alternatives rejected
- **Second npm command.** Rejected by the product owner: one command.
- **Reading the working tree.** Would show local branches' state, against the intent.
- **Merging both collectors into `collect`.** Would change `collect` and its protected tests, and make PR-metrics tests need `git`.
- **A `days_in_stage` field computed at collection.** Goes stale between runs; Grafana computes it from `stage_since`.
- **Importing `collect-metrics.mjs` from the new script and the new script from it.** Circular; a separate `collect-all.mjs` avoids it.

## Open questions
None.

## Deviations
None.
