# Spec: Define the app's theme
Intent: [intent/004-app-theme.md](../intent/004-app-theme.md). Status: draft.

## Summary
One central Material UI theme that every screen in the todo app uses, covering colour palette, typography, and shape and spacing. It exists so the app looks consistent and deliberate rather than falling back on library defaults or per-screen styling. The look is professional with a little personality: a cool neutral base, a violet accent, and a set of pastel workstream colours. It defines the look only: it adds no todo features and does not choose the layout, which is a separate intent.
## Requirements

1. **One theme.** The app has a single theme, defined in one place and applied at the root.
   - Every Material UI component rendered by the app takes its colours, fonts, radius and spacing from the theme.
   - Changing a value in the theme file changes it everywhere, with no edits to components.
2. **Colour palette.** The theme defines the palette in Design below.
   - Every text and control colour pairing the theme produces meets WCAG AA: 4.5:1 for text, 3:1 for large text, control borders, and focus indicators.
   - No meaning is carried by colour alone (consistent with spec 001, requirement 4).
3. **Workstream colours.** Each workstream has a pastel colour from a fixed set in the theme.
   - A workstream's colour is only ever used as a filled surface with ink text on it, or alongside the workstream's name. It is never the only way to identify a workstream.
4. **Typography.** The theme defines the font, type scale and weights in Design below.
   - All text uses the theme's typography variants, not ad hoc font settings.
   - Body text is at least 16px (1rem) at the default browser size.
   - The font is bundled with the app, so it loads without any network request.
5. **Shape and spacing.** The theme defines the corner radius, spacing unit and density in Design below.
   - Interactive controls have a target at least 44px high.
6. **Progress indicators.** Progress rings show progress as a count and in words, not only as an arc.
   - Each ring shows its number inside it, and the same figure is available as text.
7. **Focus.** Keyboard focus is always visible.
   - Every interactive control shows a focus indicator that meets 3:1 contrast against what is behind it, including on pastel surfaces and on the dark add bar.
8. **No external requests.** The theme makes no network calls.
   - No fonts, icons or other assets are loaded from a CDN or any other external host.
9. **Tested.** The theme's guarantees are covered by automated tests (see Testing).

## Design

- **Layout terms used below:** the theme is designed for the app's intended layout, which a separate intent will build. The terms mean: the *drawer* is a permanent left-hand panel listing the workstreams plus an "All actions" entry; the *header band* is the full-width strip at the top of the main area showing the current view's name and progress; the *add bar* is the form for adding an action, fixed to the bottom of the main area; the *All view* is the list of actions across every workstream. The theme supplies the colours, type and shape these elements need. It does not build them.
- **Library and wiring:** `@mui/material` with Emotion (its peer dependencies), added as npm dependencies and bundled at build time. The theme is one `createTheme` call in `src/theme/theme.ts` (following the `src-structure` skill), applied once with `ThemeProvider` and `CssBaseline` in `main.tsx`. Components use theme tokens (`theme.palette`, `theme.spacing`, `sx`), never hard-coded values. Workstream colours and the shared ink colour are exported from the theme module so components do not repeat hex codes.
- **Palette (light):** a cool neutral base with a violet primary, deep ink text, and pastel workstream colours. Warm cream and terracotta tones, and serif headings, are deliberately not used. Ratios are measured with the WCAG relative luminance formula against the surface the colour sits on.

  | Token | Value | Contrast |
  |---|---|---|
  | `background.default` | `#F4F6FA` | page surface |
  | `background.paper` | `#FFFFFF` | rows, dialogs, drawer |
  | `text.primary` (ink) | `#1D2033` | 14.9:1 on default, 16.1:1 on paper |
  | `text.secondary` | `#4A5068` | 7.4:1 on default, 8.0:1 on paper |
  | `primary.main` | `#5B2EE0` | 7.2:1 on paper, 6.7:1 on default; white text on it 7.2:1 |
  | `error.main` | `#B3261E` | 6.5:1 on paper; white text on it 6.5:1 |
  | `divider` | `#D3D8E3` | decorative only, 1.4:1 (not used as a control border) |
  | control border | `#7A8296` | 3.9:1 on paper, 3.6:1 on default |
  | placeholder text | same as `text.secondary` | 8.0:1 on paper |
  | done chip | text `#14532D` on `#DDF3E4` | 7.8:1 |

- **Workstream colours:** a fixed set of pastel fills. Text on them is always ink, never primary or secondary.

  | Name | Value | Ink text on it |
  |---|---|---|
  | Yellow | `#FFD23F` | 11.1:1 |
  | Green | `#9BE564` | 10.6:1 |
  | Sky | `#7FD6FF` | 9.9:1 |
  | Pink | `#FF8FAB` | 7.5:1 |
  | Lavender (the All view) | `#C9B6FF` | 8.9:1 |

  The pastels are 1.4:1 to 2.2:1 against white, so they never stand alone as the only visible mark: a ring or dot in a pastel colour always has the workstream's name or its count in text beside it. Primary-coloured text or icons are not placed on pink (3.4:1) or lavender (4.0:1), only ink.
- **Where colour is used:** the page header band takes the selected workstream's pastel (lavender for All); the workstream's chip in the All view is filled with it; its progress ring in the drawer uses it for the arc. The primary violet is used for primary buttons, links and the focus ring. The bottom add bar is ink, with a yellow Add button (11.1:1 on ink).
- **Typography:** Figtree, a variable font, bundled through the `@fontsource-variable/figtree` npm package and imported in `main.tsx`, with `"Segoe UI", system-ui, sans-serif` as the fallback. Bundling keeps the no-network-calls standard while allowing a friendlier face than a system stack. Headings (`h1`, `h4`) are weight 800 with slight negative letter-spacing; body is weight 400 at 1rem/1.5; buttons are weight 700 and not upper-cased. Action text in rows is weight 600. No serif face is used.
- **Shape and spacing:** `shape.borderRadius` 8px everywhere (buttons, inputs, rows, chips, panels); no pill shapes. Spacing unit 8px (MUI default). Comfortable density: rows use about 4px vertical padding around a 44px control, with 10px between rows. Surfaces are flat (elevation 0), separated by a 1px divider border; only dialogs and menus use MUI's standard elevation.
- **Progress rings:** a 36px ring in the drawer and a 56px ring in the page header, built from two MUI `CircularProgress` components (a pale `#E3E7F0` track and the arc), with the number in ink centred inside. They are hidden from assistive technology because the same figure appears as text ("N open", "N of M done").
- **Dark add bar and focus:** the add-action form sits in a bar fixed to the bottom of the main area, filled with ink. Its inputs are white, so they follow the normal rules. The default violet focus ring is only 2.2:1 on ink, so controls on the bar use a yellow (`#FFD23F`) focus ring instead, set in the theme. On pastel header bands the violet focus ring is at least 3.4:1.
- **Component defaults:** set through `components` overrides in the theme: `MuiButton` (no elevation, no upper-case), `MuiDrawer` (white paper, 1px divider border), `MuiTextField` and `MuiInputBase` (visible label, control border colour, placeholder colour), `MuiCheckbox` and `MuiIconButton` (44px hit area), and a shared focus-visible outline of 2px with 2px offset.
- **Done state:** a done action is shown struck through, in `text.secondary`, with a dashed border and a "Done" chip carrying a check icon. The strikethrough, dashed border and icon carry the meaning, so colour is not relied on.

## Testing

- **Contrast test:** a Vitest unit test reads the palette and workstream colours from the theme and asserts every pairing in the tables above meets its WCAG ratio, using a small contrast helper in the test. This turns the manual contrast check into a regression test, and fails if someone changes a colour to a failing value.
- **Theme application test:** a component test renders a themed component and asserts it uses the theme's primary colour, font family and radius, so a missing provider fails the suite.
- **Focus test:** a component test tabs to a button and checks the focus indicator style is applied, including the yellow ring on the add bar.
- **Offline test:** a test or build check confirms no font or asset URL in the built output points to an external host.
- Contrast of rendered, composed screens and real keyboard use are still checked manually when the layout is built.

## Out of scope

- The sidebar layout, or any other screen layout. That is its own intent, which depends on this one.
- Any todo feature or behaviour.
- Dark mode and a user theme switcher (see open questions).
- Fonts or any other asset loaded from outside the app.
- Per-user theme customisation, user-chosen workstream colours, or storing a theme preference.
- Greeting text, emoji or other copy, which is a content decision, not a theme one.

## Open questions

- **Dark mode:** should there be a dark variant? The intent does not ask for one, so this spec defines light mode only. A dark palette would need its own contrast checks.
- **Workstream colour assignment:** the set has five pastels (four plus lavender for All). How is a colour assigned to a new workstream (next unused in order, or chosen by the user), and what happens when there are more workstreams than colours? The intent does not say, and that is a feature decision, so it is left to the layout or workstream spec.
- **Palette approval:** the violet, the pastels and the font were chosen by the product owner from mockups, but the exact values are written here for the first time. They should confirm the final values before build, because changes after the theme is built are rework.

## Flagged concerns

- **Adding Material UI affects the existing base.** Spec 003 sets up a bare React skeleton. MUI, Emotion and a bundled font add runtime dependencies and increase the bundle size (roughly 150 kB gzipped of JavaScript in a small MUI mockup). This is within the standards but worth knowing.
- **The pastel colours fail contrast on white by themselves.** At 1.4:1 to 2.2:1, they cannot be the only marker of anything. The spec limits them to filled surfaces with ink text and always pairs a ring or dot with text, but a future screen could break this. The contrast test cannot catch a pastel used on its own, so reviewers need to watch for it.
- **MUI defaults fail contrast in two places.** The default focus ring in the primary violet is only 2.2:1 on the ink add bar, and MUI's default placeholder colour is about 3:1 on white. The spec overrides both in the theme, so these must not be left at their defaults.
- **Contrast is verified for the palette, not the finished screens.** The automated test covers token pairings. Text over other backgrounds, such as disabled states or hover tints, still needs checking when the layout is built.
- **Intent 004 names Material UI as a constraint but does not allow any other styling approach.** The spec therefore uses MUI's own theming only and adds no second styling library.
