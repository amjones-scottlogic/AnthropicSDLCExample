# Spec: Personal actions and todo tracker
Intent: [intent/001-todo-app.md](../intent/001-todo-app.md). Status: approved.

## Summary
A single-user React app that runs entirely in the browser. It lets the user capture actions, check them off when done, and organise them across multiple workstreams, each with its own colour. Data lives in localStorage on the user's machine. It exists because the user has no single place to track actions across workstreams, and it also serves as the vehicle for applying the AI-native SDLC.

## Requirements

1. **Create workstreams.** The user can create a workstream with a name and a colour.
   - A workstream with a non-empty name appears in the workstream list.
   - An empty or whitespace-only name is rejected.
   - The colour is chosen from the fixed set of workstream colours defined in spec 004 (Yellow, Green, Sky, Pink). The user cannot enter a colour outside the set. Lavender is reserved for the All view and is not offered. A colour is preselected so the user can create a workstream by typing only a name.
   - Two workstreams may share a colour.
2. **Edit and delete workstreams.** The user can rename a workstream, change its colour, or delete it.
   - Renaming updates the name everywhere it is shown, and changing the colour updates it everywhere.
   - Deleting a workstream always shows a confirmation screen that names the workstream and says how many actions will be deleted. Confirming deletes the workstream and all its actions, open and done. Cancelling changes nothing.
   - After a delete, the app shows the workstream that precedes the deleted one in the list. If it was the first, the app shows the next one. If none remain, the app shows the empty state (requirement 6).
3. **Capture actions.** The user can add an action with a text description to the selected workstream.
   - The new action appears at the end of that workstream's open actions, marked as not done.
   - An empty or whitespace-only description is rejected.
   - In the All view the user chooses the workstream the action is added to.
4. **Complete actions.** The user can mark an action done and undo it.
   - A done action is visibly distinct from an open one, and the distinction does not rely on colour alone (see the done state in spec 004).
   - The state persists across reloads.
   - Done actions are not shown among the open actions. They are in their own section, below the open actions, that is collapsed by default and shows how many done actions it holds. The user can expand it to see them and collapse it again. The section is operable with the keyboard and announces whether it is expanded.
   - Undoing a done action returns it to the open list in its previous position among the open actions.
5. **Edit and delete actions.** The user can edit an action's text and delete an action.
   - An empty or whitespace-only edit is rejected and the action keeps its previous text.
   - Deleting an action removes it without a confirmation screen.
6. **Empty state.** With no workstreams, the main area shows a prominent way to create the first workstream in the middle of the area, not only in the sidebar.
   - Nothing else on the screen competes with it. The add-action form is not shown when there is no workstream to add to.
   - The control is reachable and usable with the keyboard, and the creation form is the one from requirement 1.
7. **View by workstream.** The user can see the actions for one workstream, and all actions across workstreams.
   - Each action in the All view shows its workstream's name, with its colour.
   - In the All view, open and done actions are separated in the same way as in a single workstream.
8. **Order.** Open actions are in the order they were added, and the user can change the order.
   - The user can reorder open actions within a workstream by dragging and dropping them.
   - Reordering can also be done with the keyboard alone, and announces the new position to assistive technology. Drag and drop is never the only way to do it.
   - The new order persists across reloads.
   - The All view shows actions in each workstream's order and cannot be reordered. Reordering is done in a single workstream's view.
9. **Persistence.** All workstreams (name and colour) and actions (including their order and done state) are saved to localStorage on every change and restored on load.
   - After a reload, the same data is shown, in the same order.
   - If stored data is missing or unreadable, the app starts empty rather than failing.
10. **Keyboard and accessibility.** Every feature above is usable with the keyboard alone, every control has an accessible label, and text and controls meet WCAG AA colour contrast.
11. **Privacy.** The app makes no network calls and includes no analytics or tracking.

## Design

- **Stack:** a React single-page app in TypeScript, built with Vite (spec 003) and styled with the central Material UI theme (spec 004). No router, no backend. Components use MUI controls, which render native HTML elements (buttons, checkboxes, inputs, labels) and so keep keyboard support and accessible semantics. Components take colours, type and shape from the theme and do not hard-code them.
- **Data model:** two lists, `workstreams` (`id`, `name`, `color`) and `actions` (`id`, `workstreamId`, `text`, `done`, `createdAt`). Each action belongs to exactly one workstream. IDs are generated in the browser (`crypto.randomUUID`). `color` holds the name of one of the theme's workstream colours (for example `"sky"`), not a hex code, so the palette can change in the theme without touching stored data. The order of the `actions` list is the display order: new actions are appended, and reordering moves an action within the list. The order among a workstream's actions is the order in which they appear in the list, so reordering never touches other workstreams' actions.
- **State and storage:** one top-level state object managed with a reducer. A thin storage module in `src/storage/` reads and writes it as a single JSON value under one localStorage key, with a `version` field so the format can change later. Keeping storage behind one module keeps components free of localStorage calls and makes it easy to test.
- **Layout:** the layout terms (drawer, header band, add bar, All view) are those defined in spec 004. The drawer lists the workstreams plus an "All actions" entry. The header band shows the current view's name and progress. The add bar is fixed at the bottom of the main area. The main area shows the open actions, then the collapsible done section. With no workstreams, the main area shows the empty state instead of the list and the add bar. This spec owns the behaviour of those elements, and spec 004 owns their look.
- **Done section:** an MUI `Accordion` (or an equivalent disclosure built on a native button with `aria-expanded`), collapsed by default. Its expanded state is not persisted.
- **Reordering:** drag and drop uses a library from npm that supports keyboard dragging and screen reader announcements (`@dnd-kit` is the likely choice). The plan picks the library and confirms it makes no network calls and passes the keyboard requirement. If no library meets it, the fallback is Move up and Move down buttons on each open action, which fully meet requirement 8 on their own.
- **Delete workstream:** an MUI `Dialog`, which traps focus, returns it on close and closes on Escape. Focus lands on the Cancel button first, so a stray Enter does not delete.
- **Testing:** unit tests for the reducer (including colour, reordering and the selection after a delete) and the storage module (including unreadable stored data). Component tests for requirements 1 to 9, driven through the keyboard-accessible controls: the delete confirmation, the collapsed done section, the empty state, rejection of empty names, descriptions and edits, and keyboard reordering. Drag with a pointer is checked manually, because jsdom does not support it well. Colour contrast of the theme is covered by the automated test in spec 004. Contrast of the composed screens is checked manually when the layout is built.

## Out of scope

- A backend, accounts, or sync across machines or browsers.
- Features the intent does not mention: due dates, priorities, tags, reminders, recurring actions, search.
- Colours outside the fixed set, including a custom colour picker.
- Export, import or backup of data (see flagged concerns).
- Handling a failed write to localStorage, such as when the quota is exceeded. If a write fails, the app is not required to tell the user or recover.
- Reordering workstreams, reordering done actions, and moving an action to another workstream.
- CI pipeline and hosting, which are set up by spec 003.
- The look of the app, which is defined by spec 004.

## Open questions

None. The questions raised during drafting are closed:

- **Completed actions:** kept in a collapsed section, hidden by default (requirement 4).
- **Action ordering:** order added, reorderable by the user (requirement 8).
- **Workstream deletion:** with a confirmation screen, deleting its actions too (requirement 2).
- **All view ordering:** the All view cannot be reordered. Reordering is done in a single workstream's view.
- **Colour on creation:** the first colour not already used by another workstream is preselected, or Yellow if all are used.

## Flagged concerns

- **Data loss risk.** localStorage is cleared when the user clears site data, and some browsers evict it in private mode or under storage pressure. The standards rule out sync and a backend, so there is no recovery path. The spec has no export or backup, because the intent does not ask for one. If the user will depend on this data, a manual export and import is the smallest fix and should be added to the intent first.
- **The hosted address is the data's home.** localStorage is tied to the origin. Spec 003 fixes the Pages URL as `https://amjones-scottlogic.github.io/AnthropicSDLCExample/`, so data stays put unless the repo is renamed or moved, or the user switches between the hosted app and a local copy (`npm run dev` is a different origin). Renaming the repo strands existing data.
- **Failed writes are silent by decision.** The product owner chose not to handle storage failures. If the quota is exceeded, changes will appear to work but be lost on reload.
- **Deleting a workstream is not reversible.** The confirmation screen is the only safeguard, and there is no undo or backup.
- **Pastel colour on its own fails contrast.** Spec 004 requires a workstream's colour to appear only as a filled surface with ink text, or beside the workstream's name. The workstream colour chooser must therefore show each colour's name as text and not rely on the swatch alone.
- **Drag and drop is a keyboard and accessibility risk.** It is the requirement most likely to fail requirement 10. It is covered by the keyboard path in requirement 8 and the fallback in Design.
