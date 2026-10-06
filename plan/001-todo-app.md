# Plan: Personal actions and todo tracker
Spec: [spec/001-todo-app.md](../spec/001-todo-app.md). Intent: [intent/001-todo-app.md](../intent/001-todo-app.md). Status: approved.

## Approach
Build the app as one `todos` domain on top of a pure `tracker` model. The model holds the types and a reducer (all behaviour: validation, ordering, delete-selection, default colour) and has no React. `storage/` reads and writes one versioned JSON value. A `useTracker` hook joins the reducer to storage. UI components are MUI controls using the theme from spec 004; the existing `ProgressRing` is reused. Drag and drop uses `@dnd-kit` (core + sortable) with its keyboard sensor; a spike in step 4 proves keyboard reordering before the rest is built on it, and the fallback is Move up / Move down buttons (spec Design). Keeping behaviour in the reducer means almost every requirement is unit-tested without the DOM, and component tests only prove the wiring.

## Files
Paths follow `src-structure`. Models cannot import other models, so everything the reducer needs lives in one model, `tracker`.

Create:
- `src/models/tracker/types/tracker.ts`: `WorkstreamColour` (`'yellow' | 'green' | 'sky' | 'pink'`) and `workstreamColourNames`, `Workstream` (`id`, `name`, `color`), `Action` (`id`, `workstreamId`, `text`, `done`, `createdAt`), `TrackerState` (`workstreams`, `actions`).
- `src/models/tracker/utils/reducer.ts`: `trackerReducer` and its action types: add / edit (name, colour) / delete workstream; add / edit / toggle / delete action; `reorderAction(id, overId)`. IDs and `createdAt` come in the payload, so the reducer is pure. Empty or whitespace-only names and texts are ignored (and trimmed otherwise). Deleting a workstream removes its actions. Reordering is `arrayMove` on the full `actions` list, so other workstreams' relative order is untouched and undoing a done action returns it to its place.
- `src/models/tracker/utils/selectors.ts`: `actionsFor(state, view)` (open / done split, list order), `counts`, `selectionAfterDelete(workstreams, deletedId)` (previous workstream, else the next, else none), `defaultColour(workstreams)` (first unused colour, else yellow).
- `src/models/tracker/utils/reducer.test.ts`, `selectors.test.ts`.
- `src/storage/trackerStorage.ts`: `loadTracker()` and `saveTracker(state)`. Key `todo-tracker`, value `{ version: 1, workstreams, actions }`. Missing, unparseable, wrong-shape, unknown-version or unknown-colour data returns the empty state. The only code that touches `localStorage`. Used by the `todos` domain (through the hook).
- `src/storage/trackerStorage.test.ts`.
- `src/todos/hooks/useTracker.ts`: `useReducer` seeded from `loadTracker()`, saves on every change after the first (so unreadable stored data is not overwritten just by opening the app), and supplies `crypto.randomUUID()` / `Date.now()` to the reducer actions.
- `src/todos/page.tsx`: the page. Holds the selected view (a workstream id or `'all'`, not persisted), switches to the empty state when there are no workstreams, otherwise drawer + main area.
- `src/todos/page.test.tsx`: component tests (see Tests).
- `src/todos/components/` (each with a `.test.tsx` next to it where it has behaviour):
  - `WorkstreamDrawer.tsx`: workstream list with an "All actions" entry, `ProgressRing` and "N open" per item, Add / Rename / Delete buttons with accessible names that include the workstream's name.
  - `WorkstreamForm.tsx`: name field plus `ColourPicker`; used for create and edit, rejects an empty name with an error message. Shown as a dialog from the drawer and inline in the empty state.
  - `ColourPicker.tsx`: radio group of the four colours, each swatch labelled with the colour's name as text (spec concern: a pastel never stands alone). Colour hex values come from `workstreamColours` in `src/theme/theme.ts`.
  - `DeleteWorkstreamDialog.tsx`: MUI `Dialog` naming the workstream and the number of actions; Cancel is focused first.
  - `EmptyState.tsx`: prominent centred "Create your first workstream" with the form.
  - `HeaderBand.tsx`: view name, large `ProgressRing`, "N of M done" text; background is the workstream pastel (lavender for All) with ink text.
  - `ActionList.tsx`: open actions in list order inside a `@dnd-kit` `SortableContext`; sortable only in a single workstream view, plain in the All view.
  - `ActionRow.tsx`: checkbox (done / undo), text, workstream chip in the All view, Edit and Delete buttons, drag handle. Inline edit: Enter saves, Escape cancels, an empty edit shows an error and keeps the old text.
  - `DoneSection.tsx`: collapsed-by-default disclosure ("Done (N)", `aria-expanded`), contents unmounted while collapsed; done rows use the spec 004 done state (strikethrough, dashed border, "Done" chip with check icon).
  - `AddActionBar.tsx`: ink bar fixed at the bottom (`data-surface="ink"` so the yellow focus ring applies, yellow Add button), text field with a visible label, and a workstream select in the All view only; rejects empty text.

Change:
- `package.json` / `package-lock.json`: add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@mui/icons-material` (check, drag handle, edit, delete icons; imported per icon, bundled, no network).
- `src/App.tsx`: render `TodosPage` (app shell). `src/App.test.tsx`: assert the empty state instead of "Coming soon".
- `src/main.test.tsx`: the heading it finds changes with the placeholder; keep the theme assertions.
- `README.md`: only if it still says "placeholder"; otherwise untouched.

Not touched: `src/theme/**` (existing exports are enough), `dist/`, `intent/`, `spec/`, `.claude/**`, `prototypes/`, CI.

## Order of work
Each step leaves lint, typecheck, test and build green.
1. **Branch and plan.** `git switch -c build/001-todo-app`; save this plan as `plan/001-todo-app.md` with `Status: approved`; commit alone.
2. **Model (Req 1 to 5, 8, 9).** Types, reducer, selectors and their tests. No UI.
3. **Storage and hook (Req 9).** `trackerStorage.ts` with tests, then `useTracker.ts`. Add the npm dependencies. Create `page.tsx` and one-line stub files for every component in `todos/components/` (exported, rendering nothing) so the page compiles; wire `App.tsx`. Shared files are finished here, before any parallel work.
4. **Reorder spike (Req 8, 10).** In `ActionList.tsx` and `ActionRow.tsx`, prove with a test that keyboard dragging (Space, arrows, Space) reorders and dispatches `reorderAction` under jsdom. If it cannot be made reliable, switch to Move up / Move down buttons, test those, and record a Deviation.
5. **Workstream UI (Req 1, 2, 6, 7).** Drawer, form, colour picker, delete dialog, empty state; selection after delete.
6. **Action UI (Req 3, 4, 5, 7, 8).** Header band, action list and rows, done section, add bar, All view.
7. **Full check.** `npm run lint && npm run typecheck && npm test && npm run build && npm run check:offline`, then the manual checks below.
8. **Push** only with human approval.

## Parallel work
Steps 5 and 6 can run at the same time, in separate worktrees and branches, after step 4 merges:
- **Task A (step 5)** owns `src/todos/components/{WorkstreamDrawer,WorkstreamForm,ColourPicker,DeleteWorkstreamDialog,EmptyState}.tsx` and their tests.
- **Task B (step 6)** owns `src/todos/components/{HeaderBand,ActionList,ActionRow,DoneSection,AddActionBar}.tsx` and their tests.

No file appears in both. `page.tsx`, `useTracker.ts`, the model, storage and `package.json` are finished in steps 2 to 3 and are read-only to A and B; the component props they plug into are fixed by the stubs in step 3. `page.test.tsx` is written after A and B merge, in step 7. Steps 2 to 4 are sequential because everything depends on the model and the reorder decision. The change is small, so a single session is also reasonable.

## Tests
Vitest and Testing Library, next to the code. Component tests drive the UI through roles and labels with `userEvent`.
- **Req 1 Create workstreams** (`reducer.test.ts`, `selectors.test.ts`, `WorkstreamForm.test.tsx`): non-empty name adds it; empty and whitespace names are rejected with a message; the colour defaults to the first unused (yellow when all are used); the picker offers exactly the four colours, each with its name as text; lavender is absent; two workstreams may share a colour. Also a test that `workstreamColourNames` are all keys of `workstreamColours`.
- **Req 2 Edit and delete workstreams** (`reducer.test.ts`, `DeleteWorkstreamDialog.test.tsx`, `page.test.tsx`): rename and recolour update the drawer and header; the dialog names the workstream and the action count, Cancel changes nothing and has initial focus, Confirm removes the workstream and all its actions; selection after delete is the previous, else next, else the empty state.
- **Req 3 Capture** (`reducer.test.ts`, `AddActionBar.test.tsx`): added at the end of the workstream's open list, not done; empty text rejected; the All view shows a workstream select and adds to the chosen one.
- **Req 4 Complete** (`reducer.test.ts`, `DoneSection.test.tsx`): toggling moves an action to the done section and undo restores its old position; the section is collapsed with its count by default, `aria-expanded` toggles with the keyboard, and done rows show the Done chip and strikethrough.
- **Req 5 Edit and delete actions** (`reducer.test.ts`, `ActionRow.test.tsx`): edit saves on Enter and cancels on Escape; an empty edit is rejected and the old text kept; delete removes without a confirmation.
- **Req 6 Empty state** (`EmptyState.test.tsx`, `page.test.tsx`): with no data the create control is shown in the main area, the add bar is absent, and creating a workstream replaces it with the normal view.
- **Req 7 Views** (`selectors.test.ts`, `page.test.tsx`): single view shows only that workstream; All shows every action with its workstream name; open and done are separated in both.
- **Req 8 Order** (`reducer.test.ts`, `ActionList.test.tsx`): added order by default; `reorderAction` changes only the intended relative order and leaves other workstreams alone; keyboard reordering works and is announced; the All view has no drag handles. Pointer dragging is manual (jsdom).
- **Req 9 Persistence** (`trackerStorage.test.ts`, `page.test.tsx`): round trip keeps names, colours, order and done state; missing, invalid JSON, wrong shape, unknown version and unknown colour all load as empty; mounting does not write over unreadable data; a remount after changes shows the same data in the same order.
- **Req 10 Keyboard and a11y**: every component test above uses keyboard-only input and role / label queries; `npm run lint` (jsx-a11y) passes.
- **Req 11 Privacy**: `npm run check:offline` in CI after the build; manual check of the Network tab (below).

Done means: lint, typecheck, test, build and `check:offline` pass, every requirement has a test or a named manual check, and the manual checks are done.

Manual checks (step 7), in `npm run dev` and `npm run preview`: tab through every feature with the keyboard alone; drag with the mouse; focus ring visible on every control, including the yellow one on the ink bar; contrast of composed screens (pastel header band, chips, done rows, disabled states) against AA; Network tab shows no external requests; the built app works under the `/AnthropicSDLCExample/` base path; reload keeps data.

## Risks
- **Highest risk: accessible drag and drop.** Keyboard dragging in `@dnd-kit` may not be testable in jsdom or may not announce well. Contained by the step 4 spike, before any other UI depends on it, and by the Move up / Move down fallback allowed by the spec.
- **Silent data loss on a new or newer `version`.** Unknown-version data loads as empty, and the next change overwrites it. Accepted by the spec ("unreadable data starts empty") and softened by not saving until the first change.
- **Storage write failures are deliberately unhandled** (spec decision).
- **Composed-screen contrast** (pastel under ink text, chips on pastel, hover tints) is not covered by the theme's automated test; manual check in step 7, as spec 004 says.
- **Bundle size:** `@dnd-kit` and `@mui/icons-material` (per-icon imports) add weight; check the `build` output size and note it in the PR.
- **MUI version churn:** `Accordion` transition props and `Dialog` slot names differ between majors; check against the installed version and record a Deviation if the shape changes.
- **Pages base path:** assets resolve under `/AnthropicSDLCExample/`; confirmed with `npm run preview`.

## Alternatives rejected
- **Separate `workstream` and `action` models:** models may not import each other, and the reducer needs both, so one `tracker` model.
- **Reducer inside `todos/hooks/`:** `storage/` must import the state type from a model and the reducer is pure logic over it, so it belongs with the model, where it can be tested without React.
- **Move up / Move down buttons only:** fully accessible and simpler, but the spec asks for drag and drop; kept as the fallback.
- **HTML5 native drag and drop or a hand-rolled version:** no keyboard support, so it would fail Req 10.
- **`@dnd-kit/react` (the newer package):** less established; the stable `core` + `sortable` packages cover the need.
- **Persisting the selected view or the done section's expanded state:** not asked for.
- **A per-action `order` field:** list order already is the display order (spec Design), so no migration or renumbering.
- **Saving on every state change including the first:** would overwrite unreadable data on load.
- **React Context or a state library:** one reducer in one page needs neither.

## Open questions
None.

## Deviations
- 2026-10-06: built in one sequential session, so the step 3 stub files were not needed and steps 5 and 6 were not run in parallel.
- 2026-10-06: component behaviour is tested in `src/todos/page.test.tsx` (workstream form, colour picker, delete dialog, empty state, rows, done section, add bar, views, persistence) instead of one test file per component. Only `ActionList.test.tsx` is separate, because it needs the drag-and-drop layout stub. Every test the Tests section names is still covered.
- 2026-10-06: the reorder spike passed. Keyboard dragging with `@dnd-kit` works in jsdom once `getBoundingClientRect` is stubbed in the test, so the Move up / Move down fallback was not needed.
- 2026-10-06: `WorkstreamDrawer` owns the create, edit and delete dialogs (the page only handles selection after a delete). The drag handle is passed into `ActionRow` by `ActionList`'s sortable wrapper.
- 2026-10-06: `autoFocus` is banned by jsx-a11y, so the first field in a form and the Cancel button in the delete dialog are focused with a ref and an effect instead.
- 2026-10-06: the All-view workstream picker in the add bar is a native `<select>` with a visible `<label>`, not an MUI menu, for keyboard and label support.
- 2026-10-06: the done section is not shown when there are no done actions.
- 2026-10-06: `App.test.tsx` and `main.test.tsx` now look for the empty state heading ("Create your first workstream"), because the placeholder page is gone.
