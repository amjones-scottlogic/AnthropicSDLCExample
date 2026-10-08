# Plan: AI-SDLC metrics dashboard
Spec: [spec/005-ai-sdlc-metrics-dashboard.md](../spec/005-ai-sdlc-metrics-dashboard.md). Intent: [intent/005-ai-sdlc-metrics-dashboard.md](../intent/005-ai-sdlc-metrics-dashboard.md). Status: approved.

## Approach
A Node collector (`scripts/collect-metrics.mjs`) lists PRs and comments with `gh`, finds the metrics comment by marker, parses it with the existing exported `parseComment`/`findMetricsComment`/`listComments` from `.claude/skills/capture-metrics/capture.mjs` (no change to `capture.mjs`), adds `pr_number` and `pr_state`, and pushes each row to local Loki as one JSON log line stamped with `captured_at`. Grafana OSS and Loki run from `grafana/compose.yaml` on Docker Desktop (installed as a one-off; Docker is not on this machine yet), bound to 127.0.0.1, with the data source and the dashboard JSON provisioned from the repo. A Windows Task Scheduler task runs the collector at 20:00 local. Nothing is added to `src/` or the Vite build.

## Files
New:
- `scripts/collect-metrics.mjs`: collector (pure functions exported; CLI only when run directly, like `capture.mjs` l.607).
- `scripts/collect-metrics.test.mjs`: Vitest, `// @vitest-environment node`, stubbed `gh` and `fetch`.
- `scripts/schedule-collector.ps1`: registers the Task Scheduler task (`schtasks`), starts the stack first if it is down.
- `grafana/compose.yaml`: Grafana OSS + Loki, ports `127.0.0.1:3000` and `127.0.0.1:3100`, named volumes.
- `grafana/loki-config.yaml`: filesystem storage, no retention expiry.
- `grafana/provisioning/datasources/loki.yaml`, `grafana/provisioning/dashboards/dashboards.yaml`.
- `grafana/dashboards/ai-sdlc-metrics.json`: the dashboard.
- `grafana/dashboard.test.mjs`: JSON valid; panel queries use only fields the collector sends.
- `grafana/README.md`: one-off setup (Docker Desktop, `gh auth login`, change the Grafana admin password, register the task), commands, caveats.
- `plan/005-ai-sdlc-metrics-dashboard.md`.

Change:
- `package.json`: scripts `metrics:up`, `metrics:down`, `metrics:collect`, `metrics:schedule`.
- `.gitignore`: collector state/output files if any.
- `spec/005-...md`: `Status: approved` (done).

Not touched: `src/`, `capture.mjs`, CI workflow, `eslint.config.js` (does not lint `.mjs`), existing tests.

## Order of work
1. **Collector core** (Req 1-4, 14): `rowsFromPr` (parse, add `pr_number`, `pr_state`, keep empty `value` as empty), `toLokiStream` (labels `stage`,`kind`,`metric`,`pr_state`; body JSON of every field; timestamp from `captured_at`), skip-and-report unparsable comments, count PRs with no comment. Tests first.
2. **Loki client and dedupe** (Req 1, 4): `latestCapturedAt` query, send only newer rows, push via `fetch` to `http://127.0.0.1:3100`; unreachable Loki → message and non-zero exit. Tests with stubbed `fetch`.
3. **Stack** (Req 5, 6, 17): compose, Loki config, provisioning, npm `metrics:up`/`metrics:down`. Needs Docker Desktop installed first (manual).
4. **Real-run proof of duplicate handling** (Req 4): load fixture rows, run the collector twice against real Loki, confirm no duplicates and that a refreshed comment adds only its new snapshot. If Loki does not dedupe identical entries, the collector's "send only newer than latest" filter is the guarantee; record the finding in the plan.
5. **Dashboard JSON** (Req 7-16): variables metric/stage/kind/PR/all-snapshots; panels: metric over time (latest-per-PR default), by stage, leading vs lagging per stage, PR drill-down table (raw lines incl. empty values and notes), skill invocations (per PR and over time, contributors summed), tokens by model and type (per PR and over time, summed), approximation note text, "last loaded" stat. Queries `unwrap value` only where non-empty. Then dashboard test, then check against the running stack with fixture data.
6. **Scheduling and docs** (Req 1): `schedule-collector.ps1`, `grafana/README.md`; npm `metrics:schedule`.
7. **Verify**: `npm run verify`; manual look at the dashboard and a manual check that the scheduled task fires.
8. Push only with human approval.

## Parallel work
None. Steps 1-2 share one file; 3-5 depend on a running stack; the whole change is one small vertical slice.

## Tests
- Req 1, 2, 3, 14 (`scripts/collect-metrics.test.mjs`): fixture comment → expected rows with `pr_number`/`pr_state`; no-comment PR counted; malformed table skipped and listed with PR number; empty `value` stays empty, real 0 stays 0; two contributors' skill rows on one PR both kept.
- Req 4: rows already in Loki → nothing sent; refreshed comment → only the new snapshot sent.
- Req 1: unreachable Loki → error message, non-zero exit.
- Req 6-12, 14-16 (`grafana/dashboard.test.mjs`): JSON valid; every query references only collector fields/labels; variables present.
- Not automated: panel appearance, scheduled task firing, and a real double-run against Loki (steps 4, 5, 7, by hand, results recorded under Deviations/Verification).
- No existing tests are changed. Done means `npm run verify` passes and the manual checks are reported.

## Risks
- **Highest: Loki duplicate behaviour and "latest captured_at" watermark** (Req 4). A row arriving with an older `captured_at` than the watermark (another contributor's refresh) would be skipped. Contained by keying the watermark per PR (latest `captured_at` per `pr_number`) rather than globally, and proving it in step 4. Loki also rejects entries older than its accepted window unless `reject_old_samples` is relaxed; set it off in `loki-config.yaml` so historic `captured_at` timestamps load.
- Docker Desktop must be installed by the owner before steps 3-5 can run; WSL2/virtualisation may be needed.
- `gh` rate and pagination across all PRs; use `--paginate` via existing `listComments`.
- Comment-format coupling: shared parser, but a format change needs both updated.
- Default Grafana admin password; compose binds localhost only and README requires changing it. No credentials in the repo.
- Machine off at 20:00: next run catches up; dashboard shows data age.

## Alternatives rejected
- Native Grafana/Loki binaries: less repeatable; chosen against by the owner in favour of Docker.
- Prometheus or SQL data source: needs an extra service; Loki handles timestamped events directly.
- Global watermark: loses out-of-order refreshes; per-PR watermark used.
- Changing `capture.mjs`: not needed, the parser is already exported.

## Open questions
None. The owner approved the spec as it stands: Loki, 20:00 local, no cost figure, per-PR and over-time token/skill views only, earlier PRs as no rows and empty values as missing; Docker Desktop to be installed.

## Deviations
2026-10-08:
- **Duplicate check uses the full row identity, not a per-PR watermark.** The collector reads back every row Loki holds and skips any whose key (PR number, metric, change, notes, captured_at) already exists. This is exactly the spec identity, handles out-of-order refreshes, and does not rely on Loki dropping identical entries. Tested with a fake Loki; not yet proven against a real one (Docker not installed on this machine).
- **`pr_state` is in the JSON body, not a stream label.** It changes when a PR merges, which would put a resent row in a different stream. The spec listed it as a label.
- **PR selector is a text box (default `.+` = all), not a dropdown.** Loki cannot list PR numbers without making them a label.
- **A heartbeat line per run** is pushed to `{job="ai-sdlc-metrics-runs"}`; the "Last collector run" panel shows it, so a run that adds no rows still shows as a run.
- **Real-Loki checks (steps 4 and 5 of Order of work, and the panel check) not done**: Docker Desktop is not installed here. They remain to do by hand once it is.

## Verification
1. `npm test` shows the new collector and dashboard tests passing.
2. `npm run metrics:up`; open `http://127.0.0.1:3000`, dashboard is present.
3. Load fixtures, run `npm run metrics:collect` twice; row count in Loki unchanged on the second run.
4. Check every panel, including a PR with empty values and the "last loaded" age.
5. Stop Loki, run the collector: clear error, non-zero exit.
6. `npm run metrics:schedule`; confirm the task exists and runs on demand.
7. `npm run verify` passes, output reported as is.
