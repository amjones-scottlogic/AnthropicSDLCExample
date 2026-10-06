# Spec: Define the app's theme
Intent: [intent/004-app-theme.md](../intent/004-app-theme.md). Status: draft.

## Summary
One central Material UI theme that every screen in the todo app uses, covering colour palette, typography, and shape and spacing. It exists so the app looks consistent and deliberate rather than falling back on library defaults or per-screen styling. It defines the look only: it adds no todo features and does not choose the layout, which is a separate intent.

## Requirements

1. **One theme.** The app has a single theme, defined in one place and applied at the root.
   - Every Material UI component rendered by the app takes its colours, fonts, radius and spacing from the theme.
   - Changing a value in the theme file changes it everywhere, with no edits to components.
2. **Colour palette.** The theme defines the palette in Design below.
   - Every text and control colour pairing the theme produces meets WCAG AA: 4.5:1 for text, 3:1 for large text, control borders and focus indicators.
   - No meaning is carried by colour alone (consistent with spec 001, requirement 4).
3. **Typography.** The theme defines the font stack, type scale and weights in Design below.
   - All text uses the theme's typography variants, not ad hoc font settings.
   - Body text is at least 16px (1rem) at the default browser size.
4. **Shape and spacing.** The theme defines the corner radius, spacing unit and component density in Design below.
   - Interactive controls have a target at least 44px high.
5. **Focus.** Keyboard focus is always visible.
   - Every interactive control shows a focus indicator that meets 3:1 contrast against its surroundings.
6. **No external requests.** The theme makes no network calls.
   - No web fonts or CDN assets are loaded; all fonts are system fonts.
7. **Tested.** The theme's guarantees are covered by automated tests (see Testing).

## Design

- **Library and wiring:** `@mui/material` with Emotion (its peer dependencies), added as npm dependencies and bundled at build time. The theme is one `createTheme` call in `src/theme/theme.ts` (following the `src-structure` skill), applied once with `ThemeProvider` and `CssBaseline` in `main.tsx`. Components use theme tokens (`theme.palette`, `theme.spacing`, `sx`), never hard-coded values.
- **Palette (light):** a cool, neutral base with one blue primary and a teal accent. The prototype's warm cream and terracotta are deliberately not used. Ratios are measured against the surface they sit on.

  | Token | Value | Contrast |
  |---|---|---|
  | `background.default` | `#F6F7F9` | page surface |
  | `background.paper` | `#FFFFFF` | cards, dialogs, sidebar |
  | `text.primary` | `#1B1F27` | 15.4:1 on default, 16.5:1 on paper |
  | `text.secondary` | `#475066` | 7.5:1 on default, 8.1:1 on paper |
  | `primary.main` | `#2B4FC4` | 7.0:1 on paper; white text on it 7.0:1 |
  | `secondary.main` | `#0B6E69` | 6.1:1 on paper; white text on it 6.1:1 |
  | `error.main` | `#B3261E` | 6.5:1 on paper; white text on it 6.5:1 |
  | `success.main` | `#1B6E3C` | 6.3:1 on paper |
  | `divider` / control borders | `#8A93A6` | 3.1:1 on paper |
  | done-action text | `#5B6478` | 5.9:1 on paper |

  Ratios were calculated with the WCAG relative luminance formula. Colours are for light mode only (see open questions).
- **Workstream colours:** workstreams are told apart by name first. If a per-workstream accent is wanted, it comes from a fixed set of 6 hues in the theme, each at least 3:1 against paper and always shown next to the workstream name, never alone.
- **Typography:** the system UI font stack, `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`, for everything. System fonts avoid any font download, which keeps the no-network-calls standard, and avoids the serif headings the prototype used. Scale: body 1rem/1.5, small 0.875rem, h1 1.75rem, h2 1.375rem, h3 1.125rem, all weight 600 for headings and 400 for body. Buttons are not upper-cased.
- **Shape and spacing:** `shape.borderRadius` 8px; spacing unit 8px (MUI default); comfortable density, not compact. Elevation is flat: 0 for cards and surfaces (separated by the 1px divider), standard elevation only on dialogs and menus.
- **Component defaults:** set through `components` overrides in the theme: `MuiButton` (no elevation, no upper-case), `MuiTextField` (outlined, with a visible label), `MuiCheckbox` and `MuiIconButton` (44px hit area), and a shared focus-visible outline of 2px `primary.main` with 2px offset on all interactive components.
- **Done state:** a done action is shown struck through, in the done-action text colour, with a check icon. The icon and strikethrough carry the meaning, so colour is not relied on.

## Testing

- **Contrast test:** a Vitest unit test reads the palette from the theme and asserts every text/surface and control pairing in the table above meets its WCAG ratio, using a small contrast helper in the test. This turns the "checked manually" contrast step into a regression test.
- **Theme application test:** a component test renders a themed component and asserts it uses the theme's primary colour, font family and radius, so a missing provider fails the suite.
- **Focus test:** a component test tabs to a button and checks the focus indicator style is applied.
- Contrast of rendered, composed screens and real keyboard use are still checked manually when the layout is built.

## Out of scope

- The sidebar layout, or any other screen layout. That is its own intent, which depends on this one.
- Any todo feature or behaviour.
- Dark mode and a user theme switcher (see open questions).
- Web fonts, icon fonts loaded from a CDN, or any other external asset.
- Per-user theme customisation or storing a theme preference.

## Open questions

- **Dark mode:** should there be a dark variant? The intent does not ask for one, so this spec defines light mode only. A dark palette would need its own contrast checks.
- **Workstream accent colours:** are per-workstream colours wanted at all? The intent does not mention them. The spec reserves a fixed set but they can be dropped.
- **Font choice:** is a system font stack acceptable, or is a specific bundled font wanted? A bundled font (for example via an npm font package) would still make no network calls but adds to the build.
- **Palette approval:** the hues are a proposal, as the intent leaves them to the spec. The product owner should confirm the blue and teal before build.

## Flagged concerns

- **Adding Material UI affects the existing base.** Spec 003 sets up a bare React skeleton. MUI and Emotion add runtime dependencies and increase the bundle size (the MUI prototype was about 142 kB gzipped). This is within the standards but worth knowing.
- **Contrast is verified for the palette, not the finished screens.** The automated test covers token pairings. Text over other backgrounds, for example chips or disabled states, still needs checking when the layout is built.
- **Intent 004 names Material UI as a constraint but does not allow any other styling approach.** The spec therefore uses MUI's own theming only and adds no second styling library.
