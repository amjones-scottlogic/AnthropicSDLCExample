# Metrics

What this project records about how the AI-native SDLC is working, and where to find it. The metrics themselves are defined in [AI-SDLC.md](AI-SDLC.md); how each is calculated is in [the `capture-metrics` skill](.claude/skills/capture-metrics/SKILL.md).

## Where and when

- One comment on each pull request, headed `AI-SDLC metrics`.
- A Claude Code hook updates it after Claude runs `gh pr create` and after each `git push` to a branch with an open PR. It runs on your machine, so nothing is captured for a PR opened in the browser or by the `write-spec` Action until someone runs it locally.
- To run it by hand: `node .claude/skills/capture-metrics/capture.mjs --pr <number>`. Re-running updates the same comment.

## Format

A table with one row per measurement and the fields `captured_at`, `stage`, `metric`, `kind` (leading or lagging), `change`, `value`, `unit`, `source` (`git` or `session`) and `notes`. It copies straight into a spreadsheet. An empty `value` means it could not be worked out, and `notes` says why. It is never 0 unless something was counted and found to be none.

## What is captured

- **From git and GitHub:** how long intents, specs and plans take to move between stages, edits made after a later stage started, review rounds, how often a PR merges on its first implementation, time from plan approval to merge, merged PRs per week per author, and repeated mistakes added to `CLAUDE.md`.
- **From Claude session transcripts:** time from first conversation to the committed intent, concurrent sessions, and whether the merged diff still matches its plan (a `plan-reviewer` verdict).
- **Skill usage:** for each PR, which repository skills were used and how many times each, counted from every session entry made on the PR's branch, including subagents.
- **Tokens:** input, output, cache read and cache write tokens for the same work, by model. Dollar cost is not recorded, so prices can be applied later.

## Things to know

- **Repository skills only.** Skills defined under `.claude/skills/` are counted. Personal, plugin and built-in skills are not.
- **By contributor.** Transcripts stay on each person's machine, so each run records its own sessions, labelled with the git author name in `notes`. A PR author with no rows is marked `no session data captured`.
- **Privacy.** Only counts and names are posted: skill names, model names, token totals and the git author name. Prompts, replies and code from transcripts are never posted.
- **Approximate.** Branch attribution misses work done in a session that never touched the branch, and the session metrics depend on Claude Code's transcript format.
- **Not yet captured:** time spent orchestrating rather than waiting, and Deploy metrics, which are not yet defined.
- **Charts** are a later intent. This only records the data.
