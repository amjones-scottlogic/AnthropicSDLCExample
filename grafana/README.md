# AI-SDLC metrics dashboard

A local Grafana dashboard over the `AI-SDLC metrics` comments on every pull request. Grafana OSS and Loki run on this
machine only. Nothing here is part of the published app. Spec: [spec/005](../spec/005-ai-sdlc-metrics-dashboard.md).

## One-off setup (by hand)

1. Install Docker Desktop and start it.
2. `gh auth login`. The collector uses your own login to read PR comments.
3. Optional: put `GRAFANA_ADMIN_PASSWORD=<something>` in `grafana/.env` (git-ignored). Otherwise sign in at
   <http://127.0.0.1:3000> as `admin` / `admin` and change the password when asked. Do this before anything else.
4. `npm run metrics:schedule` registers a daily Task Scheduler task at 20:00 local time (`-Time 21:30` to change it,
   `-Remove` to delete it). It starts the stack if it is down, then collects. If the machine was off at 20:00 it runs
   when the machine is next on.

## Commands

| Command | What it does |
| --- | --- |
| `npm run metrics:up` | start Grafana and Loki, with the dashboard loaded |
| `npm run metrics:down` | stop them; data is kept in Docker volumes |
| `npm run metrics:collect` | collect now (Loki must be up) |

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
