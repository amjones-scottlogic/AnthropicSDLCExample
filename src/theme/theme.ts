import { createTheme } from '@mui/material/styles'

export const ink = '#1D2033'
export const secondaryInk = '#4A5068'
export const violet = '#5B2EE0'
export const controlBorder = '#7A8296'
export const progressTrack = '#E3E7F0'
export const doneChip = { text: '#14532D', background: '#DDF3E4' }
export const divider = '#D3D8E3'
export const pageBackground = '#F4F6FA'
export const paperBackground = '#FFFFFF'

// Fixed pastel fills for workstreams. Always use with ink text and the workstream's name.
export const workstreamColours = {
  yellow: '#FFD23F',
  green: '#9BE564',
  sky: '#7FD6FF',
  pink: '#FF8FAB',
  lavender: '#C9B6FF', // the All view
} as const

const fontFamily = '"Figtree Variable", "Segoe UI", system-ui, sans-serif'
const heading = { fontWeight: 800, letterSpacing: '-0.02em' }
const controlSize = 44

export const theme = createTheme({
  palette: {
    background: { default: pageBackground, paper: paperBackground },
    text: { primary: ink, secondary: secondaryInk },
    primary: { main: violet, contrastText: '#FFFFFF' },
    error: { main: '#B3261E', contrastText: '#FFFFFF' },
    divider,
  },
  typography: {
    fontFamily,
    fontWeightRegular: 400,
    fontSize: 16,
    h1: { ...heading, fontSize: '2.25rem', lineHeight: 1.2 },
    h4: { ...heading, fontSize: '1.5rem', lineHeight: 1.3 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '1rem', lineHeight: 1.5 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Shared focus ring: violet by default, yellow on the dark add bar.
        ':focus-visible': { outline: `2px solid ${violet}`, outlineOffset: 2 },
        '[data-surface="ink"] :focus-visible': {
          outline: `2px solid ${workstreamColours.yellow}`,
          outlineOffset: 2,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: controlSize } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: paperBackground, borderRight: `1px solid ${divider}` },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          minHeight: controlSize,
          '& input::placeholder, & textarea::placeholder': { color: secondaryInk, opacity: 1 },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: controlBorder },
      },
    },
    MuiCheckbox: {
      styleOverrides: { root: { minWidth: controlSize, minHeight: controlSize } },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: controlSize, minHeight: controlSize } },
    },
  },
})

export default theme
