import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import ProgressRing from './ProgressRing'
import theme, { workstreamColours } from '../theme/theme'

function renderRing(size: number) {
  render(
    <ThemeProvider theme={theme}>
      <ProgressRing size={size} value={40} count={3} colour={workstreamColours.sky} />
    </ThemeProvider>,
  )
  return screen.getByTestId('progress-ring')
}

test('shows the number inside the ring', () => {
  expect(renderRing(36)).toHaveTextContent('3')
})

test('is hidden from assistive technology', () => {
  expect(renderRing(36)).toHaveAttribute('aria-hidden', 'true')
})

test.each([36, 56])('is %ipx across', (size) => {
  expect(renderRing(size)).toHaveStyle({ width: `${size}px`, height: `${size}px` })
})
