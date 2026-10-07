# Spec: Capture AI-SDLC metrics
Intent: [intent/002-ai-sdlc-metrics.md](../intent/002-ai-sdlc-metrics.md). Status: draft.

## Summary
A `capture-metrics` skill that records the leading and lagging metrics defined in `AI-SDLC.md` as raw rows in a CSV file in `metrics/`, taking them from git history wherever possible and from Claude session stats where git cannot supply them. It runs locally. A Claude Code hook fires it when Claude opens a pull request, and the rows are committed on the branch first, so they arrive with the change and CI runs on them. It captures data only. Charts are a later intent.

## Requirements

1. **One skill captures every defined metric.** `.claude/skills/capture-metrics/SKILL.md` holds the list of metrics, one entry per metric in the `AI-SDLC.md` table, each with its stage, kind (leading or lagging), source (git or session) and how it is computed.
   - Every metric in the `AI-SDLC.md` Metrics table has an entry, or is listed in the skill as "not yet capturable" with the reason.
   - Adding a metric to `AI-SDLC.md` means adding one entry to the skill. Nothing else changes.
2. **Raw data, not summaries.** Each measurement is stored as one row in `metrics/metrics.csv`, with these columns: `captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source`, `notes`.
   - `change` identifies what was measured (an intent, spec or plan number such as `002`, or a PR number).
   - `source` is `git` or `session`.
   - A value that cannot be worked out is written as an empty `value` with the reason in `notes`, never as 0.
   - The file has a header row and loads without conversion into a spreadsheet or a charting library.
3. **Git first.** A metric that can be computed from git history is computed from it, with no other input.
   - The same repository state gives the same values when the skill is run again.
4. **Session stats for the rest.** Metrics git cannot supply are gathered from Claude session stats on the engineer's machine, if those stats can be read (see Open questions).
   - Rows from session stats have `source` of `session`.
5. **Runs when Claude opens a pull request.** A Claude Code hook fires when Claude runs the command that opens a PR and runs the skill's script for the stage that has just ended.
   - The stage is worked out from the files the branch changes against `main`: `intent/` is Plan, `spec/` is Design, `plan/` or `src/` is Build.
   - The rows are committed on the current branch before the PR is created, so the PR contains them.
   - Re-running for the same change and metric replaces the earlier row rather than adding a duplicate.
   - If the script fails, the hook reports the error and does not block the PR.
6. **Catches up on merged work.** Each run also fills in the metrics that can only be known after a PR exists, for earlier PRs that have since merged: time from plan approval to merged PR, rework cycles, and first-implementation merges.
7. **Does not break the app.** The metrics files are not part of the built app.
   - `npm run build` output is unchanged and `npm run check:offline` still passes.
8. **Tested.** The calculations are covered by automated tests (see Testing).

## Design

- **Where things live.**
  - `.claude/skills/capture-metrics/`: the skill, plus one script (`capture.mjs`, Node 22, no dependencies) that does the git calculations and writes rows. Keeping the arithmetic in a script rather than in the model's head makes it repeatable and testable.
  - `.claude/hooks/capture-metrics.sh`: the trigger, registered in `.claude/settings.json` beside `push-gate` and `plan-sync`, and written in the same style.
  - `metrics/metrics.csv`: the data.
  - The script is plain Node and lives under `.claude/`, not `src/`, so the `src-structure` skill (which governs the React app) is not involved.
- **No Action.** Nothing runs in CI. The metrics commit is made by the engineer's own session, so CI runs on it as on any other commit and there is no API key or token to manage.
- **Single long-format CSV.** One file with one row per measurement is the simplest thing that charts well: any tool can filter by `metric` and plot `value` against `captured_at`. New metrics add rows, not columns, so the schema never changes.
- **Hook.** A `PreToolUse` hook on `Bash`, matching `gh pr create`, in the same shape as `push-gate.sh`. It runs `capture.mjs`, stages `metrics/metrics.csv` and commits it. It never blocks the command, whatever the outcome.
- **Git-derived metrics.** The script reads `git log` and, for PR data, `gh`.

  | Stage | Metric | How it is computed |
  |---|---|---|
  | Plan | Share of intents accepted into Design | Intents whose `Status` is `accepted`, divided by all intents |
  | Plan | Edits to an intent after its spec is committed | Commits touching `intent/NNN-*.md` dated after the first commit of `spec/NNN-*.md` |
  | Design | Time from intent commit to spec commit | First commit of `spec/NNN-*.md` minus first commit of `intent/NNN-*.md` |
  | Design | Spec commits after the first plan commit | Commits touching `spec/NNN-*.md` dated after the first commit of `plan/NNN-*.md` |
  | Build | Time from plan approval to merged PR | Commit that sets the plan to approved, to the merge time of the PR (filled in on a later run) |
  | Build | Rework cycles per change | Commits pushed to the PR branch after it was opened (filled in on a later run) |
  | Build | Share of changes that merge on the first implementation | PRs merged with no rework cycles, divided by all merged PRs (filled in on a later run) |
  | Build | How often Claude repeats a mistake already listed in `CLAUDE.md` | Lines added to "Common mistakes" in `CLAUDE.md`, per change |
  | Build | Changes merged per week per engineer | Merged PRs per author per ISO week, written next to rework rate |
  | Build | Time to first merged PR for a new team member | First merged PR minus first commit, per author. Empty for a sole user |

- **Metrics that need judgement.** "How often the merged diff still matches the committed plan" is a judgement, not a calculation. The skill asks the `plan-reviewer` agent for a verdict (match, minor drift, major drift) and records it as a row. This is the only metric in which the model decides the value.
- **Session metrics.** Time from first conversation to intent, concurrent sessions per engineer, and share of time orchestrating rather than waiting come from Claude session stats on the local machine. Their availability is unconfirmed, so if the script cannot read them it writes an empty value with a note. See Open questions.
- **Project standards.** The standards constrain the todo app, not the repository's tooling. The app stays browser-only with no network calls. The hook and script run on the engineer's machine and never ship in `dist/`.

## Testing

- Unit tests for each calculation in `capture.mjs`, run against a small fixture repository built in the test, covering: a normal case, a missing input (no spec yet), and a re-run that replaces rather than duplicates a row.
- A test that the CSV has the expected header and that an unknown value is written empty with a note.
- `npm run build` and `npm run check:offline` run unchanged in CI to show the app is unaffected.

## Out of scope

- Charts, graphs and any display of the data (a later intent).
- Any GitHub Action or other CI step for metrics.
- Deploy metrics, which are not yet defined in `AI-SDLC.md`.
- Backfilling metrics for changes merged before this ships, other than what a run over existing git history produces.
- Metrics for anyone but the sole engineer.

## Open questions

- What Claude session data can actually be read, and does it cover concurrent sessions, orchestrating versus waiting, and time from first conversation to intent? Until this is checked, those three metrics are specified but cannot be built.
- Does one PR open mark the end of every stage? This spec assumes it does and infers the stage from the files changed. A PR that touches several stages would be recorded under more than one.
- Is "first implementation" defined as "no commits after the PR was opened"? Commits for review fixes and for CI fixes are both counted by that definition.
- Should the hook fire on `gh pr create` or on `git push`? A branch is normally pushed before its PR is created, so a metrics commit made at `gh pr create` would not be on the remote until the next push. Firing on `git push` of a non-`main` branch puts the commit in the push that precedes the PR, and the `push-gate` hook already pauses there.

## Flagged concerns

1. **Departs from the accepted intent as first written.** The intent originally said a GitHub Action would trigger the skill. At the product owner's direction it was changed to a local hook, and the intent is updated in the same commit. The earlier concerns about session stats not reaching an Action, a missing `ANTHROPIC_API_KEY` secret, and Action commits not re-running CI no longer apply.
2. **PRs not opened by Claude on this machine are not covered.** The spec PRs opened by the `write-spec` Action, and any PR opened in the browser, never fire the hook, so Design-stage data for those is only captured on the next local run.
3. **The hook may fire too late.** See the open question on `gh pr create` versus `git push`. Taken literally, firing at `gh pr create` would usually leave the metrics commit out of the PR.
4. **Definitions are ambiguous in places.** "Rework cycle", "merges on the first implementation" and "plan approval" are not precisely defined in `AI-SDLC.md`. The table above picks a reading for each. If the intended meaning is different, these metrics will mislead.
5. **Standards.** The `project-standards` constraints (no backend, no network calls) do not apply to repository tooling, so no conflict is raised. Flagging this explicitly in case the product owner reads the standards more broadly.
