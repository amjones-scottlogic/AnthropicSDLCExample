# Spec: Capture skill usage in the PR metrics
Intent: [intent/008-skill-usage-metrics.md](../intent/008-skill-usage-metrics.md). Status: draft.

## Summary
Extend the `capture-metrics` skill so the PR metrics comment also records which of the repository's skills were used while the PR was built, how many times each was used, and the token usage of that work. The data comes from Claude session transcripts on the contributor's machine, attributed to the PR by branch. It is recorded as extra rows in the existing metrics comment, in the same raw format, and refreshed with it. It captures data only. The dashboard is a separate intent.

## Requirements

1. **Skill counts per PR.** For a PR, the comment has one row per repository skill used, with the number of times it was invoked.
   - `metric` is `Skill invocations`, `kind` is `leading`, `stage` is the stage(s) the PR touches, `change` is the PR number, `value` is the count, `unit` is `invocations`, `source` is `session`.
   - The skill name goes in `notes`, so each skill is its own row and new skills add rows, not columns.
   - A PR with sessions but no repository skill invocations gets one row with `value` 0 and a note, so "none used" is distinguishable from "not captured".
2. **Repository skills only.** Only skills defined in the repository (a folder under `.claude/skills/` with a `SKILL.md`) are recorded.
   - Personal skills, plugin skills and built-in skills are dropped before the comment is built. They do not appear in the comment, even as a total.
   - The filter runs in the script, before any row is created, so an excluded name never reaches the comment.
3. **Token usage per PR.** The comment has one row per model and token type, for the same sessions: input, output, cache read and cache write.
   - `metric` is `Tokens`, `unit` is `tokens`, `source` is `session`, and `notes` holds the model and the token type.
   - Dollar cost is not recorded (see Out of scope).
4. **"Used in the PR" means every entry made on the PR's branch.** A session entry counts towards a PR when it was made on the PR's branch, with no cutoff at the branch's first commit.
   - A session that moves between branches contributes to each branch only what it did there.
   - Subagent activity counts. Skills called by subagents, and their token usage, are included with the session that started them.
5. **Raw data, same format.** The rows use the existing fields and table, so the comment still copies into a spreadsheet or reads by script without conversion.
   - A value that cannot be worked out is left empty with the reason in `notes`, never written as 0 (for example, no transcripts found on this machine).
   - `notes` also says the counts are by branch, so a reader knows how they were attributed.
6. **Refreshed with the comment.** Re-running for the same PR (including on push) updates the existing metrics comment. The skill and token rows are replaced, not appended.
7. **Per contributor.** Each contributor's run records only their own sessions, and every row says whose it is.
   - `notes` includes the contributor's git author name.
   - A run replaces only the rows for its own contributor and leaves other contributors' rows in the comment untouched.
   - A git author with commits on the PR branch but no rows in the comment gets one `Skill invocations` row with an empty `value` and the note `no session data captured`, so a gap is not read as zero use. It is replaced by the contributor's real rows once they run it themselves.
8. **Counts and names only.** The comment never contains transcript text. It holds skill names, model names, token totals, the branch and the git author name, and nothing else taken from a transcript.
9. **Never blocks.** If transcripts cannot be read, the script writes empty values with a note and the rest of the comment is posted as before.
10. **Tested** (see Testing).

## Design

- **Source: session transcripts.** The intent names the output of `/usage` and `/cost`. Those are interactive commands that a script cannot run or read, so the data comes from the session transcripts (`.jsonl`) they are built from. `capture.mjs` already reads these for the other session metrics. Each `Skill` tool call is recorded with the skill name, each assistant message carries its token usage and model, and each entry records the `gitBranch` it was made on. This needs no new tooling and gives one source for all session metrics.
- **Subagents.** A subagent's activity is not in its parent's transcript. It is in its own file at `<sessionId>/subagents/agent-*.jsonl`, with the same `gitBranch` and usage fields. `loadSessions` currently reads only the top-level `.jsonl` files, so it is extended to read each session folder's `subagents/` files too, and fold them into the same branch totals.
- **Where it goes.** Extend `parseSession` in `.claude/skills/capture-metrics/capture.mjs` to also return, per branch: a count of invocations by skill name, and token usage summed by model and type. Add a function that totals these for a branch, and add the rows in `buildRows`. `SKILL.md` gets two new metric entries (`Skill invocations`, `Tokens`) with source `session`. No new files, hook or workflow.
- **Attributing a session to a PR.** Match on branch name alone. The branch is already known to `gatherContext`. Entries are tagged with the branch checked out at the time, so none can predate the branch. This is an approximation: work done in a session that never touched the branch is not counted.
- **Repository skills.** The script lists the folders under `.claude/skills/` that contain a `SKILL.md` and keeps only invocations of those names. Everything else is discarded when the transcript is read, so it can't be posted later by mistake.
- **Skill name.** Taken from the `Skill` tool call's `skill` input. Skills the harness loads from a slash command typed by the user also appear in the transcript as skill invocations and are counted the same way.
- **Contributors with no data.** The script compares the git authors on the branch with the contributors who have rows in the comment, and adds the `no session data captured` row for any author without one.
- **Contributor rows.** The comment update reads the existing rows, removes those whose contributor matches the runner, and adds the new ones, instead of replacing the whole table. The existing marker is kept so there is still one comment per PR. The contributor is the git author name, so a changed `user.name` appears as a new contributor.
- **Idempotent.** The same transcripts and branch give the same rows, so re-running does not change the numbers unless new work was done.
- **Project standards.** The standards constrain the todo app, not the repository's tooling. The script runs on the contributor's machine and reads local files. Nothing ships in `dist/`.

## Testing

- Unit tests in `capture.test.mjs`, using small transcript fixtures built in the test, covering:
  - counts per skill across two sessions;
  - entries on other branches excluded, with no first-commit cutoff;
  - a personal, a plugin and a built-in skill dropped, and only repository skills counted;
  - token totals by model and type;
  - a skill call and token usage in a subagent file counted with its parent session;
  - an author with commits but no rows getting the `no session data captured` row, and losing it once their own rows exist;
  - no transcripts (empty value with a note);
  - a PR with sessions but no repository skill calls (a 0 row with a note);
  - a re-run replacing the runner's rows instead of duplicating them;
  - another contributor's rows left in place when a different contributor runs.
- A privacy test: a transcript containing a distinctive prompt string and a personal skill name produces a comment containing neither.
- A test that malformed transcript lines are skipped without failing the run, as for the existing session metrics.

## Out of scope

- Charts, graphs and any display of the data (the dashboard intent).
- Dollar cost figures. Tokens are recorded with the model so the dashboard can apply prices later.
- Recording personal, plugin or built-in skill use, even as a total.
- Skills used in sessions on other contributors' machines, other than via their own runs.
- Backfilling skill and token data for PRs merged before this ships.
- Counting plugin skills the team relies on, such as `code-review`. A repo-held allowlist is a possible later extension.
- Making the rule project-wide in `AI-SDLC.md`. It applies to this script, enforced by the spec and its test.

## Open questions

None.

## Flagged concerns

Resolved by the product owner:

1. **Data source.** Transcripts are used in place of the `usage` and `cost` command output, because a script cannot run or read the commands. Accepted.
2. **Cost.** Tokens by model and type are recorded, not dollars. Accepted.
3. **Attribution.** Every entry on the branch counts, with no first-commit cutoff. Accepted.
4. **Contributors.** Rows are keyed by contributor and each run replaces only its own. Accepted.
5. **Privacy.** Only counts and names are posted, with a test, and `AI-SDLC.md` is unchanged. Accepted, and extended to repository skills only.

Open questions resolved by the product owner:

- Subagent skills and tokens are counted, from their own transcript files.
- Authors with no captured data get an explicit `no session data captured` row.
- Plugin skills are not counted: repository skills only.

Remaining:

6. **Standards.** The `project-standards` constraints (no backend, no network calls) do not apply to repository tooling, so no conflict is raised.
