import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [
      'tests/browser/**',
      'tests/package-consumer/**',
      '**/node_modules/**',
      '**/dist/**',
    ],
  },
})
