# Spec: Capture AI-SDLC metrics
Intent: [intent/002-ai-sdlc-metrics.md](../intent/002-ai-sdlc-metrics.md). Status: approved.

## Summary
A `capture-metrics` skill that records the leading and lagging metrics defined in `AI-SDLC.md` as raw measurements, taking them from git history wherever possible and from Claude session stats where git cannot supply them. It runs locally. A Claude Code hook fires it when Claude opens a pull request, and again when further commits are pushed to it. The measurements are posted as a comment on that PR and kept up to date. It captures data only. Charts are a later intent.

## Requirements

1. **One skill captures every defined metric.** `.claude/skills/capture-metrics/SKILL.md` holds the list of metrics, one entry per metric in the `AI-SDLC.md` table, each with its stage, kind (leading or lagging), source (git or session) and how it is computed.
   - Every metric in the `AI-SDLC.md` Metrics table has an entry, or is listed in the skill as "not yet capturable" with the reason.
   - Adding a metric to `AI-SDLC.md` means adding one entry to the skill. Nothing else changes.
2. **Raw data, not summaries.** Each measurement is one row in the PR comment, with these fields: `captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source`, `notes`.
   - `change` identifies what was measured (an intent, spec or plan number such as `002`, or a PR number).
   - `source` is `git` or `session`.
   - A value that cannot be worked out is left empty with the reason in `notes`, never written as 0.
   - The comment is a table that can be copied into a spreadsheet or read by a script without conversion.
3. **Git first.** A metric that can be computed from git history is computed from it, with no other input.
   - The same repository state gives the same values when the skill is run again.
4. **Session stats for the rest.** Metrics git cannot supply are gathered from Claude session stats on the engineer's machine, if those stats can be read (see Open questions).
   - Rows from session stats have `source` of `session`.
5. **Runs when Claude opens a pull request, and when commits are pushed to it.** A Claude Code hook fires when Claude runs the command that opens a PR, and again when Claude pushes to a branch that has an open PR, and runs the skill's script for the stages the PR touches.
   - A push to a branch with no open PR does nothing.
   - The stage is worked out from the files the branch changes against `main`: `intent/` is Plan, `spec/` is Design, `plan/` or `src/` is Build.
   - The measurements are posted as a comment on the PR once it has been created.
   - Re-running for the same PR updates its existing metrics comment rather than adding a second one.
   - If the script fails, the hook reports the error and does not affect the PR.
6. **Catches up on merged work.** Each run also fills in the metrics that can only be known after a PR is opened, for earlier PRs that have since merged: time from plan approval to merged PR, rework cycles, and first-implementation merges. It does this by updating the metrics comment on those PRs.
7. **Tested.** The calculations are covered by automated tests (see Testing).

## Design

- **Where things live.**
  - `.claude/skills/capture-metrics/`: the skill, plus one script (`capture.mjs`, Node 22, no dependencies) that does the git calculations and produces the comment. Keeping the arithmetic in a script rather than in the model's head makes it repeatable and testable.
  - `.claude/hooks/capture-metrics.sh`: the trigger, registered in `.claude/settings.json` beside `push-gate` and `plan-sync`, and written in the same style.
  - The script is plain Node and lives under `.claude/`, not `src/`, so the `src-structure` skill (which governs the React app) is not involved.
- **No commit, no CI.** The metrics are a comment, not a change to the repository, so nothing is committed and nothing runs in CI.
- **One row per measurement.** A long-format table (one row per metric per change) is the simplest thing that charts well: any tool can filter by `metric` and plot `value` against `captured_at`. New metrics add rows, not columns, so the fields never change.
- **Hook.** A `PostToolUse` hook on `Bash`, matching `gh pr create` and `git push`, in the same shape as `push-gate.sh`. It runs after the PR exists, so it has a PR number to comment on. On a push it looks up the PR for the current branch and does nothing if there is none. It runs `capture.mjs` and posts the result with `gh pr comment`, using a hidden marker in the comment so a re-run can find and update it. It never blocks anything, whatever the outcome.
- **Git-derived metrics.** The script reads `git log` and, for PR data, `gh`.

  | Stage | Metric | How it is computed |
  |---|---|---|
  | Plan | Share of intents accepted into Design | Intents whose `Status` is `accepted`, divided by all intents |
  | Plan | Edits to an intent after its spec is committed | Commits touching `intent/NNN-*.md` dated after the first commit of `spec/NNN-*.md` |
  | Design | Time from intent commit to spec commit | First commit of `spec/NNN-*.md` minus first commit of `intent/NNN-*.md` |
  | Design | Spec commits after the first plan commit | Commits touching `spec/NNN-*.md` dated after the first commit of `plan/NNN-*.md` |
  | Build | Time from plan approval to merged PR | Commit that sets the plan to approved, to the merge time of the PR (filled in on a later run) |
  | Build | Rework cycles per change | Review rounds: each time a review on the PR requests changes and a fix follows (filled in on a later run) |
  | Build | Share of changes that merge on the first implementation | PRs merged with zero review rounds, divided by all merged PRs (filled in on a later run) |
  | Build | How often Claude repeats a mistake already listed in `CLAUDE.md` | Lines added to "Common mistakes" in `CLAUDE.md`, per change |
  | Build | Changes merged per week per engineer | Merged PRs per author per ISO week, written next to rework rate |
  | Build | Time to first merged PR for a new team member | First merged PR minus first commit, per author. Empty for a sole user |

- **Metrics that need judgement.** "How often the merged diff still matches the committed plan" is a judgement, not a calculation. The skill asks the `plan-reviewer` agent for a verdict (match, minor drift, major drift) and records it as a row in the comment. This is the only metric in which the model decides the value.
- **Session metrics.** Time from first conversation to intent, concurrent sessions per engineer, and share of time orchestrating rather than waiting come from Claude session stats on the local machine. Their availability is unconfirmed, so if the script cannot read them it writes an empty value with a note. See Open questions.
- **Project standards.** The standards constrain the todo app, not the repository's tooling. The app stays browser-only with no network calls. The hook and script run on the engineer's machine and never ship in `dist/`.

## Testing

- Unit tests for each calculation in `capture.mjs`, run against a small fixture repository built in the test, covering: a normal case, a missing input (no spec yet), and a re-run that updates the existing comment rather than adding a second one.
- A test that the comment has the expected fields and that an unknown value is left empty with a note.

## Out of scope

- Charts, graphs and any display of the data (a later intent).
- Any GitHub Action or other CI step for metrics.
- Deploy metrics, which are not yet defined in `AI-SDLC.md`.
- Backfilling metrics for changes merged before this ships, other than what a run over existing git history produces.
- Metrics for anyone but the sole engineer.

## Open questions

- What Claude session data can actually be read, and does it cover concurrent sessions, orchestrating versus waiting, and time from first conversation to intent? Until this is checked, those three metrics are specified but cannot be built.
- Does one PR open mark the end of every stage? This spec assumes it does and infers the stage from the files changed. A PR that touches several stages would be recorded under more than one.
- Review rounds are read from the PR's reviews on GitHub. As a sole user, do you review your own PRs there, or does the `plan-reviewer` agent do the review in a session? If the latter, those rounds are not on GitHub and would have to come from session data.
- The comment on each PR is the only record. What makes it easy to collect those comments for charting later, given that charting is a later intent? A fixed table layout is assumed here, but nothing gathers the comments yet.
- Should the `write-spec` Action also post a metrics comment on the spec PRs it opens? A local hook never sees those. An extra Action step could run the git-only calculations and post the comment, but it would only work once the `ANTHROPIC_API_KEY` secret exists, because the PR is only opened when the key is present. Session metrics could not be included.

## Flagged concerns

1. **Departs from the accepted intent as first written.** The intent originally said a GitHub Action would trigger the skill. At the product owner's direction it was changed to a local hook, and the intent is updated in the same commit. The earlier concerns about session stats not reaching an Action, a missing `ANTHROPIC_API_KEY` secret, and Action commits not re-running CI no longer apply.
2. **PRs not opened by Claude on this machine are not covered.** The spec PRs opened by the `write-spec` Action, and any PR opened in the browser, never fire the hook, so Design-stage data for those is only captured on the next local run. See the open question about adding an Action step.
3. **Comments are hard to chart.** The intent asks for raw data that is easy to turn into charts. A comment on each PR is spread across many PRs, and the intent no longer says where the data is collected. This spec leaves that for the later charting intent, which will have to gather the comments first.
4. **Definitions are not in `AI-SDLC.md`.** The product owner has settled three: a rework cycle is a review round (a review that requests changes, followed by a fix); a change merges on the first implementation when it has zero review rounds; and plan approval is the commit that sets the plan's status to approved. They are recorded in the table above but `AI-SDLC.md` still doesn't say so, so the two can drift apart.
5. **Standards.** The `project-standards` constraints (no backend, no network calls) do not apply to repository tooling, so no conflict is raised. Flagging this explicitly in case the product owner reads the standards more broadly.
