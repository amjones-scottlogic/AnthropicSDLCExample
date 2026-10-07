import { defineConfig, devices } from '@playwright/test'

const PREVIEW_PORT = 4173
const BASE_URL = `http://localhost:${PREVIEW_PORT}/AnthropicSDLCExample/`

// E2E runs against the built app (dist/), the same files CI deploys.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: 'test-results/artifacts',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
})
