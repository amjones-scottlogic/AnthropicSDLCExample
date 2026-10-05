# Intent: Basic infrastructure for building and deploying the todo app
Author: Andrew Jones, originator. Status: accepted.

## Problem
There is nothing to build on yet. The repo has no application framework set up, no test tooling, no CI, and no way to deploy. Intent 001 left hosting as an open question. Until this exists, the todo app in intent 001 cannot be implemented.

## Proposed outcome
A working base for the project: an application framework and test tooling set up, CI that builds and tests every change, and automated deployment to GitHub Pages. The todo app can then be built, checked and published.

## Affected users and systems
- Andrew Jones, the sole developer and user.
- The repository, the todo app (intent 001), GitHub Actions and GitHub Pages.

## Constraints
- Must respect the project standards: browser-only, no backend, data in localStorage, no external network calls, accessibility.
- Keep it simple.
- Pushes stay human-approved.
- This intent decides hosting for intent 001: GitHub Pages.

## Open questions
- Which technology to use for the framework, test tooling and build. The spec for this intent will choose it.
- localStorage is tied to the site's origin, so the Pages URL must be settled before real data is stored.
- What triggers a deployment, for example a merge to main.
