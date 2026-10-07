import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import App from './App'
import theme from './theme/theme'

test('renders the todo page, starting with the empty state', () => {
  render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
  )
  expect(screen.getByRole('heading', { name: 'Create your first workstream' })).toBeInTheDocument()
})
