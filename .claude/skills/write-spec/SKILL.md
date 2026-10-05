---
name: write-spec
description: Write a requirements and design spec from an accepted intent. Use when the user asks to write, draft or generate a spec, or to move an accepted intent into the design stage. Reads intent/NNN-*.md and writes spec/NNN-*.md, applying the project-standards skill and flagging concerns.
---

# Write spec

Turn an accepted intent into `spec/NNN-short-title.md`, covering requirements and design in one pass. This is the Design stage of the AI-native SDLC. The spec is ready to hand to the Build stage.

## Process

1. **Find the intent.** Use the one the user names, or ask which. Read it in full.
2. **Check it is accepted.** If `Status` is not `accepted`, stop and tell the user. Only the product owner can accept an intent.
3. **Load the constraints.** Apply the `project-standards` skill. The spec must conform to it.
4. **Write the spec** to `spec/` using the same number and title as the intent, with the template below.
5. **Flag concerns.** Anything that conflicts with the standards, contradicts the intent, or can't be satisfied goes under Flagged concerns, with the reason. Say so plainly rather than quietly picking a side.
6. **Carry open questions forward.** Answer each of the intent's open questions if it can be answered from the intent and standards. Otherwise copy it into the spec's Open questions.
7. **Hand back for review.** Summarise the flagged concerns first, then the rest. The product owner checks the spec against the original idea and resolves the concerns.
8. **Commit** the spec on a branch for a pull request. Include the intent in the same commit if it changed. Do not push without the usual approval.

## Template

```markdown
# Spec: [descriptive title]
Intent: [link to the intent file]. Status: draft.

## Summary
[One paragraph: what is being built and why, from the intent.]

## Requirements
[Numbered, testable requirements. Each has acceptance criteria.]

## Design
[How it will work: structure, data, behaviour and key decisions, with the reason for each.]

## Out of scope
[What this deliberately does not cover.]

## Open questions
[Carried forward from the intent, or new.]

## Flagged concerns
[Conflicts, risks or things you could not satisfy. Write "None" if there are none.]
```

## Rules

- Stay inside what the intent asks for. Don't add features it doesn't mention.
- Requirements say what, design says how. Keep them distinct.
- If the intent is thin on something that matters, add it as an open question, not an assumption.
- Keep it as short as it can be while still being buildable.
- A spec changed after build starts counts as rework, so ask about unclear points now.
