/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// GitHub Pages serves the app from /<repo>/, not the domain root.
// CI sets VITE_BASE_PATH=/Noto/; local dev and preview default to /.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __APP_MODE__: JSON.stringify(mode),
  },
  test: {
    environment: 'jsdom',
    // jsdom only exposes localStorage for a non-opaque origin.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    // Component tests run against the in-memory fake backend.
    env: { VITE_E2E: '1' },
  },
}))
