import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import App from './App'
import theme from './theme/theme'

test('renders the placeholder page', () => {
  render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
  )
  expect(screen.getByRole('heading', { name: 'Todo app' })).toBeInTheDocument()
})
