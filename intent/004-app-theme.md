# Intent: Define the app's theme
Author: Andrew Jones (originator and sole user). Status: draft.

## Problem
I've looked at five Material UI layouts for the todo app and picked the warm sidebar one as the best layout. I didn't like the colours and typography used in that prototype. Without a defined theme the app would fall back on the library's defaults, or on whatever each screen happens to use, and it would look inconsistent.

## Proposed outcome
The app has one defined theme that every screen uses, so it looks consistent and deliberate. The theme covers:
- colour palette
- typography
- shape and spacing

The specific colours, fonts and values are decided in the spec, not here. The prototype's colours and typography are not the starting point; the sidebar prototype only informs the layout, which is a separate intent.

## Affected users and systems
- Users: just me.
- Systems: the React app's UI, built with Material UI.

## Constraints
- Material UI is the UI library.
- Text and controls must still meet WCAG AA colour contrast, as in intent 001.
- Browser only, no backend, no network calls (as in intent 001).
- Adopting the sidebar layout in the real app is out of scope and will be its own intent, which depends on this one.

## Open questions
- None.
