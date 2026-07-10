/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// GitHub Pages serves the app from /<repo>/, not the domain root.
// CI sets VITE_BASE_PATH=/Noto/; local dev and preview default to /.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': new versions wait for the user's Reload — never a forced
      // (potentially looping) reload.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Noto — Notes & Todos',
        short_name: 'Noto',
        description: 'Offline-first personal notes and todos, synced across devices.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // SPA shell for offline navigation (hash routes all resolve to index.html).
        navigateFallback: 'index.html',
        // Never cache Supabase traffic: private data lives only in IndexedDB,
        // and authenticated responses must not land in Cache Storage.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      // Full service-worker behaviour only in production builds.
      devOptions: { enabled: false },
    }),
  ],
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
