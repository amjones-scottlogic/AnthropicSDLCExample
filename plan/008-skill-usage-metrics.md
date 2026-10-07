# Plan: Capture skill usage in the PR metrics
Spec: [spec/008-skill-usage-metrics.md](../spec/008-skill-usage-metrics.md). Intent: [intent/008-skill-usage-metrics.md](../intent/008-skill-usage-metrics.md). Status: approved.

## Approach
Extend the existing `capture.mjs` rather than adding anything new. `parseSession` already reads each transcript line by line; it also learns to return, per branch, the repository-skill invocations and the token usage by model and type, filtering out non-repository skills as it reads so they never reach a row. `loadSessions` also reads each session folder's `subagents/*.jsonl` and folds those into their parent session. A new pure function totals one contributor's data for one branch and `buildRows` turns it into `Skill invocations` and `Tokens` rows, plus a `no session data captured` row for any git author on the PR with no data. Because several contributors share one comment, the comment update changes from "replace the table" to "replace the table except other contributors' skill and token rows", which needs a small parser that reads those rows back out of the existing comment. Everything stays in one dependency-free script, and `SKILL.md` gains the two new metric entries.

## Files
Change:
- `.claude/skills/capture-metrics/capture.mjs`: `parseSession` (per-branch skill counts, tokens by model and type, de-duplicated by `message.id`); `loadSessions` (subagent files, repo skill list); new `repoSkills`, `branchTotals`, `parseComment`, `mergeContributorRows`; `buildRows` (new rows); `gatherContext` (runner name, branch, repo skills, authors); `runForPr` (merge other contributors' rows).
- `.claude/skills/capture-metrics/capture.test.mjs`: tests listed under Tests.
- `.claude/skills/capture-metrics/SKILL.md`: two new metric rows (`Skill invocations`, `Tokens`), a note on contributor rows and the repo-skills-only rule.
- `.claude/skills/capture-metrics/hook.test.mjs`: only if the hook's comment handling is affected (expected: no change).

Not touched: `src/` (so `src-structure` does not apply), `dist/`, `.github/`, `AI-SDLC.md`, `CLAUDE.md`, `.claude/hooks/capture-metrics.sh`, `.claude/settings.json`, `intent/`, `spec/`. No new files other than this plan.

## Order of work
Each step leaves `npm test`, lint and typecheck green.
1. **Plan.** On branch `build/008-skill-usage-metrics` (already cut from `main` after the spec approval merged), save this plan with `Status: approved` and commit it alone.
2. **Read the data (Req 1, 2, 3, 4).** Extend `parseSession` so each session also returns `byBranch: { [branch]: { skills: { name: count }, tokens: { 'model|type': count } } }`.
   - Skills: count each `tool_use` with `name: 'Skill'` whose `input.skill` is in the repository skill set passed in. Also count a user entry carrying `<command-name>/NAME</command-name>` when `NAME` is in the set (typed slash commands; see Risks).
   - Tokens: for each assistant entry with `message.usage`, add `input_tokens`, `output_tokens`, `cache_read_input_tokens` and `cache_creation_input_tokens` under `message.model`, **once per `message.id`** (transcripts repeat a message's line with identical usage).
   - Branch is the entry's `gitBranch`; an entry with none goes under `''` and is never matched.
   - Add `repoSkills(cwd)`: folder names under `.claude/skills/` that contain `SKILL.md`.
   - Existing session fields (first, last, firstHuman, written) are unchanged, so the existing session metrics are unaffected.
3. **Subagents (Req 4).** `loadSessions(dir, repoSkills)` also reads `<dir>/<sessionId>/subagents/*.jsonl` for each session and merges each file's `byBranch` into the parent. A subagent file adds no span, so concurrent-session counts are unchanged. A missing folder or unreadable file is skipped, as today.
4. **Totals and rows (Req 1, 2, 3, 5, 7, 8).** `branchTotals(sessions, branch)` sums `byBranch[branch]` across sessions. In `buildRows`, for the runner:
   - one `Skill invocations` row per skill, `value` the count, `unit` `invocations`, `notes` `"<contributor>; skill: <name>; counted by branch"`;
   - if the branch has session entries but no repository skills, one row with `value` 0 and note `"<contributor>; none used; counted by branch"`;
   - one `Tokens` row per model and type, `unit` `tokens`, `notes` `"<contributor>; <model>; <type>; counted by branch"`;
   - `stage` is the PR's stages joined with ` + `, `change` is `PR <n>`, `source` is `session`, `kind` is `leading`;
   - when transcripts cannot be read, one `Skill invocations` row with an empty value and note `"<contributor>; no session data captured; transcripts not found on this machine"`.
   - Only skill names, model names, counts, branch and git author name are ever written; no transcript text.
5. **Authors with no data (Req 7).** `gatherContext` reads the authors of the PR's commits (the first author on each commit from `gh pr view --json commits`; co-authors such as Claude are ignored). Any author with no `Skill invocations` row in the merged result gets one row with empty value and note `"<author>; no session data captured"`.
6. **Contributor merge (Req 6, 7).** `parseComment(body)` reads the table rows back out of an existing metrics comment (splitting on unescaped `|`, undoing `\|`). `mergeContributorRows(existingRows, newRows, runner)` keeps existing `Skill invocations` and `Tokens` rows whose contributor (the text before the first `;` in `notes`) is someone other than the runner, drops those for the runner, drops a placeholder row for any contributor who now has real rows, and appends the new rows. `runForPr` applies it before `formatComment`, so the one-comment-per-PR marker behaviour and the plan-match marker are untouched. Other rows are regenerated each run, as now.
7. **Skill doc.** `SKILL.md`: add the two metric rows to the table, a short section on contributor rows and the repository-skills-only rule, and a note that session metrics now include subagent files.
8. **Full check.** `npm run lint && npm run typecheck && npm test && npm run build && npm run check:offline`. Then read-only verification against real data: run `parseSession` over this machine's transcripts and compare skill counts to `grep` counts for the same branch, and compare token totals to a de-duplicated sum. Do not post until the numbers read correctly.
9. **Push** only with human approval. The hook's next run on this PR is the end-to-end check.

## Parallel work
None. Steps 2 to 6 all edit `capture.mjs` and `capture.test.mjs`, and each depends on the one before. The change is small enough that separate sessions would cost more than they save.

## Tests
All in `capture.test.mjs`, using small transcript fixtures built in the test, run by `npm test` in CI.
- **Req 1 (skill counts):** counts per skill across two sessions; a PR with sessions but no repository skill calls gives one 0 row with a note.
- **Req 2 (repository skills only):** a personal skill, a plugin skill (`plugin:skill`) and a built-in skill are dropped, and a skill with a `SKILL.md` under `.claude/skills/` is counted; `repoSkills` ignores a folder without `SKILL.md`.
- **Req 3 (tokens):** totals by model and type; a message repeated across lines with the same `message.id` is counted once.
- **Req 4 (branch rule, subagents):** entries on other branches excluded; entries before the branch's first commit included; a skill call and token usage in a `subagents/` file counted with its parent session; a missing `subagents/` folder is fine.
- **Req 5 (raw rows):** rows have all nine fields; no transcripts gives an empty value with a note, never 0; the `counted by branch` note is present.
- **Req 6 (refresh):** a re-run replaces the runner's rows and does not duplicate them (through `runForPr` with a stub `gh`).
- **Req 7 (contributors):** another contributor's rows are kept when a different contributor runs; an author with commits but no rows gets the `no session data captured` row, which goes once their real rows exist; co-authors such as Claude get no row; `parseComment` round-trips `formatComment` output including a `|` in a cell.
- **Req 8 (privacy):** a transcript containing a distinctive prompt string and a personal skill name produces a comment containing neither.
- **Req 9 (never blocks):** malformed transcript lines are skipped without failing, as for the existing session metrics.
- **Regression:** the existing session-metric and comment tests still pass unchanged.

Done means: lint, typecheck, test, build and `check:offline` pass, the step 8 real-data comparison agrees, and the hook posts a comment with the new rows on this change's own PR.

## Risks
- **Highest risk: the comment merge.** Changing the update from "replace" to "merge by contributor" touches the comment every PR relies on. A parsing bug could drop other contributors' rows or garble the table. Contained by `parseComment` being tested against `formatComment`'s own output (round trip, escaped pipes), by only ever touching `Skill invocations` and `Tokens` rows (everything else is regenerated as today), and by reading the merged output against a real PR before relying on it.
- **Duplicated transcript lines.** Checked on a real transcript: 104 assistant lines for 54 unique message ids, with identical usage on the repeats. Summing every line would roughly double the tokens, so counts are de-duplicated by `message.id`. If the format changes and ids go missing, the fallback is to count lines without an id once each and say so in `notes`.
- **Typed slash commands.** The spec says a skill started with a typed `/name` counts like a `Skill` call, but I could only confirm the `Skill` tool call format on real data (`/clear` was the only typed command in the transcripts I read). The plan also counts a `<command-name>/NAME</command-name>` entry for a repository skill. If real transcripts show neither form for typed skills, those uses are missed. Step 8 checks this by typing one repository skill and reading the transcript.
- **Attribution by branch is approximate.** Work in a session that never touched the branch is not counted, and a reused branch name would count entries from the earlier use. The comment's note says counts are by branch.
- **Contributor identity is the git author name.** A changed `user.name` appears as a new contributor, and the runner's name comes from `git config user.name`, which may differ from the name on the commits.
- **Subagent files are an undocumented layout.** `<sessionId>/subagents/agent-*.jsonl` was seen on this machine, not specified anywhere. The reader tolerates a missing folder and unreadable files; if the layout changes, subagent usage drops out silently, understating counts.
- **Privacy.** Transcripts hold prompts and code. Only names and numbers leave the script, and a test checks that.
- **Windows paths.** Folder reading uses `node:path` as the existing loader does.

## Alternatives rejected
- **Run `/usage` and `/cost` and parse their output.** A script cannot run or read interactive commands (resolved with the product owner in the spec).
- **Record dollar cost.** Needs a price table that goes stale; tokens with the model are recorded so the dashboard can price them later.
- **Replace the whole comment per contributor.** Each run would erase the others' rows.
- **A comment per contributor.** Clutters the PR and makes the dashboard gather more comments.
- **A session ID trailer on every commit for exact attribution.** A new step for every contributor, against "keep it simple".
- **A separate script or file for the new metrics.** More plumbing for no benefit; the transcript reader and comment code already live in `capture.mjs`.
- **Count plugin skills via an allowlist.** Deferred by the product owner; repository skills only.

## Open questions
None.

## Deviations
2026-10-07:
- **Added `metrics.md` at the repository root.** Requested by the product owner during the build: a brief file explaining what is captured. The plan said no new files other than the plan. It describes the existing metrics comment and the new skill and token rows, and links to `AI-SDLC.md` and the skill for the definitions.
- **`parseSession` ignores a transcript line that parses to something other than an object** (for example a bare `null`). The new malformed-lines test showed such a line made the whole file unreadable, so a transcript with one stray `null` would have contributed nothing.
- **Tokens are written under `notes` as `<contributor>; <model>; <type>; counted by branch`**, as planned; the tests read the model and type back from there.

## Verification
1. `npm run lint && npm run typecheck && npm test && npm run build && npm run check:offline`.
2. Run the new reader over this machine's transcripts; compare skill counts by branch with `grep` and token totals with a de-duplicated sum.
3. `node .claude/skills/capture-metrics/capture.mjs --pr <n>` on a PR you can safely update: the comment gains the new rows, running it twice leaves one comment, and a second contributor's rows (simulated in a test comment) survive.
4. Open this change's PR and confirm the hook posts the new rows with no further action.
