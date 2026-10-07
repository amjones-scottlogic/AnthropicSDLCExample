# Intent: Continuous evals in CI
Author: Andrew Jones (originator and sole user). Status: accepted.

## Problem
`CLAUDE.md`, the skills in `.claude/skills/` and the hooks in `.claude/hooks/` decide how Claude behaves in this repo, but a change to any of them is only checked by reading it. A line dropped from `CLAUDE.md`, a reworded skill or a changed hook can quietly make Claude worse, and I would only find out when it repeats a mistake in later work. CI tests the app, not the agent's instructions.

This comes from the "Continuous evals in CI" lesson in the AI-native SDLC playbook. It builds on the feedback loop in intent 007.

## Proposed outcome
- **Evals.** A set of evals kept in the repo. Each is a real task for Claude Code with a known good outcome: a prompt plus the checks that say it was done well, such as tests passing, lint clean, no existing tests removed, and policy checks (for example, nothing that breaks `project-standards`).
- **A small starter set.** The first evals come from tasks and mistakes in this repo's own history, such as the problems found in the review of PR #10. The set grows: every mistake that gets a line in the "Common mistakes" list in `CLAUDE.md` also becomes a permanent eval.
- **Run in CI, on config changes.** The evals run in GitHub Actions, with Claude Code running without a person at the keyboard, when a pull request changes `CLAUDE.md`, `.claude/` or the evals themselves. They do not run on a schedule, so nothing is spent when nothing changes.
- **Results on the pull request.** The pass rate and each failing eval are reported on the pull request, so the change is reviewed with the results in front of the reviewer. A run passes when 75% or more of the evals pass. A failing run, or a failing eval, warns; it does not block the merge.
- **Fair tests.** An eval cannot be passed by tampering with it: the checks run from a trusted copy, and the agent does not see the eval files while it works.
- **One model.** The evals run against a single model. If the base model changes, the evals are dealt with then.
- **Own API key and cap.** The evals use their own API key, stored as a GitHub secret, with its own spending cap.

## Affected users and systems
- Users: just me, and Claude when it changes `CLAUDE.md`, skills or hooks.
- Systems: a new `evals/` folder, a new GitHub Actions workflow, a GitHub secret for the API key, and `CLAUDE.md` (a note on how a mistake becomes an eval). Anything the evals check against, such as `project-standards`, is read and not changed.

## Constraints
- The evals test the agent's configuration, not the app. They are separate from the app's CI (`npm run verify`) and do not slow it down.
- The API key has a hard spending cap of its own, so a run cannot cost more than a known amount.
- Keep it simple: no tooling beyond GitHub Actions, Claude Code and shell or Node scripts.
- Warn only, for now. Making a failing eval block merges is a later decision.
- The evals must not weaken the other standards: the app stays browser-only with no external calls, and the evals touch no user data.

## Open questions
- **Which starter tasks?** The spec picks the first few from the repo's history, after a deeper look.
