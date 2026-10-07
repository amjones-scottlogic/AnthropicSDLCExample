import { expect, test } from 'vitest'
import { screen } from '@testing-library/react'

// main.tsx mounts into #root, so this proves the provider and baseline are wired at the entry point.
test('main.tsx applies the theme to the app', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  await import('./main')
  const heading = await screen.findByRole('heading', { name: 'Create your first workstream' })
  expect(getComputedStyle(heading).fontFamily).toContain('Figtree Variable')
  expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(244, 246, 250)')
})
