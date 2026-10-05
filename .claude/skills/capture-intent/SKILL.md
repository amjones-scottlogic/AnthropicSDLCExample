---
name: capture-intent
description: Capture a new idea, feature or problem as an intent file in intent/. Use when the user wants to start something new, describes a problem or idea they want built, or asks to write or draft an intent.md. Interviews the originator, then writes the result using the team's intent template.
---

# Capture intent

Turn an idea into a committed `intent/NNN-short-title.md`: a proto-spec in the originator's own terms. It is the first artifact of the AI-native SDLC (Plan stage) and is picked up later by the spec stage.

## Process

1. **Let the originator describe the problem in their own words.** Don't ask for formal language. Scope, affected users, desired improvements and constraints can all come out of free-form description.
2. **Brainstorm until it is concrete.** Ask clarifying questions about scope, users, constraints and success criteria. Ask a few at a time, not a long questionnaire. Stop when the Problem and Proposed outcome sections could be written without guessing.
3. **Write the intent using the template below.** Use the originator's words and framing. Don't add requirements, solutions or technology choices they didn't give you. Anything unresolved goes under Open questions, not into a guess.
4. **Originator review.** Show the draft and let the originator correct anything you misunderstood. Revise until they confirm it.
5. **Save and commit.** Save to `intent/` using the next free number (`001`, `002`, ...) and a short kebab-case title. Commit it so the history records author and timestamp. Leave `Status: draft` until the originator says the intent is accepted, then change it to `accepted`. Do not push without the usual approval.

## Template

```markdown
# Intent: [descriptive title]
Author: [name and role]. Status: draft.

## Problem
[Current situation and pain points, in the originator's words.]

## Proposed outcome
[The desired future state.]

## Affected users and systems
[Who is affected and which technical components are involved.]

## Constraints
[Limitations and requirements.]

## Open questions
[Unresolved items that need clarification before a spec is written.]
```

## Rules

- Describe the what and why. The how belongs in `spec.md` later.
- Keep it short. One page is plenty.
- If the originator is unsure about something, record it as an open question.
- Never edit an accepted intent in place without telling the originator. Changes after the spec exists are worth tracking.
