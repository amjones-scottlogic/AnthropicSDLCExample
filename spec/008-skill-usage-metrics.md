# Spec: Capture skill usage in the PR metrics
Intent: [intent/008-skill-usage-metrics.md](../intent/008-skill-usage-metrics.md). Status: draft.

## Summary
Extend the `capture-metrics` skill so the PR metrics comment also records which skills were used while the PR was built, how many times each was used, and the token usage of that work. The data comes from Claude session transcripts on the contributor's machine, attributed to the PR by branch. It is recorded as extra rows in the existing metrics comment, in the same raw format, and refreshed with it. It captures data only. The dashboard is a separate intent.

## Requirements

1. **Skill counts per PR.** For a PR, the comment has one row per skill used, with the number of times it was invoked.
   - `metric` is `Skill invocations`, `kind` is `leading`, `stage` is the stage(s) the PR touches, `change` is the PR number, `value` is the count, `unit` is `invocations`, `source` is `session`.
   - The skill name goes in `notes`, so each skill is its own row and new skills add rows, not columns.
   - A PR with sessions but no skill invocations gets one row with `value` 0 and a note, so "none used" is distinguishable from "not captured".
2. **Usage and cost per PR.** The comment has one row per token type, for the same sessions: input, output, cache read and cache write.
   - `metric` is `Tokens`, `unit` is `tokens`, `source` is `session`, and the token type goes in `notes`.
   - Dollar cost is not recorded (see Flagged concerns).
3. **"Used in the PR" means every commit on the PR branch.** A session counts towards a PR when its transcript entries were made on the PR's branch.
   - Only entries made on that branch are counted, so a session that moves between branches contributes to each in proportion to what it did there.
   - Entries are counted from the first commit on the branch against `main`, not before, so work done before the branch existed is excluded.
4. **Raw data, same format.** The rows use the existing fields and table, so the comment still copies into a spreadsheet or reads by script without conversion.
   - A value that cannot be worked out is left empty with the reason in `notes`, never written as 0 (for example, no transcripts found on this machine).
5. **Refreshed with the comment.** Re-running for the same PR (including on push) updates the existing metrics comment. The skill rows are replaced, not appended.
6. **Per contributor.** Each contributor's run adds only their own sessions. Every row says whose it is.
   - `notes` includes the contributor's git author name. Two contributors working on one PR produce separate rows, and the comment holds the combined result (see Open questions).
7. **Never blocks.** If transcripts cannot be read, the script writes empty values with a note and the rest of the comment is posted as before.
8. **Tested** (see Testing).

## Design

- **Source: session transcripts, not the commands.** `/usage` and `/cost` are interactive Claude Code commands. A script cannot run them or read their output. The same information is in the session transcripts (`.jsonl`) that `capture.mjs` already reads for the other session metrics: each `Skill` tool call is recorded with the skill name, each assistant message carries its token usage, and each entry records the `gitBranch` it was made on. Using the transcripts needs no new tooling and keeps one source for all session metrics. See Flagged concerns.
- **Where it goes.** Extend `parseSession` in `.claude/skills/capture-metrics/capture.mjs` to also return, per session and per branch: a count of invocations by skill name, and summed token usage by type. Add a function that totals these for a branch, and add the rows in `buildRows`. `SKILL.md` gets two new metric entries (`Skill invocations`, `Tokens`) with source `session`. Nothing else changes: no new files, hook or workflow.
- **Attributing a session to a PR.** Match on branch name. The branch is already known to `gatherContext`. Entries after the first commit of the branch are counted. This is an approximation: work done on the branch before its first commit, or in a session started elsewhere, is not counted.
- **Skill name.** Taken from the `Skill` tool call's `skill` input, recorded as given. Skills the harness loads from a slash command typed by the user also appear in the transcript as skill invocations and are counted the same way.
- **Idempotent.** The same transcripts and branch always give the same rows, so re-running does not change the numbers unless new work was done.
- **Project standards.** The standards constrain the todo app, not the repository's tooling. The script runs on the contributor's machine, reads local files and posts only counts, never transcript content, to the PR. Nothing ships in `dist/`.

## Testing

- Unit tests in `capture.test.mjs`, using small transcript fixtures built in the test, covering: counts per skill across two sessions; entries on other branches excluded; entries before the branch's first commit excluded; token totals by type; no transcripts (empty value with a note); a PR with sessions but no skill calls (a 0 row with a note); a re-run replacing the rows instead of duplicating them.
- A test that malformed transcript lines are skipped without failing the run, as for the existing session metrics.

## Out of scope

- Charts, graphs and any display of the data (the dashboard intent).
- Dollar cost figures (see Flagged concerns).
- Skills used in sessions on other contributors' machines, other than via their own runs.
- Backfilling skill and token data for PRs merged before this ships.
- Subagent sessions and skills they invoke, unless the transcript format records them in the same file (see Open questions).

## Open questions

- Is the transcript-based approach acceptable in place of the `usage` and `cost` command output the intent names? See Flagged concerns.
- With several contributors, whose rows win? Each run posts only the runner's sessions, and the comment is one per PR. Options: rows are keyed by contributor so each run replaces only its own, or only the PR author's run counts. This spec assumes rows keyed by contributor, and needs the product owner's decision.
- Should the cost be recorded in dollars? That needs a price table per model, which changes over time.
- Does a session that spans several branches or PRs need anything beyond the per-branch split described here?
- Are skills invoked by subagents recorded in the parent transcript? If not, they are not counted.

## Flagged concerns

1. **Departs from the intent's data source.** The intent says the data comes from the output of the `usage` and `cost` commands. Those are interactive and cannot be run or read by a script, so this spec uses the session transcripts they are built from instead. The numbers should agree, but they are not the commands' own output.
2. **Intent's `cost` is not dollars here.** Transcripts hold token counts, not prices. This spec records tokens by type. Dollar figures need a maintained price table, which the intent's "keep it simple" constraint argues against. Flagged for the product owner to decide.
3. **Attribution by branch is approximate.** Skill use and tokens for work before the first commit on the branch, or done in a session that never touched the branch, are missed. The intent's open question about this is answered here with a stated approximation, not exactly.
4. **Per-contributor data in a shared comment.** The hook runs locally, so each contributor can only see their own transcripts, but the comment is shared. See the open question on contributors.
5. **Privacy.** Transcripts contain prompts and code. Only counts are posted. Flagged in case the product owner wants this stated as a requirement in `AI-SDLC.md`.
6. **Standards.** The `project-standards` constraints (no backend, no network calls) do not apply to repository tooling, so no conflict is raised.
