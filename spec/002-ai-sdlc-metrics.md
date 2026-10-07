# Spec: Capture AI-SDLC metrics
Intent: [intent/002-ai-sdlc-metrics.md](../intent/002-ai-sdlc-metrics.md). Status: draft.

## Summary
A `capture-metrics` skill that records the leading and lagging metrics defined in `AI-SDLC.md` as raw rows in a CSV file in `metrics/`, taking them from git history wherever possible and from Claude session stats where git cannot supply them. A GitHub Action runs it when a pull request is opened, so the data is captured at the end of each stage without anyone remembering to do it. It captures data only. Charts are a later intent.

## Requirements

1. **One skill captures every defined metric.** `.claude/skills/capture-metrics/SKILL.md` holds the list of metrics, one entry per metric in the `AI-SDLC.md` table, each with its stage, kind (leading or lagging), source (git, session or reported) and how it is computed.
   - Every metric in the `AI-SDLC.md` Metrics table has an entry, or is listed in the skill as "not yet capturable" with the reason.
   - Adding a metric to `AI-SDLC.md` means adding one entry to the skill. Nothing else changes.
2. **Raw data, not summaries.** Each measurement is stored as one row in `metrics/metrics.csv`, with these columns: `captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source`, `notes`.
   - `change` identifies what was measured (an intent, spec or plan number such as `002`, or a PR number).
   - `source` is `git` or `session`.
   - A value that cannot be worked out is written as an empty `value` with the reason in `notes`, never as 0.
   - The file has a header row and loads without conversion into a spreadsheet or a charting library.
3. **Git first.** A metric that can be computed from git history is computed from it, with no other input.
   - The same repository state gives the same values when the skill is run again.
4. **Session stats for the rest.** Metrics git cannot supply are gathered from Claude session stats, if those stats can be read (see Open questions).
   - Rows from session stats have `source` of `session`.
5. **Runs when a pull request is opened.** A GitHub Action in `.github/workflows/` runs the skill when a PR is opened, and again when new commits are pushed to it.
   - The stage that has just ended is worked out from the files the PR changes: `intent/` is Plan, `spec/` is Design, `plan/` or `src/` is Build.
   - Re-running for the same PR and metric replaces the earlier row rather than adding a duplicate.
   - New rows are committed to the PR branch, so the data arrives with the change it describes.
6. **Does not break the app.** The metrics files are not part of the built app.
   - `npm run build` output is unchanged and `npm run check:offline` still passes.
7. **Tested.** The calculations are covered by automated tests (see Testing).

## Design

- **Where things live.**
  - `.claude/skills/capture-metrics/`: the skill, plus one script (`capture.mjs`, Node 22, no dependencies) that does the git calculations and writes rows. Keeping the arithmetic in a script rather than in the model's head makes it repeatable and testable.
  - `metrics/metrics.csv`: the data.
  - `.github/workflows/capture-metrics.yml`: the trigger.
  - The script is plain Node and lives under `.claude/`, not `src/`, so the `src-structure` skill (which governs the React app) is not involved.
- **Single long-format CSV.** One file with one row per measurement is the simplest thing that charts well: any tool can filter by `metric` and plot `value` against `captured_at`. New metrics add rows, not columns, so the schema never changes.
- **Git-derived metrics.** The script reads `git log` and the GitHub PR list (`gh`).

  | Stage | Metric | How it is computed |
  |---|---|---|
  | Plan | Share of intents accepted into Design | Intents whose `Status` is `accepted` at the PR head, divided by all intents |
  | Plan | Edits to an intent after its spec is committed | Commits touching `intent/NNN-*.md` dated after the first commit of `spec/NNN-*.md` |
  | Design | Time from intent commit to spec commit | First commit of `spec/NNN-*.md` minus first commit of `intent/NNN-*.md` |
  | Design | Spec commits after the first plan commit | Commits touching `spec/NNN-*.md` dated after the first commit of `plan/NNN-*.md` |
  | Build | Time from plan approval to merged PR | Commit that sets the plan to approved, to the merge time of the PR |
  | Build | Rework cycles per change | Commits pushed to the PR branch after it was opened |
  | Build | Share of changes that merge on the first implementation | PRs merged with no rework cycles, divided by all merged PRs |
  | Build | How often Claude repeats a mistake already listed in `CLAUDE.md` | Lines added to "Common mistakes" in `CLAUDE.md`, per change |
  | Build | Changes merged per week per engineer | Merged PRs per author per ISO week, written next to rework rate |
  | Build | Time to first merged PR for a new team member | First merged PR minus first commit, per author. Empty for a sole user |

- **Metrics that need judgement.** "How often the merged diff still matches the committed plan" is a judgement, not a calculation. The skill uses the `plan-reviewer` agent's verdict (match, minor drift, major drift) and records it as a row. This is the only metric in which the model decides the value.
- **Session metrics.** Time from first conversation to intent, concurrent sessions per engineer, and share of time orchestrating rather than waiting come from Claude session stats. Their availability is unconfirmed, so the skill reads them from a file in `metrics/sessions/` that is exported from the engineer's machine, and records an empty value with a note if no file is present. See Open questions and Flagged concerns.
- **Action.** Triggered on `pull_request` (`opened`, `synchronize`). It checks out the PR branch, runs `capture.mjs` for the stage the PR changes, and commits the CSV with the repository token (`contents: write`). The script is deterministic, so the Action needs no Anthropic API key. Only the plan-match judgement needs the model, and that row is written only when a key is available.
- **No loop.** The Action does not re-trigger itself: the commit only changes `metrics/`, and the script exits without writing when the PR changes nothing outside `metrics/`.
- **Project standards.** The standards constrain the todo app, not the repository's tooling. The app stays browser-only with no network calls. The Action and script run in CI and on the engineer's machine and never ship in `dist/`.

## Testing

- Unit tests for each calculation in `capture.mjs`, run against a small fixture repository built in the test, covering: a normal case, a missing input (no spec yet), and a re-run that replaces rather than duplicates a row.
- A test that the CSV has the expected header and that an unknown value is written empty with a note.
- `npm run build` and `npm run check:offline` run unchanged in CI to show the app is unaffected.

## Out of scope

- Charts, graphs and any display of the data (a later intent).
- Deploy metrics, which are not yet defined in `AI-SDLC.md`.
- Backfilling metrics for changes merged before this ships, other than what a run over existing git history produces.
- Metrics for anyone but the sole engineer.

## Open questions

- What Claude session data can actually be read, and does it cover concurrent sessions, orchestrating versus waiting, and time from first conversation to intent? Until this is checked, those three metrics are specified but cannot be built.
- Does one PR open mark the end of every stage? This spec assumes it does and infers the stage from the files changed. A PR that touches several stages (for example a build PR that also edits a spec) would be recorded under more than one.
- Is the metric for share of changes that merge on the first implementation defined as "no commits after the PR was opened"? Commits for review fixes and for CI fixes are both counted by that definition.
- Is it acceptable for the Action to commit to PR branches? Branch protection or a PR from a fork would block it.

## Flagged concerns

1. **Session stats cannot reach the Action.** The intent wants the skill run by a GitHub Action and wants session metrics from Claude session stats. Session stats are on the engineer's machine and a GitHub-hosted Action cannot read them. This spec resolves it by having the engineer export them into `metrics/sessions/`, which adds a manual step the intent did not ask for. The alternative is to capture only git metrics in the Action and run session metrics locally. The product owner should choose.
2. **The `write-spec` Action cannot run today.** There is no `ANTHROPIC_API_KEY` repository secret, so this spec was written locally. The same secret would be needed for any model-based step in the metrics Action. The design keeps the Action free of the key except for the plan-match row.
3. **Commits made by the Action do not start CI.** GitHub does not trigger workflows from commits made with the default repository token. A metrics commit on a PR branch would therefore not re-run lint, typecheck, test and build. Since only `metrics/` changes, this is probably acceptable, but required status checks could show as pending.
4. **Definitions are ambiguous in places.** "Rework cycle", "merges on the first implementation" and "plan approval" are not precisely defined in `AI-SDLC.md`. The table above picks a reading for each. If the intended meaning is different, these metrics will mislead.
5. **Standards.** The `project-standards` constraints (no backend, no network calls) do not apply to repository tooling, so no conflict is raised. Flagging this explicitly in case the product owner reads the standards more broadly.
