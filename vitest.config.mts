import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '@': srcPath
    },
    server: {
      deps: {
        inline: [/@csstools/, /@asamuzakjp/]
      }
    }
  }
})
