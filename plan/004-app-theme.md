# Plan: Define the app's theme
Spec: [spec/004-app-theme.md](../spec/004-app-theme.md). Intent: [intent/004-app-theme.md](../intent/004-app-theme.md). Status: approved.

## Approach
Add Material UI (`@mui/material`, Emotion) and the bundled Figtree font, define the whole theme in one `createTheme` call in `src/theme/theme.ts`, and apply it once in `main.tsx` with `ThemeProvider` and `CssBaseline`. Colour, type, shape and component overrides (button, drawer, text fields, 44px hit areas, focus ring) all live in that file; palette and workstream colours are also exported as constants so components never repeat hex codes. The spec's contrast guarantees become a Vitest test that computes WCAG ratios from the exported values. The only component built is a generic `ProgressRing`, because requirement 6 cannot be tested without one; no layout or todo feature is built. The placeholder `App` switches to theme typography so there is something themed to test.

## Files
Create:
- `src/theme/theme.ts`: `createTheme` with palette, typography (Figtree), `shape.borderRadius: 8`, spacing 8, elevation-0 surfaces, and `components` overrides (`MuiCssBaseline`, `MuiButton`, `MuiDrawer`, `MuiTextField`, `MuiInputBase`, `MuiCheckbox`, `MuiIconButton`, shared focus-visible outline 2px/2px offset). Named exports: `theme` (default export), `ink`, `workstreamColours` (Yellow, Green, Sky, Pink, Lavender), `doneChip`, `controlBorder`, `progressTrack`. Yellow focus ring on dark surfaces via a `MuiCssBaseline` rule for `[data-surface="ink"] :focus-visible`, the hook the layout intent will use for the add bar.
- `src/theme/theme.test.ts`: contrast test and theme-values test (see Tests).
- `src/theme/contrast.ts`: `contrastRatio(fg, bg)` using the WCAG relative-luminance formula; test-only helper, imported only by `*.test.*` files (kept as its own file so `theme.test.ts` and `ProgressRing.test.tsx` can share it).
- `src/components/ProgressRing.tsx`: generic ring (two `CircularProgress`: pale track and arc), props `size`, `value` (0 to 100), `count` (number shown in ink at the centre), `colour`; wrapper is `aria-hidden`. No domain knowledge. Used by the future drawer (36px) and header band (56px).
- `src/components/ProgressRing.test.tsx`: see Tests.
- `src/main.test.tsx`: wiring test (see Tests).
- `scripts/check-offline.mjs`: scans `dist/` HTML and CSS for external hosts (see Order of work, step 6).

Change:
- `package.json` / `package-lock.json`: add `@mui/material`, `@emotion/react`, `@emotion/styled`, `@fontsource-variable/figtree` (dependencies); add script `check:offline`.
- `src/main.tsx`: import `@fontsource-variable/figtree`; wrap `<App />` in `ThemeProvider` + `CssBaseline`.
- `src/App.tsx`: use `Typography` (`h1`, `body1`) instead of bare `h1`/`p`; same text.
- `src/App.test.tsx`: render inside `ThemeProvider` (existing assertion unchanged).
- `.github/workflows/ci.yml`: run `npm run check:offline` after `npm run build` in the `ci` job.
- `CLAUDE.md` Commands list: add `check:offline`.
- `.claude/skills/src-structure/SKILL.md`: add `theme/` to the layout (app-wide MUI theme, imported by `main.tsx` and tests only) and to "What goes where".

Not touched: `dist/`, `intent/`, `spec/`, other `.claude/**` files, `prototypes/`.

## Order of work
Each step leaves lint, typecheck, test and build green.
1. **Branch and plan.** `git switch -c build/004-app-theme`; save this plan with `Status: approved`; commit it alone.
2. **Dependencies.** `npm i @mui/material @emotion/react @emotion/styled @fontsource-variable/figtree`. Check `npm run build` still passes.
3. **Tokens and contrast (Req 2, 3, 4, 5, 8, 9).** Write `contrast.ts`, then `theme.ts` with palette, workstream colours, typography, shape, spacing; write the contrast and theme-values tests alongside. Run `npm test`.
4. **Component overrides and focus (Req 1, 5, 7).** Add the `components` block and the ink-surface focus rule; extend `theme.test.ts` with the focus and 44px assertions.
5. **ProgressRing (Req 6).** Build the component and its test.
6. **Wire it up (Req 1, 4, 8).** Update `main.tsx`, `App.tsx`, `App.test.tsx`; add `main.test.tsx`. Then add `scripts/check-offline.mjs`: fail if any `dist/**/*.html` or `dist/**/*.css` contains an `http(s)://` or protocol-relative URL in a `src`, `href` or `url()`, apart from `data:` URIs. Add the npm script and the CI step. Check it fails when a Google Fonts `<link>` is temporarily added to `index.html`.
7. **Full check.** `npm run lint && npm run typecheck && npm test && npm run build && npm run check:offline`. Look at `npm run dev` in a browser to confirm Figtree renders and violet focus shows on Tab.
8. **Push** only with human approval.

## Parallel work
None. Every step depends on `theme.ts`, and the whole change is small enough that splitting sessions would cost more than it saves.

## Tests
- **Contrast** (`theme.test.ts`, Req 2, 3, 6, 7): asserts every pairing in the spec's tables meets its ratio: ink and `text.secondary` on default and paper; primary on both and white on primary; white on error; control border on both (3:1); done chip text; ink on each of the five pastels (4.5:1); yellow on ink (3:1 for the Add button and the focus ring); violet on pink and lavender (3:1 focus ring). Colours come from the theme exports, so changing one to a failing value fails the suite. Also asserts `divider` is not used as the control border colour.
- **Theme values** (`theme.test.ts`, Req 1, 4, 5): `shape.borderRadius` 8, `spacing(1)` 8, font family begins with Figtree with the Segoe UI fallback, body1 is 1rem, button is weight 700 with `textTransform: 'none'`, headings are weight 800, `MuiCheckbox` and `MuiIconButton` give a 44px minimum size, `MuiButton` has `disableElevation`.
- **Wiring** (`main.test.tsx`, Req 1, 4): creates `#root`, imports `main.tsx`, and asserts the heading's computed font-family contains Figtree and the page background is `#F4F6FA`. Fails if the provider or `CssBaseline` is removed from `main.tsx`.
- **Focus** (`theme.test.ts`, Req 7): renders a themed `Button`, tabs to it with `userEvent`, and asserts it has `Mui-focusVisible`; asserts the theme's focus-visible rule is a 2px outline in primary and that the `[data-surface="ink"]` rule uses `#FFD23F`. jsdom cannot evaluate `:focus-visible` styles, so the rendered ring is covered by the manual check below.
- **ProgressRing** (`ProgressRing.test.tsx`, Req 6): the number is rendered inside the ring and the ring is `aria-hidden`; the size prop sets 36px and 56px.
- **Offline** (`npm run check:offline` in CI, Req 8): fails on any external URL in built HTML or CSS.
- **Existing** `App.test.tsx` still passes.

Done means: lint, typecheck, test, build and `check:offline` all pass; the manual check in step 7 is done; no requirement in the spec is without a test or a named manual check.

## Risks
- **Highest risk: jsdom cannot prove the visual guarantees** (rendered focus ring, computed fonts from CSS files). Contained by testing the theme values the styles are generated from, plus the manual browser check in step 7. Rendered, composed screens are checked again when the layout is built (the spec says so).
- **Bundle size** grows by about 150 kB gzipped (spec flagged concern). Accepted; confirm the `build` output size and note it in the PR.
- **MUI defaults that fail contrast** (placeholder text, focus ring on ink) are overridden; the tests pin the override values so they cannot silently revert.
- **Version churn:** MUI is major-versioned; install the current latest and let the lockfile pin it. If a `components` override key has changed name, fix it in the theme and record a Deviation.
- **Fontsource under the Pages `base` path:** font URLs in the built CSS are relative, so should resolve under `/AnthropicSDLCExample/`; confirmed by inspecting `dist/` and `npm run preview`.

## Alternatives rejected
- **Tailwind alongside MUI:** already rejected in the spec (two sources for colour and radius; resets overlap `CssBaseline`).
- **`ThemeProvider` inside `App`:** would let `main.test.tsx` be simpler, but the spec applies the theme in `main.tsx`; the wiring test covers it there instead.
- **Augmenting the MUI theme type for workstream colours:** more typing machinery for five constants; plain exports are simpler and match the spec ("exported from the theme module").
- **Building the drawer, header band, add bar and done chip:** layout and features, out of scope. Only the ring is built, because Req 6 needs it.
- **Contrast checked by a library:** one 15-line function is enough and avoids a dependency.

## Open questions
None. Resolved with the engineer: `src/theme/` is added to the `src-structure` skill; `ProgressRing` is in scope because it is testable; `contrast.ts` stays in `src/theme/`.

## Deviations
None.
