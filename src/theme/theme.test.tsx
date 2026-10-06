import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '@mui/material/Button'
import { ThemeProvider } from '@mui/material/styles'
import { contrastRatio } from './contrast'
import theme, {
  controlBorder,
  divider,
  doneChip,
  ink,
  pageBackground,
  paperBackground,
  secondaryInk,
  violet,
  workstreamColours,
} from './theme'

const AA_TEXT = 4.5
const AA_NON_TEXT = 3

type Pairing = [name: string, foreground: string, background: string, minimum: number]

const pairings: Pairing[] = [
  ['ink on page', ink, pageBackground, AA_TEXT],
  ['ink on paper', ink, paperBackground, AA_TEXT],
  ['secondary text on page', secondaryInk, pageBackground, AA_TEXT],
  ['secondary text on paper (also placeholder)', secondaryInk, paperBackground, AA_TEXT],
  ['primary on page', violet, pageBackground, AA_TEXT],
  ['primary on paper', violet, paperBackground, AA_TEXT],
  ['white on primary', '#FFFFFF', violet, AA_TEXT],
  ['error on paper', theme.palette.error.main, paperBackground, AA_TEXT],
  ['white on error', '#FFFFFF', theme.palette.error.main, AA_TEXT],
  ['control border on paper', controlBorder, paperBackground, AA_NON_TEXT],
  ['control border on page', controlBorder, pageBackground, AA_NON_TEXT],
  ['done chip text', doneChip.text, doneChip.background, AA_TEXT],
  ['yellow Add button on ink', workstreamColours.yellow, ink, AA_NON_TEXT],
  ['violet focus ring on pink', violet, workstreamColours.pink, AA_NON_TEXT],
  ['violet focus ring on lavender', violet, workstreamColours.lavender, AA_NON_TEXT],
  ...Object.entries(workstreamColours).map(
    ([name, colour]): Pairing => [`ink on ${name}`, ink, colour, AA_TEXT],
  ),
]

describe('contrast (WCAG AA)', () => {
  test.each(pairings)('%s', (_name, foreground, background, minimum) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum)
  })

  test('yellow focus ring on ink meets 3:1 where violet would not', () => {
    expect(contrastRatio(workstreamColours.yellow, ink)).toBeGreaterThanOrEqual(AA_NON_TEXT)
    expect(contrastRatio(violet, ink)).toBeLessThan(AA_NON_TEXT)
  })

  test('the decorative divider is not the control border', () => {
    expect(controlBorder).not.toBe(divider)
    expect(theme.palette.divider).toBe(divider)
  })
})

describe('theme values', () => {
  test('shape and spacing', () => {
    expect(theme.shape.borderRadius).toBe(8)
    expect(theme.spacing(1)).toBe('8px')
  })

  test('typography', () => {
    const { typography } = theme
    expect(typography.fontFamily).toBe('"Figtree Variable", "Segoe UI", system-ui, sans-serif')
    expect(typography.body1.fontSize).toBe('1rem')
    expect(typography.button.fontWeight).toBe(700)
    expect(typography.button.textTransform).toBe('none')
    expect(typography.h1.fontWeight).toBe(800)
    expect(typography.h4.fontWeight).toBe(800)
  })

  test('palette tokens', () => {
    expect(theme.palette.background.default).toBe(pageBackground)
    expect(theme.palette.text.primary).toBe(ink)
    expect(theme.palette.primary.main).toBe(violet)
  })

  test('controls have a 44px target', () => {
    const components = theme.components
    expect(components?.MuiButton?.styleOverrides?.root).toMatchObject({ minHeight: 44 })
    expect(components?.MuiIconButton?.styleOverrides?.root).toMatchObject({ minWidth: 44, minHeight: 44 })
    expect(components?.MuiCheckbox?.styleOverrides?.root).toMatchObject({ minWidth: 44, minHeight: 44 })
    expect(components?.MuiInputBase?.styleOverrides?.root).toMatchObject({ minHeight: 44 })
  })

  test('buttons are flat and surfaces have no elevation', () => {
    expect(theme.components?.MuiButton?.defaultProps?.disableElevation).toBe(true)
    expect(theme.components?.MuiPaper?.defaultProps?.elevation).toBe(0)
  })
})

describe('focus', () => {
  test('keyboard focus is marked on a themed button', async () => {
    render(
      <ThemeProvider theme={theme}>
        <Button>Add</Button>
      </ThemeProvider>,
    )
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('Mui-focusVisible')
  })

  test('focus ring is 2px violet, and yellow on ink surfaces', () => {
    const rules = theme.components?.MuiCssBaseline?.styleOverrides as Record<string, unknown>
    expect(rules[':focus-visible']).toMatchObject({ outline: `2px solid ${violet}`, outlineOffset: 2 })
    expect(rules['[data-surface="ink"] :focus-visible']).toMatchObject({
      outline: `2px solid ${workstreamColours.yellow}`,
    })
  })
})
