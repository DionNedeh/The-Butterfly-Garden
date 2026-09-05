import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/The-Butterfly-Garden/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'icons/icon-192.webp',
        'icons/icon-512.webp',
        'icons/apple-touch-icon.png',
        'icons/favicon-64.png',
      ],
      manifest: {
        name: 'The Butterfly Garden',
        short_name: 'Butterfly Garden',
        description: 'A private, gentle self-care garden that grows with you.',
        theme_color: '#315c4b',
        background_color: '#f8f2df',
        display: 'standalone',
        start_url: '/The-Butterfly-Garden/',
        scope: '/The-Butterfly-Garden/',
        icons: [
          {
            src: 'icons/icon-192.webp',
            sizes: '192x192',
            type: 'image/webp',
          },
          {
            src: 'icons/icon-512.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any maskable',
          },
          {
            // PNG fallback for installers that will not take a WebP icon.
            src: 'icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,webp,svg,woff2}'],
        // The woodland and conservatory backdrops stay locked for the first
        // 30 and 60 days, so shipping them in the install would make every new
        // gardener download half a megabyte they cannot use yet. They are
        // fetched and kept the first time one is actually selected.
        globIgnores: [
          '**/garden-woodland-brook-*',
          '**/garden-secret-conservatory-*',
          // Extended-latin faces are only requested when a glyph outside
          // basic latin is used, which the English interface never does. The
          // browser fetches them if a gardener types an accented character.
          '**/*-latin-ext-*.woff2',
        ],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/assets\/garden-(woodland-brook|secret-conservatory)-[^/]+$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'garden-backdrops',
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /-latin-ext-[^/]+\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'garden-fonts-extended',
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
