import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// GitHub Pages serves a project site at /<repo>/, so base must match the repository name.
export default defineConfig({
  base: '/AnthropicSDLCExample/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: './src/test/setup.ts',
  },
})
