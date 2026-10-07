# Intent: Coding standards
Author: Andrew Jones (originator and sole user). Status: accepted.

## Problem
There is no written standard for how code in this project is written, so style rules only come out when I review a pull request. The review of the todo app PR (#10) found several: constants should be UPPER_CASE with names that say what they are for, `if` statements should always have braces and a new line, refs and handlers need descriptive names, and components were too big. Each of these was fixed by hand, and nothing stops them coming back, whether the code is written by me or by Claude.

## Proposed outcome
- A `coding-standards` skill in `.claude/skills/`, and a short human-readable document in a new `docs/` folder at the repo root, so Claude and people follow the same rules. The `src-structure` skill is updated to include the `docs/` folder.
- The starting rules, taken from the PR #10 review:
  - Module-level constants are UPPER_CASE and named for what they are used for, for example `TRACKER_STORAGE_KEY` and `STORAGE_VERSION`.
  - No one-line `if` statements: always braces and a new line.
  - Descriptive names. Refs end in `Ref` (`cancelRef`, `nameInputRef`). A handler that holds logic inside a component is `handleX` (`handleClose`); a prop that is just passed through is `onX`.
  - Components stay small. About 100 lines is a rough guide, not a limit: it is a judgement call, and a larger component is fine when there is no clean way to break it down.
  - A pull request stays small enough to read. The limit is 1000 changed lines, counted the usual way (lines added plus lines deleted, leaving out lockfiles and generated files), so a reviewer can follow the whole change.
- Wherever a rule can be checked automatically, it is enforced, so CI fails on a violation rather than waiting for a reviewer to notice. Which rules, and how, is decided in the spec for this intent.
- The existing code is brought in line, including `src/theme/theme.ts`, `ProgressRing` and `scripts/check-offline.mjs`, which were left alone in PR #10. This goes in the same pull request as the lint enforcement, because enforcing the rules would otherwise make lint fail on the old code. That pull request is an allowed exception to the 1000-line limit if it needs to be.
- `CLAUDE.md` points to the coding standards, so they are read at the start of any piece of work.
- Specs, plans and reviews can point at the standards in the same way they point at `project-standards` and `src-structure`.

## Affected users and systems
- Users: just me, and Claude when it writes or reviews code here.
- Systems: `.claude/skills/` (new `coding-standards` skill, and an update to `src-structure`), a new `docs/` folder with the standards document, `eslint.config.js` and the CI lint step, and the existing code under `src/` and `scripts/`.

## Constraints
- Keep it simple: no extra tooling unless we have to.
- The standards must not contradict the `project-standards` and `src-structure` skills. Where folder layout is concerned, `src-structure` stays the source.
- Accessibility lint rules (jsx-a11y) stay on, as `CLAUDE.md` already requires.
- Rules that need judgement, such as component size, are guidance and are not enforced automatically.
- The pull request size limit is a guide to keep changes readable. The only planned exception is the change that brings the existing code in line.

## Open questions
- **Enforcing the pull request size limit:** is it a CI check, a warning on the pull request, or only a rule for the author and reviewer? The spec decides, with the ESLint rules.
