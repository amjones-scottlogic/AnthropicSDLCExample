import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Served from https://amjones-scottlogic.github.io/AnthropicSDLCExample/
export default defineConfig({
  base: '/AnthropicSDLCExample/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
