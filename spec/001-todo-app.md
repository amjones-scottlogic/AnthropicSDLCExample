# Spec: Personal actions and todo tracker
Intent: [intent/001-todo-app.md](../intent/001-todo-app.md). Status: draft.

## Summary
A single-user React app that runs entirely in the browser. It lets the user capture actions, check them off when done, and organise them across multiple workstreams. Data lives in localStorage on the user's machine. It exists because the user has no single place to track actions across workstreams, and it also serves as the vehicle for applying the AI-native SDLC.

## Requirements

1. **Create workstreams.** The user can create a workstream with a name.
   - A workstream with a non-empty name appears in the workstream list.
   - An empty or whitespace-only name is rejected.
2. **Rename and delete workstreams.** The user can rename or delete a workstream.
   - Renaming updates the name everywhere it is shown.
   - Deleting a workstream that has actions asks for confirmation and removes its actions too.
3. **Capture actions.** The user can add an action with a text description to a chosen workstream.
   - The new action appears in that workstream, marked as not done.
   - An empty or whitespace-only description is rejected.
4. **Complete actions.** The user can mark an action done and undo it.
   - A done action is visibly distinct from an open one, and the distinction does not rely on colour alone.
   - The state persists across reloads.
5. **Edit and delete actions.** The user can edit an action's text and delete an action.
6. **View by workstream.** The user can see the actions for one workstream, and all actions across workstreams.
   - Each action in the all-actions view shows its workstream.
7. **Persistence.** All workstreams and actions are saved to localStorage on every change and restored on load.
   - After a reload, the same data is shown.
   - If stored data is missing or unreadable, the app starts empty rather than failing.
8. **Keyboard and accessibility.** Every feature above is usable with the keyboard alone, every control has an accessible label, and text and controls meet WCAG AA colour contrast.
9. **Privacy.** The app makes no network calls and includes no analytics or tracking.

## Design

- **Stack:** React single-page app, built with Vite. No router, no backend. Vite is a common default for a browser-only React app; it can be swapped without affecting the spec.
- **Data model:** two lists, `workstreams` (`id`, `name`) and `actions` (`id`, `workstreamId`, `text`, `done`, `createdAt`). Each action belongs to exactly one workstream. IDs are generated in the browser (`crypto.randomUUID`).
- **State and storage:** one top-level state object managed with a reducer. A thin storage module reads and writes it as a single JSON value under one localStorage key, with a `version` field so the format can change later. Keeping storage behind one module keeps components free of localStorage calls and makes it easy to test.
- **UI:** a sidebar listing workstreams plus an "All" entry, and a main panel showing the selected view with an add-action form. Native HTML controls (buttons, checkboxes, form inputs, labels) are used wherever possible, because they give keyboard support and accessible semantics for free.
- **Testing:** unit tests for the reducer and the storage module, including unreadable stored data. Component tests (React Testing Library) for requirements 1 to 7, driven through the keyboard-accessible controls. Colour contrast is checked manually when the styles are chosen.

## Out of scope

- A backend, accounts, or sync across machines or browsers.
- Features the intent does not mention: due dates, priorities, tags, reminders, recurring actions, search.
- Export, import or backup of data (see flagged concerns).
- CI pipeline and hosting (see open questions).

## Open questions

- **CI and hosting:** does the app need a CI pipeline and GitHub Pages hosting, or can it stay local? Carried forward from the intent, to be decided later.
- **Completed actions:** should done actions stay visible in the list, or be hidden or archived after a while? This spec keeps them visible and leaves them in place until the user deletes them.
- **Action ordering:** is creation order enough, or does the user want to reorder actions by hand? This spec uses creation order.
- **Workstream deletion:** is deleting a workstream along with its actions acceptable, or should the user have to move or clear the actions first? This spec uses delete with confirmation.

## Flagged concerns

- **Data loss risk.** localStorage is cleared when the user clears site data, and some browsers evict it in private mode or under storage pressure. The standards rule out sync and a backend, so there is no recovery path. The spec has no export or backup, because the intent does not ask for one. If the user will depend on this data, a manual export and import is the smallest fix and should be added to the intent first.
- **Hosting changes the data's home.** localStorage is tied to the origin. If the app later moves from local use to GitHub Pages, or between local ports, the existing data will not appear at the new origin. This depends on the open question about hosting, which is worth resolving before real data builds up.
