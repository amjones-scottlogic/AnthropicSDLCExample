---
name: capture-metrics
description: Capture the AI-SDLC leading and lagging metrics for a pull request and post them as a comment on it. Use when asked to capture, record or refresh the metrics, or to add the plan-match judgement to a PR's metrics comment. A hook runs it automatically after `gh pr create`.
---

# Capture metrics

Records the metrics defined in `AI-SDLC.md` as one table in a single comment on a pull request. One row per measurement, with the fields `captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source` and `notes`. A value that cannot be worked out is left empty with the reason in `notes`; it is never 0.

The arithmetic lives in `capture.mjs` (Node, no dependencies), not in your head. Run it; don't recompute by hand.

## When it runs

- Automatically: the `capture-metrics` hook runs after `gh pr create` and posts the comment for that PR. It also refreshes earlier merged PRs whose comments say "awaiting merge".
- On demand: `node .claude/skills/capture-metrics/capture.mjs --pr <number>`. Re-running updates the existing comment (found by its hidden marker); it never adds a second one.

## Plan-match judgement

The one metric a script cannot decide. When asked to capture metrics by hand:

1. Ask the `plan-reviewer` agent to review the PR's branch against its plan.
2. Reduce its report to one verdict: `match`, `minor drift` or `major drift`.
3. Run `node .claude/skills/capture-metrics/capture.mjs --pr <number> --plan-match "<verdict>"`.

## Metrics

Stage is the stage the PR touches: `intent/` is Plan, `spec/` is Design, `plan/` or `src/` is Build. A PR touching several stages is recorded under each.

| Stage | Kind | Metric | Source | How |
|---|---|---|---|---|
| Plan | leading | Time from first conversation to the intent being committed | session | First human prompt of the session whose transcript wrote `intent/NNN-*.md`, to the intent's first commit |
| Plan | lagging | Share of intents accepted into Design | git | Intents with `Status: accepted` divided by all intents |
| Plan | lagging | Edits to an intent after its spec is committed | git | Commits touching `intent/NNN-*.md` dated after the first commit of `spec/NNN-*.md` |
| Design | leading | Time from the intent commit to the spec commit | git | First commit of `spec/NNN-*.md` minus first commit of `intent/NNN-*.md` |
| Design | lagging | Spec commits after the first plan commit for the same change | git | Commits touching `spec/NNN-*.md` dated after the first commit of `plan/NNN-*.md` |
| Build | leading | Share of changes that merge on the first implementation | git | Merged PRs with zero review rounds divided by all merged PRs |
| Build | leading | Time from plan approval to merged PR | git | The commit "Approve plan NNN" to the PR's merge time. Empty until merged |
| Build | leading | Time to first merged PR for a new team member | git | An author's first merged PR minus their first commit. Empty for a sole user |
| Build | leading | Concurrent sessions per engineer while review quality holds | session | Peak overlap of session first-to-last message spans over the week before the PR. An approximation |
| Build | lagging | Rework cycles per change | git | Review rounds: a review on the PR that requests changes, followed by a later commit. GitHub reviews only |
| Build | lagging | How often the merged diff still matches the committed plan | session | `plan-reviewer` verdict, passed with `--plan-match`. Empty until judged |
| Build | lagging | How often Claude repeats a mistake already listed in `CLAUDE.md` | git | Lines added under "Common mistakes" in `CLAUDE.md` against `main` |
| Build | lagging | Changes merged per week per engineer, read against rework rate | git | Merged PRs per author per ISO week, next to the review-round rows |

Session sources are the Claude Code transcripts in `~/.claude/projects/<project>/*.jsonl`. If they are missing, the rows are left empty with a note.

## Not yet capturable

- Share of time spent orchestrating rather than waiting: it needs a definition, and idle gaps in a transcript cannot be told apart from the engineer working elsewhere. Define it before building it.
- Deploy metrics: `AI-SDLC.md` marks them "To be defined".

## Adding a metric

Add it to the `AI-SDLC.md` table, then add one row to the table above. If it can be computed, add the calculation to `capture.mjs` with a test. `capture.test.mjs` fails if a metric in `AI-SDLC.md` is missing from this file.
