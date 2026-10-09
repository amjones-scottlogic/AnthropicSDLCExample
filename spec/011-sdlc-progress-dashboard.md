# Spec: SDLC progress in the Grafana dashboard
Intent: [intent/011-sdlc-progress-dashboard.md](../intent/011-sdlc-progress-dashboard.md). Status: draft.

## Summary
A new group of panels on the existing AI-SDLC metrics dashboard shows where every intent, spec and plan currently sits in the SDLC, and how long each item has been there, so stalled work stands out. The stages are worked out from what is merged to `origin/main`. The existing command, `npm run metrics:collect`, run by hand, also reads the repo and loads one snapshot of the stages into the same local Loki as the PR metrics. Nothing is scheduled, nothing changes in the app, and nothing leaves the machine except the `git fetch` of `origin`.

## Requirements

1. **Collected on demand, by the one command.** `npm run metrics:collect` reads `intent/`, `spec/` and `plan/` as they are on `origin/main` and loads the result into Loki, in the same run that collects the PR metrics. There is no second command. Nothing runs on a schedule.
   - The command first fetches `origin/main`, so a local branch or an unpulled local `main` never changes the result.
   - If the fetch fails or Loki cannot be reached, the run exits non-zero and says which, rather than loading stale data silently.
   - The PR metrics and the stages are collected independently: a failure in one is reported and does not stop the other from loading, but the run still exits non-zero.
2. **One row per item number.** Items are grouped by the `NNN` prefix shared by `intent/NNN-*.md`, `spec/NNN-*.md` and `plan/NNN-*.md`. Each row carries the number, the slug, the stage, `stage_since` and the Status of each file that exists (empty if the file does not exist).
3. **Stage rules.** The stage is the furthest point reached:
   - only an intent exists: **awaiting spec**;
   - a spec exists and no plan: **awaiting plan**;
   - a plan exists and no `Build NNN` commit on `origin/main`: **in build**;
   - a commit on `origin/main` whose subject starts `Build NNN`: **built**.
4. **Time in stage.** `stage_since` is the date of the first commit on `origin/main` that put the item in its current stage: the one that added its intent, spec or plan file, or the `Build NNN` commit itself. The dashboard shows how long the item has been there, so the oldest waiting items are easy to pick out.
5. **Current stage table.** A panel lists every item with its slug, stage, time in stage and the Status of its intent, spec and plan. It defaults to items not yet built, with a control to include built items. Rows are coloured by stage.
6. **Latest snapshot only.** Each run loads a new snapshot. The panel shows the latest one, so a repeat run duplicates nothing visible and an item that moves stage shows its new stage.
7. **Shows its age.** The dashboard shows when the stages were last loaded and which `origin/main` commit they were read from, so a forgotten run is obvious.
8. **Same setup as the metrics dashboard.** The panels are part of `grafana/dashboards/ai-sdlc-metrics.json`, loaded by the existing provisioning. No new service, container or port.
9. **Stays on the machine.** Grafana and Loki stay bound to `127.0.0.1`. The only network call the command makes beyond the local Loki is the `git fetch` of the repo's own `origin`. No credentials are stored in the repo.
10. **Tested** (see Testing).

## Design

- **Collector.** A Node module, `scripts/collect-sdlc-stages.mjs`, called from `scripts/collect-metrics.mjs` so that `npm run metrics:collect` runs both, with the stack up. No new npm script. It reads the files with `git` (`ls-tree` and `show` against `origin/main`, never the working tree) and the dates from the first-parent history of `origin/main`. It reuses the Loki push and reachability code in `scripts/collect-metrics.mjs`, so there is one way to talk to Loki.
- **Classification as a pure function.** `classify(files, statuses, commits)` in the same script takes plain lists and returns the rows, so the stage rules in requirement 3 are tested without git or Loki.
- **Getting data in.** Each row is one JSON log line pushed under its own job label (`ai-sdlc-stages`), so it never mixes with the metrics rows. The line's timestamp is the run time and the body holds `run_id`, `main_commit` and the row fields. `stage` is the only label, as it is low-cardinality. Everything else is read with `| json`.
- **Latest snapshot.** Queries take the rows of the newest `run_id` only. Older snapshots stay in Loki, which lets stage counts over time be added later without re-collecting.
- **Dashboard.** A new row of panels on the existing dashboard: the stage table, a count of items per stage, and an age-of-data stat. Time in stage is computed from `stage_since` by Grafana, so it keeps counting between runs.
- **Where "built" comes from.** The `Build NNN` rule is exactly the one in the intent. It lives in one place, `classify`, so changing it (see Open questions) is a one-line change.
- **Not in the app.** No `src/` code, no Vite build change, no CI or Pages change. The additions are the script and its tests in `scripts/`, the dashboard JSON, and updates to `grafana/README.md` (including that `metrics:collect` now needs `git` as well as `gh`) and the README's dashboard section if it describes the command.

## Testing

- `classify`, against fixture lists: each stage rule; a spec with no intent file; a plan with several `Status:` lines (the first is used); a missing `Status:` shown as empty; `Build NNN` for an item with a plan and for one without.
- Dates: a fixture history gives the expected `stage_since` for each stage.
- Failures: an unreachable Loki and a failed `git fetch` each exit non-zero with a message that names the cause.
- Dashboard JSON: valid, and every new query refers to fields the collector sends. Checked against the running stack with fixture data loaded, as for the metrics panels.
- Not covered by automated tests: how the panels look and the colours. Checked by hand in the plan.

## Out of scope

- Scheduling or any automatic refresh.
- Alerts, targets or "stalled" thresholds. Time in stage is shown, not judged.
- Charting stage counts over time. The snapshots are kept so it can be added later.
- Reading branches or open PRs. Only `origin/main` counts.
- Changing how intents, specs or plans are written or numbered.
- Sharing the dashboard with anyone else.

## Open questions

- **Older builds.** Items 001 and 003 were built under commits titled `Build the todo tracker (spec 001)` and `Build infrastructure: ... (spec 003)`, which do not start `Build NNN`. With the rule as written they show as in build. Recommended: also accept a subject that starts `Build` and ends `(spec NNN)`. That changes the intent's rule, so it needs the product owner's decision. The alternative is to accept two wrong rows.

## Flagged concerns

- **Abandoned work looks like in-progress work.** An item with a plan but no `Build NNN` commit stays "in build" for ever. Today that probably includes 004 (app theme) and 007 (feedback loop). The dashboard cannot tell "waiting" from "dropped". Time in stage makes it visible, and the product owner can decide whether a "dropped" Status is wanted. That would be a new intent.
- **The Status words are not clean.** A plan can carry several `Status:` lines (007 has a `draft` on a later line). The spec uses the first, which may not be the one a reader expects.
- **Network call.** The `git fetch` of `origin` is a call to GitHub from the machine, the same remote the repo is already pushed to. The standards forbid network calls to external services for the app, and this adds nothing to the app, so it fits their intent. Flagged so the product owner can confirm that reading.
- **One command now needs two tools.** `metrics:collect` needs `git` (and a reachable `origin`) as well as `gh`. Requirement 1 keeps a failure in one half from blocking the other.
- **Data is a snapshot.** Time in stage keeps counting, but the stage itself is only as fresh as the last run, as with the metrics rows. Requirement 7 shows how old it is.
- **Depends on file naming.** The grouping relies on the `NNN-` prefix convention and `Status:` lines. A file that breaks the convention would be left out, so the run lists any file it could not place.
