# Plan: Capture AI-SDLC metrics
Spec: [spec/002-ai-sdlc-metrics.md](../spec/002-ai-sdlc-metrics.md). Intent: [intent/002-ai-sdlc-metrics.md](../intent/002-ai-sdlc-metrics.md). Status: approved.

## Approach
One dependency-free Node script, `.claude/skills/capture-metrics/capture.mjs`, does all the work. Its calculations are pure functions that take git log, PR and session data as input, so tests feed them fixtures and never call GitHub. A thin CLI layer gathers the real data (`git`, `gh`, the session transcripts under `~/.claude/projects/<project>/*.jsonl`), builds one markdown table (one row per measurement, with the spec's fields), and creates or updates a single PR comment found by a hidden marker. A `PostToolUse` hook (`.claude/hooks/capture-metrics.sh`), written in the style of `push-gate.sh` and registered in `.claude/settings.json`, runs the script after `gh pr create`. The hook only fires and forgets: it never blocks and never fails the command. `SKILL.md` lists every metric with its source and holds the manual path, including the one model judgement (plan match), which the hook cannot make. Session metrics come from the transcripts, which carry per-message timestamps, session ids and the file each tool call wrote. Anything that cannot be derived is listed in the skill as "not yet capturable" with the reason, as spec requirement 1 allows.

## Files
Create:
- `plan/002-ai-sdlc-metrics.md`: this plan.
- `.claude/skills/capture-metrics/SKILL.md`: metric list (stage, kind, source, how computed), how to run, the plan-reviewer step, the "not yet capturable" list.
- `.claude/skills/capture-metrics/capture.mjs`: pure calculations (exported), data gathering, comment formatting, comment upsert, `--catch-up`. Node 22, no dependencies.
- `.claude/skills/capture-metrics/capture.test.mjs`: calculation, comment and session-reader tests against fixtures and a throwaway git repo.
- `.claude/skills/capture-metrics/hook.test.mjs`: runs the hook script with a stubbed `gh` and `node` on PATH.
- `.claude/hooks/capture-metrics.sh`: matches `gh pr create`, runs `capture.mjs` for the current branch's PR.

Change:
- `.claude/settings.json`: add a `PostToolUse` entry (matcher `Bash`) that runs `capture-metrics.sh`, beside the existing `PreToolUse` entries.
- `vite.config.ts`: only if step 2 shows vitest does not pick up `.claude/**/*.test.mjs`; add them to `test.include`.

Not touched: `src/` (so `src-structure` does not apply), `dist/`, `.github/`, `AI-SDLC.md`, `CLAUDE.md`, `intent/`, `spec/` (except the approval commit already made).

## Order of work
Each step leaves lint, typecheck, test and build green.
1. **Plan.** On branch `build/002-ai-sdlc-metrics` (already holds the spec approval commit), save this plan with `Status: approved` and commit it alone.
2. **Test discovery.** Add a trivial `capture.test.mjs` and run `npm test`. If vitest does not find it under `.claude/`, add the include to `vite.config.ts`. Use `// @vitest-environment node` in the `.mjs` tests so jsdom is not loaded.
3. **Git calculations (Req 1, 2, 3).** In `capture.mjs`: a row builder (`captured_at`, `stage`, `metric`, `kind`, `change`, `value`, `unit`, `source`, `notes`, with empty value and a note when unknown) and the git-derived metrics from the spec table: share of intents accepted, edits to an intent after its spec, intent-to-spec time, spec commits after the first plan commit, `CLAUDE.md` "Common mistakes" lines added per change, and the stage detector (`intent/` is Plan, `spec/` is Design, `plan/` or `src/` is Build, from `git diff --name-only main...HEAD`). Tests alongside.
4. **PR-derived metrics (Req 1, 6).** Functions over `gh pr view/list --json` data: review rounds (a `CHANGES_REQUESTED` review followed by a later commit), first-implementation share (zero review rounds), plan approval to merge (the commit whose message starts "Approve plan NNN" to `mergedAt`), changes merged per week per author next to review rounds, time to first merged PR per author. Rows that need a merge are written empty with a note until the PR merges.
5. **Session metrics.** A reader over `~/.claude/projects/<project>/*.jsonl` (folder name derived from the repo path), yielding per session the first and last timestamps, the first human prompt time, and the files written by `Write`/`Edit` tool calls. From it: time from first conversation to intent (first human prompt of the session that wrote `intent/NNN-*.md`, to that intent's first commit) and concurrent sessions (sessions whose first-to-last span overlaps the current session's). A missing folder or unreadable file gives an empty value and a note. Share of time orchestrating rather than waiting is listed in `SKILL.md` as not yet capturable: it needs a definition, and idle gaps in the transcripts cannot be told apart from the engineer working elsewhere.
6. **Comment (Req 2, 5).** Format the rows as a markdown table behind the marker `<!-- ai-sdlc-metrics -->`; upsert through `gh api repos/{owner}/{repo}/issues/<n>/comments` (list, find the marker, `PATCH` or `POST`). Add the CLI: `node capture.mjs --pr <n>` for the current branch's PR, `--catch-up` for merged PRs with empty post-merge values, `--plan-match <match|minor drift|major drift>` for the judgement row.
7. **Hook (Req 5).** `capture-metrics.sh`: read the hook JSON from stdin, exit 0 unless the command matches `gh pr create`, `cd "$CLAUDE_PROJECT_DIR"`, run `node .claude/skills/capture-metrics/capture.mjs --pr "$(gh pr view --json number -q .number)" --catch-up`, send any error to stderr, always exit 0. Register it in `settings.json`. Tests in `hook.test.mjs`.
8. **Skill (Req 1).** Write `SKILL.md`: the metric table, the manual `/capture-metrics` path, how to ask `plan-reviewer` for a verdict and pass it with `--plan-match`, and the not-yet-capturable list (orchestrating share; Deploy metrics).
9. **Full check.** `npm run lint && npm run typecheck && npm test && npm run build && npm run check:offline`. Then run `node capture.mjs --pr <n>` by hand against PR #12 and #13 and read the comment before relying on the hook.
10. **Push** only with human approval. The hook's first live run is the PR for this change, which doubles as the end-to-end check.

## Parallel work
None. Steps 3 to 6 all edit `capture.mjs`, and the hook, skill and tests depend on it. The change is small enough that separate sessions would cost more than they save.

## Tests
- **Req 1 (every metric listed):** a test reads `AI-SDLC.md`'s Metrics table and `SKILL.md` and fails if a metric named in the table has neither an entry nor a "not yet capturable" line (`capture.test.mjs`).
- **Req 2 (raw rows):** the row builder emits all nine fields; an unknown value is empty with a note, never 0; the table renders as valid markdown with the header row (`capture.test.mjs`).
- **Req 3 (git first, repeatable):** each git calculation runs against a throwaway repo built in the test (intent, spec and plan commits at fixed dates) for a normal case and a missing input (no spec yet), and the same repo gives identical output twice.
- **Req 4 (session stats):** the reader gives the expected values for a fixture `.jsonl`, and an empty value with a note when the folder is missing or a line is malformed.
- **Req 5 (hook and comment):** `hook.test.mjs` pipes hook JSON into the script with a stub `gh` on PATH: a `gh pr create` command calls the script and posts; `git push` and other commands do nothing; a failing script still exits 0 and prints to stderr. Comment upsert: no existing comment POSTs, an existing marker comment PATCHes, and other people's comments are untouched. Stage detection is tested for each prefix.
- **Req 6 (catch-up):** a merged PR with empty post-merge values gets them filled and its comment updated.
- **Req 7 (tested):** the above, run by `npm test` in CI.

Done means: lint, typecheck, test, build and `check:offline` pass, the manual runs in step 9 read correctly, and the hook posts a comment on this change's own PR.

## Risks
- **Highest risk: the hook runs automatically and writes to GitHub.** A bug could post a wrong or duplicate comment on a PR. Contained by the marker (re-runs update rather than add), by always exiting 0, and by running the script by hand against #12 and #13 and reading the output before the hook is registered (step 9 comes before the first live run).
- **Hook payload.** `PostToolUse` input is assumed to carry the command in the same JSON shape the existing hooks read. The hook takes the PR number from `gh pr view` rather than from the tool output, so it does not depend on the output format. The first live run confirms it.
- **Transcript format.** The `.jsonl` layout is Claude Code's and can change. The reader tolerates missing fields and writes empty values with a note.
- **Concurrent sessions is an approximation** (overlapping first-to-last spans), not a measured count. The row's note says so.
- **Review rounds only see GitHub reviews.** For a sole user who does not review on GitHub, every PR shows zero rounds, which inflates the first-implementation share. The note on those rows says reviews were read from GitHub only.
- **Windows and Git Bash.** The hook is bash like the others; the tests spawn `bash`, which is present in Git Bash and on the CI runner.
- **Vitest discovery under `.claude/`.** Checked first in step 2.
- **Spec 002 stays unchanged.** Three decisions here sit inside the spec's open questions and are recorded in Alternatives rejected rather than left open.

## Alternatives rejected
- **GitHub Action to post the comment.** Rejected in the spec: an Action cannot read local session transcripts, and it needs a key or token the repo does not have.
- **Commit the data to a `metrics/` file.** Dropped by the product owner; the PR comment is the record.
- **`PreToolUse` hook that commits before the PR.** Replaced by `PostToolUse` so a PR number exists to comment on.
- **One script per metric.** More files and more shared git plumbing for no benefit at this size.
- **Count `plan-reviewer` rounds as review rounds.** They live in a session, not on GitHub, and cannot be told apart from ordinary work. Deferred; GitHub reviews only.
- **Define orchestrating-versus-waiting from idle gaps.** Gaps cannot separate waiting on Claude from the engineer being away, so the metric is listed as not yet capturable until it is defined.
- **Add the metric definitions to `AI-SDLC.md`.** Outside the spec's requirements, so left for a separate change.

## Open questions
None.

## Deviations
None.

## Verification
1. `npm run lint && npm run typecheck && npm test && npm run build && npm run check:offline`.
2. `node .claude/skills/capture-metrics/capture.mjs --pr 12` prints the table and posts or updates the comment; run it twice and confirm there is still one comment.
3. Open this change's PR with Claude and confirm the hook posts the comment with no further action.
