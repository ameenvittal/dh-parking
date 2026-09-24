import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts: vitest 3 ships Vite 7 types, the app builds with Vite 8.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
