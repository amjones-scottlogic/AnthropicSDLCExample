---
name: plan
description: Write an implementation plan from an approved spec, in plan mode, before any code changes. Use when the user asks to plan, start building or implement a spec, or to move an approved spec into the Build stage. Reads intent/NNN-*.md and spec/NNN-*.md and writes plan/NNN-*.md for the engineer to interrogate and approve.
---

# Plan

Turn an approved spec into `plan/NNN-short-title.md`: the files to change, the order of work, the risks and the tests that prove it works. This is the first half of the Build stage of the AI-native SDLC. No code changes until the engineer approves the plan.

## Process

1. **Find the spec.** Use the one the user names, or ask which. Read it and its intent in full.
2. **Check it is approved.** If the spec's `Status` is not `approved`, stop and tell the user. Only the product owner approves a spec.
3. **Stay in plan mode.** Read-only exploration of the codebase. Do not edit source files. Apply the `project-standards` skill.
4. **Write the plan** to `plan/` using the same number and title as the spec, with the template below. Name real files and real tests, found by reading the code, not guessed.
5. **Hand it over for interrogation.** Summarise the riskiest step and the main rejected alternative, then invite the engineer to probe. Expect and answer: What could this break? Which step is the highest risk? What alternatives were rejected and why?
6. **Iterate** until someone who was not in the conversation could execute the plan alone. Fold every answer back into the plan so it does not live only in chat.
7. **Wait for approval.** The engineer approves the plan before any code changes. Higher-risk changes also go to a tech lead or architect. Set `Status: approved` only when told.
8. **Commit the plan** with the approved status, on a branch, before or with the first implementation commit. Do not push without the usual approval.
9. **Implement the plan**, step by step. If the implementation departs from the plan (different file, order, approach or test), update the plan in the same commit and record the change under Deviations. The `plan-sync` hook enforces this on `git commit`.

## Template

```markdown
# Plan: [descriptive title]
Spec: [link to the spec file]. Intent: [link to the intent file]. Status: draft.

## Approach
[One paragraph: the chosen approach and why.]

## Files
[Every file to create or change, one line each: path and what changes.]

## Order of work
[Numbered, buildable steps. Each leaves the project working. Say which spec requirements each step satisfies.]

## Parallel work
[Which steps can run at the same time in separate sessions, each in its own worktree and branch. For each, the files it owns; no file may appear in two parallel tasks. Say which steps must wait for another and why. If nothing can run in parallel, say "None" and why. Use the `src-structure` skill's domain boundaries to find the split.]

## Tests
[Which tests validate each requirement, and the acceptance criteria that mean "done". Name the test files.]

## Risks
[What could break, constraints (limits, dependencies, data), the highest-risk step and how it is contained.]

## Alternatives rejected
[Each alternative and why it lost.]

## Open questions
[Anything unresolved. Must be empty before approval.]

## Deviations
[Added during implementation: date, what departed from the plan, and why. "None" until then.]
```

## Rules

- Split work for parallel sessions only along file boundaries. Shared files (routing in `App.tsx`, `package.json`, shared models) go in an early step that finishes before the parallel tasks start.
- Plan only what the spec asks for. Do not add scope.
- The plan must be executable by someone who was not in the conversation. No "as discussed".
- A plan changed after approval is fine when reality demands it, but only with a Deviations entry in the same commit as the code.
- Keep it as short as it can be while still being executable.
