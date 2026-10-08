# Spec: AI-SDLC metrics dashboard
Intent: [intent/005-ai-sdlc-metrics-dashboard.md](../intent/005-ai-sdlc-metrics-dashboard.md). Status: draft.

## Summary
A dashboard that shows the AI-SDLC metrics across every pull request in the project, so trends and stage comparisons can be seen without opening PRs one by one. A scheduled job collects the `AI-SDLC metrics` comments from the PRs each evening and publishes them with a static dashboard page. The dashboard shows each metric over time, metrics by stage, a drill-down into one change, leading against lagging metrics, and the skill and token data added by intent 008. It reads data only. It does not change how the metrics are captured.

## Requirements

1. **Collected nightly.** A scheduled job reads the metrics comment from every PR in the repository, open and merged, and builds one dataset from them.
   - The job also runs on demand, so a run does not have to wait for the evening.
   - A comment that cannot be parsed is skipped and listed in the job log with its PR number. It does not fail the run.
2. **Reads the existing format.** The job reads the comment identified by the `<!-- ai-sdlc-metrics -->` marker and the table of fields `captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source`, `notes`, as defined by intent 002. It needs no change to the comment.
   - Each dataset row carries the PR number and the PR's state (open or merged) alongside the fields.
   - An empty `value` stays empty. It is never turned into 0.
3. **PRs without a comment.** A PR with no metrics comment (for example, opened before intent 002 shipped, or opened in the browser) appears in a "no metrics" count on the dashboard and contributes no rows.
4. **Each metric over time.** The user picks a metric and sees its values plotted by `captured_at` date, with one point per PR where the metric is per-PR.
5. **By stage.** Metrics are grouped under Plan, Design and Build as in `AI-SDLC.md`. The `stage` value of a row decides its group. A row recorded under several stages appears under each.
6. **Leading against lagging.** Each stage group shows its leading and lagging metrics side by side, using the `kind` field.
7. **Drill-down into one change.** The user picks a PR and sees every row captured for it, grouped by stage, with `notes`.
8. **Skill usage.** The dashboard shows `Skill invocations` rows: the count per repository skill for a chosen PR, and each skill's total over time.
   - Rows from different contributors on the same PR are added together per skill. The drill-down can still show them separately.
9. **Token usage.** The dashboard shows `Tokens` rows: input, output, cache read and cache write by model, for a chosen PR and over time.
   - Contributors' rows for the same PR are added together per model and token type.
10. **No cost is recorded, so none is invented.** The dashboard shows token counts only. It shows no dollar figure (see Open questions).
11. **Missing is not zero.**
    - A row with an empty `value` is shown as missing, with its `notes` reason (for example `no session data captured`). It is left out of totals and averages and out of chart lines, not plotted as 0.
    - A real 0 (something counted and found to be none) is shown as 0.
12. **Says how approximate it is.** The skill and token views state, on the page, that only repository skills are counted, that counts are by branch and only from contributors who ran the capture, and that they are approximate.
13. **Shows its age.** The dashboard shows when the data was collected, so a stale dataset is obvious.
14. **Follows the project standards.** The dashboard is static, works with no network calls (see Design), is usable with a keyboard alone, and has labelled controls and sufficient colour contrast. Charts have a text alternative, such as a table of the plotted values.
15. **Tested** (see Testing).

## Design

- **Where it lives.** A second static page in the existing Vite build, served from the same GitHub Pages site at `/AnthropicSDLCExample/metrics/`. It reuses the app's build, CI checks and Pages deployment instead of adding hosting. It is a separate HTML entry rather than a route, so the todo app stays free of a router (spec 001). It lives in its own domain folder under `src/` per the `src-structure` skill, and shares no state with the todo app.
- **Collector.** A Node script, `scripts/collect-metrics.mjs`, run by a scheduled GitHub Actions workflow. It lists PRs and their comments with the `gh` CLI and the workflow's own `GITHUB_TOKEN`, finds the comment by marker, and parses the table. It reuses the existing parsing code in `capture.mjs` (exporting it if it is not already) so the format has one definition. It writes `metrics-data.json`, an array of rows with the PR number and state added, plus `collectedAt`, the PR count and the list of unparsed PRs.
- **Where the data goes between runs.** Nowhere. The PR comments are the source of truth and the whole dataset is rebuilt from them each run. This avoids committing data to `main` (which the merge gate on `main` would block) and avoids a second copy that could drift. The file is written into the build output and published with the page.
- **Scheduled deploy.** The scheduled workflow checks out `main`, runs the collector, runs the normal build with the data file included, and deploys `dist/` with the same Pages actions as spec 003. The dashboard reads `metrics-data.json` from its own origin, so the browser makes no request to GitHub or any other host, and `check:offline` still passes.
- **Never publishes a broken dashboard.** If the collector fails entirely, the workflow stops before deploying, so the last good dashboard stays up.
- **Aggregation in the page.** Summing contributors, grouping by stage and kind, and treating empty values as missing are done by pure functions in the dashboard code, which is where the tests apply. Parsing is in the collector and tested there.
- **Charts.** Drawn with plain SVG to avoid a charting dependency, with a table view of the same data for accessibility. A library can be chosen in the plan if drawing by hand proves expensive.
- **Schedule.** Cron runs in UTC. The time is an open question (below).

## Testing

- Collector: a fixture comment is parsed to the expected rows. A PR without a comment, a comment with a malformed table and an empty `value` are each handled as above. Two contributors' skill rows on one PR are both kept.
- Aggregation: contributors' skill and token rows add up per skill and per model and token type. Empty values are excluded from totals and shown as missing. A real 0 is kept.
- Dashboard: renders each view from a small fixture dataset, shows the approximation note and the collected-at date, and the controls are reachable and operable by keyboard. `jsx-a11y` lint passes.
- `npm run check:offline` passes on the built dashboard.

## Out of scope

- Changing what is captured or the comment format (intents 002 and 008).
- Dollar cost, prices or budgets.
- Alerts, notifications or targets for any metric.
- Backfilling metrics comments for PRs that never had one.
- Other repositories or other contributors' dashboards. This is for one project and one viewer.
- Authentication. The page is as public as the Pages site it is part of (see Flagged concerns).

## Open questions

- **Time and time zone for the job.** Cron is UTC only. Proposal: 20:00 UTC, which is evening in the UK all year within an hour. Needs the product owner's confirmation.
- **Which skill and token views are useful.** This spec includes per-PR and over-time views for both. Tokens per stage or per merged change are not included. Say if they are wanted.
- **Cost.** Should an estimated cost be shown? That needs a price source the dashboard can use without a network call, such as a file of prices kept in the repo. Left out until decided.
- **Earlier PRs and gaps.** Requirements 3 and 11 show them as "no metrics" and "missing". Confirm that is the treatment wanted rather than hiding them.

## Flagged concerns

- **Public exposure of the metrics.** The project is published on GitHub Pages, and the dashboard would be public to anyone with the URL if the site is. It shows PR numbers, contributor git author names (in `notes`), skill names and token totals. Intent 008 keeps transcript text out, but names and usage are exposed. If the Pages site or repo is public, this is public. Confirm that is acceptable, or the dashboard should drop contributor names.
- **Standards: "no backend" and "stays on the user's machine".** The standards are written for the todo app's user data. The dashboard itself is a static page with no network calls, which meets them. The scheduled collector is server-side code that calls the GitHub API. It runs in CI, outside the app, and the data is project metadata rather than user data, so this spec treats it as in line with the standards. This is a judgement, so it is flagged for the product owner to confirm.
- **Departs from spec 003's deploy trigger.** Spec 003 deploys only on a push to `main`. A scheduled deploy re-publishes `main` as it already is, with fresh data, but it is a second trigger. The reason it is needed is that the dashboard data changes without any push.
- **Data is only as complete as the capture.** Metrics comments are written by a hook on each contributor's machine, so PRs opened in the browser or by the `write-spec` Action have none until someone runs the capture. The dashboard will show gaps that are real gaps in capture, not bugs.
- **Dependence on the comment format.** The collector reads a table written by `capture.mjs`. A change to that format breaks the collector unless both are updated together. Sharing the parser, as designed, reduces this but does not remove it.
