import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Ensure Vitest runs non-interactively and fails immediately on missing dependencies
if (process.env.CI === undefined) {
  process.env.CI = "true"
}
process.env.VITEST_SKIP_INSTALL_CHECKS = "1"

// https://vite.dev/config/
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,jsx,tsx}"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true,
    watch: false,
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
  },
})
