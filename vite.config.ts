import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves a project site at /<repo>/, so base must match the repository name.
export default defineConfig({
  base: '/AnthropicSDLCExample/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
