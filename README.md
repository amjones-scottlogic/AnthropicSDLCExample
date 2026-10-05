# Antropic-AI-SDLC

A browser-only todo app built with React, created as a hands-on exercise to try out Anthropic's AI SDLC (software development lifecycle) teachings.

## Goals

- Build a simple todo app that runs entirely in the browser (no backend)
- Practise AI-assisted development workflows end to end: planning, implementation, testing and review

## How this repo is organised

- `intent/`: one file per idea or feature, written in the originator's own words (Plan stage). Create new ones with the `capture-intent` skill in `.claude/skills/`.
- `spec/`: requirements and design for each accepted intent (Design stage). Create them with the `write-spec` skill.
- `AI-SDLC.md`: the stages of the AI-native SDLC as run here: triggers, roles and metrics.
- `.claude/`: project-level Claude Code configuration (skills and hooks, including an approval gate on `git push`).

## Getting started

Requires Node 22 and npm.

```
npm install        # install dependencies
npm run dev        # serve locally with hot reload
npm test           # run the test suite once
npm run lint       # ESLint, including jsx-a11y accessibility rules
npm run typecheck  # TypeScript strict-mode check
npm run build      # build static files into dist/
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, test and build on every pull request and push to `main`. A push to `main` that passes then deploys to GitHub Pages.

## Deployed app

https://amjones-scottlogic.github.io/AnthropicSDLCExample/

The app stores data in localStorage, which is tied to the site's origin. Renaming or moving the repository changes the URL and strands existing data, and `npm run dev` (localhost) is a different origin from the hosted site. The Vite `base` path in `vite.config.ts` must match the repository name.

## One-off repository setup (manual)

These are settings, not code:

1. Settings, Pages: set Source to "GitHub Actions".
2. Settings, Rules: protect `main`, require the `ci` status check, and allow the repository admin to bypass (so a broken pipeline never locks the repo). Enable this after the first green CI run so `ci` can be selected.

## Status

Infrastructure in place (spec 003). No todo features yet (intent 001).
