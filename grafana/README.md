# AI-SDLC metrics dashboard

A local Grafana dashboard over the `AI-SDLC metrics` comments on every pull request. Grafana OSS and Loki run on this
machine only. Nothing here is part of the published app. Spec: [spec/005](../spec/005-ai-sdlc-metrics-dashboard.md).

## One-off setup (by hand)

1. Install Docker Desktop and start it.
2. `gh auth login`. The collector uses your own login to read PR comments. It also needs `git` and a reachable `origin`, to read the SDLC stages.
3. Optional: put `GRAFANA_ADMIN_PASSWORD=<something>` in `grafana/.env` (git-ignored). Otherwise sign in at
   <http://127.0.0.1:3000> as `admin` / `admin` and change the password when asked. Do this before anything else.

Nothing is scheduled: run the collector yourself when you want fresh data. The "Last collector run" panel shows when it
was last run.

## Commands

| Command | What it does |
| --- | --- |
| `npm run metrics:up` | start Grafana and Loki, with the dashboard loaded |
| `npm run metrics:down` | stop them; data is kept in Docker volumes |
| `npm run metrics:collect` | collect now (Loki must be up): the PR metrics from GitHub, and the SDLC stages from `origin/main` |

Open <http://127.0.0.1:3000> and the **AI-SDLC metrics** dashboard. Both ports are bound to `127.0.0.1`; never widen them.

## How it behaves

- Each run reads every PR's metrics comment and sends only rows Loki does not already hold (a row is identified by PR
  number, metric, change, notes and `captured_at`), so running twice duplicates nothing. A refreshed comment adds its new
  snapshot and keeps the earlier ones.
- The run prints how many PRs had no comment and lists any comment it could not parse. If Loki cannot be reached it
  exits non-zero.
- An empty value is kept empty and left out of charts and totals; the PR table shows it with its notes. A real 0 is 0.
- **PR selector** is a text box: type a PR number, or leave `.+` for all. (Loki cannot list PR numbers without making
  them a label, which would not be low-cardinality.)
- **Snapshots** chooses between each PR's latest snapshot (default) and every snapshot.
- A PR's open/merged state is recorded when the row is first loaded and is not updated on older rows.
- Only repository skills are counted, by branch and only from contributors who ran the capture. Treat as approximate.
- If the data volume is lost, run `npm run metrics:collect` again: every PR comment is re-read.

## SDLC progress

The top of the dashboard shows where every intent, spec and plan sits, read from `origin/main` (never your working tree,
so local branches change nothing). `npm run metrics:collect` runs `git fetch origin main` first, then loads one snapshot.
Spec: [spec/011](../spec/011-sdlc-progress-dashboard.md).

- **Stages.** An item is the `NNN` prefix shared by `intent/`, `spec/` and `plan/`. Only an intent: *awaiting spec*. A spec
  and no plan: *awaiting plan*. A plan and no build: *in build*. A build commit on `main`: *built*. A commit is the build of
  NNN if its subject starts `Build NNN`, or starts `Build` and ends `(spec NNN)`, or is `Merge pull request #N from
  <owner>/build/NNN-...`.
- **Time in stage** is counted from the date the file (or build commit) first landed on `main`, shown as "x days ago".
- **The table** shows the newest snapshot only. Built items are hidden until you add `built` to the **Stages (SDLC items)**
  selector. The status columns are the first `Status:` word in each file.
- **Abandoned work looks like work in progress.** A plan that never gets a build stays *in build*; the time in stage is the
  clue.
- If the fetch fails, or Loki is down, that half of the run reports it and the run exits non-zero. The PR metrics still load
  if only the stages failed, and the other way round. A file in those folders whose name does not start `NNN-` is listed in
  the run output and left out.
