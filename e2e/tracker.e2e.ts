import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { takeScreenshot } from './helpers/screenshot'

// Needs a real browser: the tracker must survive a page reload via localStorage.
test('workstreams and actions survive a reload, with no external requests', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const { protocol, hostname } = new URL(request.url())
    if (protocol.startsWith('http') && hostname !== 'localhost') {
      externalRequests.push(request.url())
    }
  })

  await page.goto('./')
  await page.getByRole('textbox', { name: 'Workstream name' }).fill('Work')
  await page.getByRole('button', { name: 'Create workstream' }).click()

  for (const text of ['Write report', 'Send invoice']) {
    await page.getByRole('textbox', { name: 'New action' }).fill(text)
    await page.getByRole('button', { name: 'Add action' }).click()
  }
  await page.getByRole('checkbox', { name: 'Mark done: Send invoice' }).click()

  const screenshotPath = await takeScreenshot(page, 'tracker-after-actions')
  expect(existsSync(screenshotPath)).toBe(true)

  await page.reload()

  // The app reopens on "All actions", so check the workstream, the open action and the done count.
  await expect(page.getByRole('button', { name: /^Work/ })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Mark done: Write report' })).toBeVisible()
  await expect(page.getByText('Done (1)')).toBeVisible()

  expect(externalRequests).toEqual([])
})
