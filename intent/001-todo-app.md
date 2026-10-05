# Intent: Personal actions and todo tracker
Author: Andrew Jones (originator and sole user). Status: draft.

## Problem
I need to track actions and todos across my different workstreams, and I don't have one place to do it. This is also a hands-on exercise in applying Anthropic's AI-native SDLC teachings, with the app as the vehicle.

## Proposed outcome
A simple app that I use myself to:
- capture actions
- check them off when done
- keep them organised across multiple workstreams

## Affected users and systems
- Users: just me.
- Systems: a React app that runs entirely in the browser, with no backend. Data is kept in the browser's localStorage.

## Constraints
- Browser only, no backend.
- Data is stored in the browser's localStorage, so it persists between sessions on the same machine. No sync across machines or browsers is needed.

## Open questions
- Do I need a CI pipeline and GitHub Pages hosting, or can the app stay local? To be decided later.
