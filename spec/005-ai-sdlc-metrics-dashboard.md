# Spec: AI-SDLC metrics dashboard
Intent: [intent/005-ai-sdlc-metrics-dashboard.md](../intent/005-ai-sdlc-metrics-dashboard.md). Status: approved.

## Summary
A Grafana dashboard that shows the AI-SDLC metrics across every pull request in the project, so trends and stage comparisons can be seen without opening PRs one by one. Grafana OSS and Loki run on the user's own machine, started from files in the repo. A scheduled job on the same machine collects the `AI-SDLC metrics` comments from the PRs each evening and loads the rows into Loki. The dashboard, kept as code in the repo, shows each metric over time, metrics by stage, a drill-down into one change, leading against lagging metrics, and the skill and token data added by intent 008. It reads data only. It does not change how the metrics are captured, and it is not part of the published app.

## Requirements

1. **Collected nightly.** A scheduled job on the user's machine reads the metrics comment from every PR in the repository, open and merged, and loads the rows into Loki.
   - It runs at a set time each evening, and on demand with one command.
   - If the machine was off at the scheduled time, the next run catches up. Nothing is lost, because every run reads all PRs and sends whatever Loki does not already have.
   - A comment that cannot be parsed is skipped and listed in the run's output with its PR number. It does not fail the run.
   - If Loki cannot be reached, the run fails visibly and says so, rather than silently sending nothing.
2. **Reads the existing format.** The job reads the comment identified by the `<!-- ai-sdlc-metrics -->` marker and the table of fields `captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source`, `notes`, as defined by intent 002. It needs no change to the comment.
   - Each row sent carries the PR number and the PR's state (open or merged) alongside the fields.
   - An empty `value` is sent as empty. It is never turned into 0.
3. **PRs without a comment.** A PR with no metrics comment (for example, opened before intent 002 shipped, or opened in the browser) contributes no rows. The run's output reports how many PRs had none.
4. **Safe to repeat.** Running the job twice, or every night, does not duplicate rows.
   - A row is identified by PR number, `metric`, `change`, `notes` and `captured_at`. Sending a row Loki already has has no effect.
   - A refreshed comment has a new `captured_at`, so its rows are new data. Earlier snapshots stay, which is what gives a metric a history.
5. **Runs locally from the repo.** One command starts Grafana OSS and Loki with the dashboard already loaded, and one command stops them. Data is kept between restarts.
6. **Dashboard as code.** The dashboard definition is a file in the repo, reviewed like any other change. Grafana loads it from there on start, so the live dashboard matches `main` once it is pulled.
7. **Each metric over time.** A metric selector shows its values over time by `captured_at`.
   - By default a PR counts once, using its latest snapshot, so a PR pushed ten times is not ten data points. An option shows every snapshot.
8. **By stage.** Metrics are grouped under Plan, Design and Build as in `AI-SDLC.md`, using the `stage` field. A row recorded under several stages appears under each.
9. **Leading against lagging.** Each stage shows its leading and lagging metrics side by side, using the `kind` field.
10. **Drill-down into one change.** A PR selector shows every row for that PR, with `notes`, grouped by stage.
11. **Skill usage.** The dashboard shows `Skill invocations`: the count per repository skill for a chosen PR, and each skill's total over time.
    - Contributors' rows for the same PR are added together per skill. The drill-down still shows them separately.
12. **Token usage.** The dashboard shows `Tokens`: input, output, cache read and cache write by model, for a chosen PR and over time.
    - Contributors' rows for the same PR are added together per model and token type.
13. **No cost is recorded, so none is invented.** Token counts only, with no dollar figure (see Open questions).
14. **Missing is not zero.**
    - A row with an empty `value` is left out of totals, averages and chart lines, and is visible in the drill-down with its `notes` reason (for example `no session data captured`).
    - A real 0 is shown as 0.
15. **Says how approximate it is.** The skill and token panels state that only repository skills are counted, that counts are by branch and only from contributors who ran the capture, and that they are approximate.
16. **Shows its age.** The dashboard shows when data was last loaded, so a missed or failed run is obvious.
17. **Stays on the machine.** Grafana and Loki accept connections from the local machine only. The collector sends nothing anywhere except to the local Loki. No credentials are stored in the repo.
18. **Tested** (see Testing).

## Design

- **Collector.** A Node script, `scripts/collect-metrics.mjs`, with an npm script to run it. It lists PRs and their comments with the `gh` CLI, using the user's own login, finds the comment by marker, and parses the table. It reuses the parsing code in `capture.mjs` (exporting it if it is not already), so the comment format has one definition.
- **Stack.** `grafana/compose.yaml` runs Grafana OSS and Loki as containers, with the ports published on `127.0.0.1` only and a named volume for data, so it survives restarts. Loki is configured to keep data without an expiry, so history is not dropped. Grafana loads the Loki data source and the dashboard from provisioning files in the repo. Npm scripts start and stop it.
- **Getting data in.** Each row is sent as one JSON log line to Loki's push endpoint, with the row's `captured_at` as its timestamp. Labels are the low-cardinality fields (`stage`, `kind`, `metric`, `pr_state`). Everything else is in the JSON body, read in queries with `| json`. Rows are events with a timestamp and a handful of fields, which is what Loki holds well, and it needs no extra service.
- **Repeating safely and catching up.** Before sending, the collector asks Loki for the latest `captured_at` it holds and sends only rows newer than that. A row's timestamp is its `captured_at` and its body includes the identifying fields, so a resent row would be the same entry. The plan must check, with a real repeat run, that no duplicates appear.
- **Missing values.** Queries unwrap `value` only where it is non-empty, so empty values drop out of charts and totals. The drill-down is a table over the raw lines, so empty values are visible there with their notes.
- **Latest per PR.** Panels default to the latest snapshot per PR (the last `captured_at` for each PR and metric) and offer a dashboard variable to show all snapshots.
- **Dashboard.** `grafana/dashboards/ai-sdlc-metrics.json`, with variables for metric, stage, kind and PR, and rows of panels for the views above.
- **Scheduling.** The job is scheduled with the machine's own scheduler (Task Scheduler on Windows, cron elsewhere), at local time. The repo includes one documented command that registers the task, so setup is not a manual search through settings. It runs the collector, which needs the stack up, so the task starts it first if it is not running.
- **Not in the app.** None of this is part of the Vite build, GitHub Pages, CI deployment or the todo app. No `src/` code is added. The code is the collector and its tests in `scripts/`, plus the files under `grafana/`.

## Testing

- Collector, against fixture comments: a comment is parsed to the expected rows; a PR without a comment, a malformed table and an empty `value` are each handled as above; two contributors' skill rows on one PR are both kept.
- Repeating: given rows Loki already has, the collector sends nothing new, and a refreshed comment sends only its new snapshot.
- Unreachable Loki: the run exits with an error message and a non-zero code.
- Dashboard definition: the JSON is valid, and every query panel refers to fields the collector sends. It is checked against the running stack in the plan, with fixture data loaded, not only by reading it.
- Not covered by automated tests: how the panels look, and that the scheduled task fires. Both are checked by hand in the plan.

## Out of scope

- Changing what is captured or the comment format (intents 002 and 008).
- Dollar cost, prices or budgets.
- Alerts, notifications or targets for any metric.
- Backfilling metrics comments for PRs that never had one.
- Hosting Grafana for anyone else, or any access other than the local machine.
- Other repositories. This is for one project and one viewer.

## Open questions

- **Docker.** The stack is specified as containers, which needs Docker (or a compatible runtime) on the machine. Is it installed? If not, Grafana OSS and Loki can be installed directly instead, at the cost of a less repeatable setup.
- **Loki or something else.** Loki is recommended above. Prometheus or a SQL database as a data source would also work but need another service. Confirm before planning.
- **Time of the job.** Proposal: 20:00 local time. It needs the machine on and awake then. Confirm the time.
- **Which skill and token views are useful.** This spec includes per-PR and over-time views for both. Tokens per stage or per merged change are not included. Say if they are wanted.
- **Cost.** Should an estimated cost be shown? That needs a price source, such as a file of prices in the repo. Left out until decided.
- **Earlier PRs and gaps.** Requirements 3 and 14 treat them as "no rows" and "missing". Confirm that is the treatment wanted.

## Flagged concerns

- **Only runs when the machine is on.** The intent asks for a nightly pull. A local job cannot run on a closed laptop. Requirement 1 catches up on the next run, so no data is lost, but the dashboard can be a day or more behind, and requirement 16 shows its age. If a reliable fixed time matters, the job would need to run somewhere always on, which brings back the questions of reachability and secrets.
- **Setup is outside the app and by hand.** Docker, `gh` login and the scheduled task are one-off setup on the machine, not in code. The plan should record them, as spec 003 does for Pages.
- **Standards.** The standards say no network calls to external services and no backend. This design sends nothing off the machine and adds nothing to the app, so it fits their intent. The collector does call the GitHub API, which is the same call `capture-metrics` and the `gh` CLI already make. Flagged so the product owner can confirm that reading.
- **Default Grafana login.** A fresh Grafana OSS uses a well-known admin password. Bound to localhost it is not exposed to the network, but the setup should still change it, and the compose file must never publish the port more widely.
- **Duplicate handling is unproven.** Whether resending a row is a safe no-op depends on how Loki treats an identical entry, and it is a design assumption, not a checked fact. The plan must test it before relying on it.
- **Single viewer.** The data lives on one machine, so the dashboard is not shared. That matches the intent ("just me"), but there is no copy if the volume is lost. Data can be rebuilt from the PR comments, because the collector reads all of them.
- **Data is only as complete as the capture.** Metrics comments are written by a hook on each contributor's machine, so PRs opened in the browser or by the `write-spec` Action have none until someone runs the capture. Gaps in the dashboard will be real gaps in capture, not bugs.
- **Dependence on the comment format.** The collector reads a table written by `capture.mjs`. A change to that format breaks the collector unless both are updated together. Sharing the parser reduces this but does not remove it.
