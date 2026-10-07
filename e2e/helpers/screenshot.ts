import type { Page } from '@playwright/test'

export const SCREENSHOT_DIR = 'test-results/screenshots'

// A working tool for looking at the app: saves a full-page PNG that is never committed.
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const path = `${SCREENSHOT_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  return path
}
