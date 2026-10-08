# Spec: AI-SDLC metrics dashboard
Intent: [intent/005-ai-sdlc-metrics-dashboard.md](../intent/005-ai-sdlc-metrics-dashboard.md). Status: draft.

## Summary
A Grafana dashboard that shows the AI-SDLC metrics across every pull request in the project, so trends and stage comparisons can be seen without opening PRs one by one. A scheduled job collects the `AI-SDLC metrics` comments from the PRs each evening and sends the rows to Grafana. The dashboard, kept as code in the repo, shows each metric over time, metrics by stage, a drill-down into one change, leading against lagging metrics, and the skill and token data added by intent 008. It reads data only. It does not change how the metrics are captured, and it is not part of the published app.

## Requirements

1. **Collected nightly.** A scheduled job reads the metrics comment from every PR in the repository, open and merged, and sends the rows to Grafana.
   - The job also runs on demand, so a run does not have to wait for the evening.
   - A comment that cannot be parsed is skipped and listed in the job log with its PR number. It does not fail the run.
   - If Grafana cannot be reached or rejects the data, the run fails visibly and sends nothing partial that it cannot repeat safely (see requirement 4).
2. **Reads the existing format.** The job reads the comment identified by the `<!-- ai-sdlc-metrics -->` marker and the table of fields `captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source`, `notes`, as defined by intent 002. It needs no change to the comment.
   - Each row sent carries the PR number and the PR's state (open or merged) alongside the fields.
   - An empty `value` is sent as empty. It is never turned into 0.
3. **PRs without a comment.** A PR with no metrics comment (for example, opened before intent 002 shipped, or opened in the browser) contributes no rows. The run log reports how many PRs had none.
4. **Safe to repeat.** Running the job twice, or every night, does not duplicate rows in Grafana.
   - A row is identified by PR number, `metric`, `change`, `notes` and `captured_at`. Sending a row that is already in Grafana has no effect.
   - A refreshed comment has a new `captured_at`, so its rows are new data. Earlier snapshots stay, which is what gives a metric a history.
5. **Dashboard as code.** The dashboard definition is a file in the repo, reviewed like any other change. The job applies it to Grafana, so the live dashboard matches `main`.
6. **Each metric over time.** A metric selector shows its values over time by `captured_at`.
   - By default a PR counts once, using its latest snapshot, so a PR pushed ten times is not ten data points. An option shows every snapshot.
7. **By stage.** Metrics are grouped under Plan, Design and Build as in `AI-SDLC.md`, using the `stage` field. A row recorded under several stages appears under each.
8. **Leading against lagging.** Each stage shows its leading and lagging metrics side by side, using the `kind` field.
9. **Drill-down into one change.** A PR selector shows every row for that PR, with `notes`, grouped by stage.
10. **Skill usage.** The dashboard shows `Skill invocations`: the count per repository skill for a chosen PR, and each skill's total over time.
    - Contributors' rows for the same PR are added together per skill. The drill-down still shows them separately.
11. **Token usage.** The dashboard shows `Tokens`: input, output, cache read and cache write by model, for a chosen PR and over time.
    - Contributors' rows for the same PR are added together per model and token type.
12. **No cost is recorded, so none is invented.** Token counts only, with no dollar figure (see Open questions).
13. **Missing is not zero.**
    - A row with an empty `value` is left out of totals, averages and chart lines, and is visible in the drill-down with its `notes` reason (for example `no session data captured`).
    - A real 0 is shown as 0.
14. **Says how approximate it is.** The skill and token panels state that only repository skills are counted, that counts are by branch and only from contributors who ran the capture, and that they are approximate.
15. **Shows its age.** The dashboard shows when data was last received, so a stalled job is obvious.
16. **Secrets stay secret.** Grafana credentials are stored as repository secrets, never in the repo, the logs or the data sent.
17. **Tested** (see Testing).

## Design

- **Collector.** A Node script, `scripts/collect-metrics.mjs`, run by a scheduled GitHub Actions workflow (`metrics-dashboard.yml`, on `schedule` and `workflow_dispatch`). It lists PRs and their comments with the `gh` CLI and the workflow's own `GITHUB_TOKEN`, finds the comment by marker, and parses the table. It reuses the parsing code in `capture.mjs` (exporting it if it is not already), so the comment format has one definition.
- **Getting data into Grafana.** Each row is sent as one JSON log line to Loki, with the row's `captured_at` as its timestamp. Labels are the low-cardinality fields (`stage`, `kind`, `metric`, `pr_state`); everything else is in the JSON body, read in queries with `| json`. Rows are events with a timestamp and a handful of fields, which is what Loki holds well, and it needs no extra service beyond Grafana. This is the recommended route, to be confirmed in the plan (see Open questions).
- **Repeating safely.** Because a row's timestamp is its `captured_at`, and its body includes the identifying fields, resending an unchanged row produces the same entry. The collector also sends only rows newer than a cut-off it works out by querying Grafana for the latest `captured_at` already stored, so a normal run sends only new snapshots. The plan must check, with a real repeat run, that no duplicates appear.
- **Missing values.** Queries unwrap `value` only where it is non-empty, so empty values drop out of charts and totals. The drill-down is a table over the raw lines, so empty values are visible there with their notes.
- **Latest per PR.** Panels default to the latest snapshot per PR (the last `captured_at` for each PR and metric) and offer a dashboard variable to show all snapshots.
- **Dashboard.** `grafana/ai-sdlc-metrics.json`, with variables for metric, stage, kind and PR, and rows of panels for the views above. The workflow applies it through Grafana's HTTP API on each run, so a change merged to `main` reaches Grafana at the next run, or at once through `workflow_dispatch`.
- **Credentials.** Repository secrets for the Loki endpoint and its credentials and for a Grafana token that can write dashboards. The collector exits with a clear message and no data sent if a secret is missing, as `write-spec` does without its key.
- **Not in the app.** None of this is part of the Vite build, GitHub Pages or the todo app. No `src/` code is added. The only code is the collector and its tests, in `scripts/`.

## Testing

- Collector, against fixture comments: a comment is parsed to the expected rows; a PR without a comment, a malformed table and an empty `value` are each handled as above; two contributors' skill rows on one PR are both kept.
- Repeating: the collector given rows already sent produces no new entries, and a refreshed comment produces entries for its new snapshot only.
- Secrets: a run with a missing secret exits without sending, and the logs contain no credential.
- Dashboard definition: the JSON is valid, and every query panel refers to fields the collector sends. It is checked against a Grafana instance in the plan, not only by reading it.
- Not covered by automated tests: how the panels look. That is checked by eye in the plan.

## Out of scope

- Changing what is captured or the comment format (intents 002 and 008).
- Dollar cost, prices or budgets.
- Alerts, notifications or targets for any metric.
- Backfilling metrics comments for PRs that never had one.
- Setting up or running Grafana itself, including accounts, users and access rules.
- Other repositories. This is for one project and one viewer.

## Open questions

- **Which Grafana.** Grafana Cloud, or a self-hosted instance? GitHub-hosted runners can only reach an endpoint on the public internet. A self-hosted instance behind a firewall would need a self-hosted runner or a different route.
- **Loki or something else.** Loki is recommended above. Prometheus remote write, or a SQL database as a data source, would also work but need another service. Confirm before planning.
- **Time and time zone for the job.** Cron is UTC only. Proposal: 20:00 UTC, which is evening in the UK all year within an hour.
- **Which skill and token views are useful.** This spec includes per-PR and over-time views for both. Tokens per stage or per merged change are not included. Say if they are wanted.
- **Cost.** Should an estimated cost be shown? That needs a price source, such as a file of prices in the repo. Left out until decided.
- **Earlier PRs and gaps.** Requirements 3 and 13 treat them as "no rows" and "missing". Confirm that is the treatment wanted.

## Flagged concerns

- **Conflicts with the project standards as written.** They say no network calls to external services and no backend. Those were written for the todo app, and this adds none to the app. But the collector sends project data to a third-party service, which the standards would not allow if read literally. This spec treats it as outside the app and flags it for the product owner to approve as an explicit exception. If it is not approved, this design cannot be built as written.
- **Project data leaves GitHub.** The rows include PR numbers, git author names (in `notes`), skill names and token totals. Intent 008 keeps transcript text out, but names and usage are sent to Grafana. Check that is acceptable for the Grafana account used, and who can view it.
- **Repository secrets and a Grafana token.** The nightly job needs credentials with write access to Grafana, held as repo secrets. Anyone who can change the workflow on `main` can use them, so the merge gate on `main` matters here.
- **Duplicate handling is unproven.** Whether resending a row is a safe no-op depends on how Grafana's log store treats an identical entry, and it is a design assumption, not a checked fact. The plan must test it before relying on it.
- **Data is only as complete as the capture.** Metrics comments are written by a hook on each contributor's machine, so PRs opened in the browser or by the `write-spec` Action have none until someone runs the capture. Gaps in the dashboard will be real gaps in capture, not bugs.
- **Dependence on the comment format.** The collector reads a table written by `capture.mjs`. A change to that format breaks the collector unless both are updated together. Sharing the parser reduces this but does not remove it.
