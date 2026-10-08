# Plan: AI-SDLC metrics dashboard
Spec: [spec/005-ai-sdlc-metrics-dashboard.md](../spec/005-ai-sdlc-metrics-dashboard.md). Intent: [intent/005-ai-sdlc-metrics-dashboard.md](../intent/005-ai-sdlc-metrics-dashboard.md). Status: approved.

## Approach
A Node collector (`scripts/collect-metrics.mjs`) lists PRs and comments with `gh`, finds the metrics comment by marker, parses it with the existing exported `parseComment`/`findMetricsComment`/`listComments` from `.claude/skills/capture-metrics/capture.mjs` (no change to `capture.mjs`), adds `pr_number` and `pr_state`, and pushes each row to local Loki as one JSON log line stamped with `captured_at`. Grafana OSS and Loki run from `grafana/compose.yaml` on Docker Desktop (installed as a one-off; Docker is not on this machine yet), bound to 127.0.0.1, with the data source and the dashboard JSON provisioned from the repo. The collector is run by hand; nothing is scheduled (removed at the owner's request, see Deviations). Nothing is added to `src/` or the Vite build.

## Files
New:
- `scripts/collect-metrics.mjs`: collector (pure functions exported; CLI only when run directly, like `capture.mjs` l.607).
- `scripts/collect-metrics.test.mjs`: Vitest, `// @vitest-environment node`, stubbed `gh` and `fetch`.
- `grafana/compose.yaml`: Grafana OSS + Loki, ports `127.0.0.1:3000` and `127.0.0.1:3100`, named volumes.
- `grafana/loki-config.yaml`: filesystem storage, no retention expiry.
- `grafana/provisioning/datasources/loki.yaml`, `grafana/provisioning/dashboards/dashboards.yaml`.
- `grafana/dashboards/ai-sdlc-metrics.json`: the dashboard.
- `grafana/dashboard.test.mjs`: JSON valid; panel queries use only fields the collector sends.
- `grafana/README.md`: one-off setup (Docker Desktop, `gh auth login`, change the Grafana admin password), commands, caveats.
- `plan/005-ai-sdlc-metrics-dashboard.md`.

Change:
- `package.json`: scripts `metrics:up`, `metrics:down`, `metrics:collect`.
- `.gitignore`: collector state/output files if any.
- `spec/005-...md`: `Status: approved` (done).

Not touched: `src/`, `capture.mjs`, CI workflow, `eslint.config.js` (does not lint `.mjs`), existing tests.

## Order of work
1. **Collector core** (Req 1-4, 14): `rowsFromPr` (parse, add `pr_number`, `pr_state`, keep empty `value` as empty), `toStreams` (labels `job`,`stage`,`kind`,`metric`; body JSON of every field plus `pr_number` and `pr_state`; timestamp from `captured_at`; each stream sent oldest first), skip-and-report unparsable comments, count PRs with no comment. Tests first.
2. **Loki client and dedupe** (Req 1, 4): `existingKeys` reads back the row keys Loki holds, send only rows whose key is not there, push via `fetch` to `http://127.0.0.1:3100`; unreachable Loki → message and non-zero exit. Tests with stubbed `fetch`.
3. **Stack** (Req 5, 6, 17): compose, Loki config, provisioning, npm `metrics:up`/`metrics:down`. Needs Docker Desktop installed first (manual).
4. **Real-run proof of duplicate handling** (Req 4): load fixture rows, run the collector twice against real Loki, confirm no duplicates and that a refreshed comment adds only its new snapshot. The collector's key check, not Loki, is the guarantee against duplicates; record what the real run showed in Deviations.
5. **Dashboard JSON** (Req 7-16): variables metric/stage/kind/PR/all-snapshots; panels: metric over time (latest-per-PR default), by stage, leading vs lagging per stage, PR drill-down table (raw lines incl. empty values and notes), skill invocations (per PR and over time, contributors summed), tokens by model and type (per PR and over time, summed), approximation note text, "last loaded" stat. Queries `unwrap value` only where non-empty. Then dashboard test, then check against the running stack with fixture data.
6. **Docs** (Req 1): `grafana/README.md`.
7. **Verify**: `npm run verify`; manual look at the dashboard.
8. Push only with human approval.

## Parallel work
None. Steps 1-2 share one file; 3-5 depend on a running stack; the whole change is one small vertical slice.

## Tests
- Req 1, 2, 3, 14 (`scripts/collect-metrics.test.mjs`): fixture comment → expected rows with `pr_number`/`pr_state`; no-comment PR counted; malformed table skipped and listed with PR number; empty `value` stays empty, real 0 stays 0; two contributors' skill rows on one PR both kept.
- Req 4: rows already in Loki → nothing sent; refreshed comment → only the new snapshot sent.
- Req 1: unreachable Loki → error message, non-zero exit.
- Req 6-12, 14-16 (`grafana/dashboard.test.mjs`): JSON valid; every query references only collector fields/labels; variables present.
- Not automated: panel appearance, and a real double-run against Loki (steps 4, 5, 7, by hand, results recorded under Deviations/Verification).
- No existing tests are changed. Done means `npm run verify` passes and the manual checks are reported.

## Risks
- **Highest: duplicates and out-of-order rows in Loki** (Req 4). A watermark would skip an older row that arrives later (another contributor's refresh), so the collector matches on the full row identity instead (PR number, metric, change, notes, `captured_at`), and this is proven in step 4. Loki also rejects entries older than its accepted window; `reject_old_samples` is off in `loki-config.yaml`, and the real run showed the out-of-order window needed widening too (see Deviations).
- Docker Desktop must be installed by the owner before steps 3-5 can run; WSL2/virtualisation may be needed.
- `gh` rate and pagination across all PRs; use `--paginate` via existing `listComments`.
- Comment-format coupling: shared parser, but a format change needs both updated.
- Default Grafana admin password; compose binds localhost only and README requires changing it. No credentials in the repo.
- Data is only as fresh as the last manual run; a run after a gap catches up, and the dashboard shows when the collector last ran.

## Alternatives rejected
- Native Grafana/Loki binaries: less repeatable; chosen against by the owner in favour of Docker.
- Prometheus or SQL data source: needs an extra service; Loki handles timestamped events directly.
- A watermark (global or per PR) of the latest `captured_at`: skips an older row that arrives later, such as another contributor's refresh; the full row key is checked instead.
- Changing `capture.mjs`: not needed, the parser is already exported.

## Open questions
None. The owner approved the spec as it stands: Loki, no cost figure, per-PR and over-time token/skill views only, earlier PRs as no rows and empty values as missing; Docker Desktop to be installed.

## Deviations
The sections above were brought in line with these entries after review; where they differ, the entries below record why.

2026-10-08:
- **Duplicate check uses the full row identity, not a per-PR watermark.** The collector reads back every row Loki holds and skips any whose key (PR number, metric, change, notes, captured_at) already exists. This is exactly the spec identity, handles out-of-order refreshes, and does not rely on Loki dropping identical entries. Proven against a real Loki (see below): a second run sent 0 rows, and Loki held 83 lines with 83 distinct keys.
- **`pr_state` is in the JSON body, not a stream label.** It changes when a PR merges, which would put a resent row in a different stream. The spec listed it as a label.
- **PR selector is a text box (default `.+` = all), not a dropdown.** Loki cannot list PR numbers without making them a label.
- **A heartbeat line per run** is pushed to `{job="ai-sdlc-metrics-runs"}`; the "Last collector run" panel shows it, so a run that adds no rows still shows as a run.
- **Real-stack run (Docker Desktop installed) found three Loki problems the fake could not**, fixed in the same change:
  - Reading back rows since 2020 in one query made Loki split it into 1-hour pieces (59,340 of them) and drop the connection. `limits_config.split_queries_by_interval: 0` in `grafana/loki-config.yaml`.
  - Loki rejected rows older than the newest row in the same stream by more than max_chunk_age/2 ("entry too far behind"). Each stream is now sent oldest first (`toStreams`, with a test), and `ingester.max_chunk_age: 8760h` widens the window so a later run can add an older PR's rows.
  - Dashboard: per-PR token and skill panels lost their names (bar charts now use `labelsToFields` + `merge`, token series named by a `series` label); the all-metrics chart excludes Tokens and Skill invocations, which have their own panels and swamp the scale.
- **Checked against the real stack:** two runs (second sends 0 rows); Loki stopped gives a clear error and exit 1; data survives a Loki stop/start; all 13 dashboard queries run in Loki; Grafana provisions the dashboard and data source; panels screenshot with no errors. Not checked: the skill panels with data (only one skill row exists so far, "none used").
- **Scheduling removed (owner's request, same day).** Deleted `scripts/schedule-collector.ps1` and the `metrics:schedule` npm script; spec requirement 1 is now "collected on demand", and the spec's Scheduling design note, time-of-job question and "only runs when the machine is on" concern were rewritten. The collector, its catch-up behaviour and the "Last collector run" panel are unchanged. Intent 005 still says "every evening" and was not edited.

## Verification
1. `npm test` shows the new collector and dashboard tests passing.
2. `npm run metrics:up`; open `http://127.0.0.1:3000`, dashboard is present.
3. Load fixtures, run `npm run metrics:collect` twice; row count in Loki unchanged on the second run.
4. Check every panel, including a PR with empty values and the "last loaded" age.
5. Stop Loki, run the collector: clear error, non-zero exit.
6. `npm run verify` passes, output reported as is.
