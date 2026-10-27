import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaManifest } from './src/pwaManifest.ts'

/** Where the PWA is served on GitHub Pages. */
const WEB_BASE = '/The-Butterfly-Garden/'

/**
 * What the app is built from: its page, its code, what it ships as it is,
 * its dependencies, and this file.
 */
const BUILD_INPUTS = ['index.html', 'src', 'public', 'package-lock.json', 'vite.config.ts']

/**
 * A name for this build, which the open tabs of an update compare to tell
 * the build they are on from the one replacing it (src/lib/appUpdate).
 *
 * The version will not do: a deploy without a bump keeps it. Nor will the
 * time of building: every push to main deploys, and a commit that touches
 * only the docs or the tests would then build different files and offer
 * every gardener an update with nothing in it. A digest of what the app is
 * built from, and of the mode and settings it is built with, changes when
 * the app does and only then. Tests are left out of it: they are never
 * part of the app.
 */
function buildId(mode: string): string {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const hash = createHash('sha256')
  const settings = Object.entries(loadEnv(mode, root, 'VITE_')).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  hash.update(JSON.stringify([mode, settings]))
  const add = (path: string) => {
    const name = relative(root, path).split(sep).join('/')
    if (statSync(path).isDirectory()) {
      if (name === 'src/test') return
      for (const entry of readdirSync(path).sort()) add(join(path, entry))
    } else if (!/\.test\.tsx?$/.test(name)) {
      hash.update(`${name}\0`).update(readFileSync(path))
    }
  }
  for (const input of BUILD_INPUTS) add(join(root, input))
  return hash.digest('hex').slice(0, 16)
}

export default defineConfig(({ mode }) => {
  // The Android app (`--mode android`) is served by Capacitor from the root of
  // its own local origin, with every file already inside the APK. It updates
  // through Google Play, so it has no service worker, no web manifest and no
  // precache -- the plugin is disabled but still answers its virtual modules.
  const android = mode === 'android'
  /** Where this build is written, once Vite has worked it out. */
  let outDir = ''
  const { version } = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
  ) as { version: string }
  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_ID__: JSON.stringify(buildId(mode)),
    },
    base: android ? '/' : WEB_BASE,
    build: {
      ...(android ? { outDir: 'dist-android' } : {}),
      rolldownOptions: {
        output: {
          // The garden's storage in a chunk of its own beside the entry: it
          // still loads with the app, but the entry stays under its cap
          // (check-budgets.mjs) however the rest of the graph is split. The
          // garden lock's sealing (repository/sealedStores) is left out of
          // it, so that only a garden with a lock ever downloads it.
          codeSplitting: {
            groups: [
              {
                name: 'repository',
                test: /[\\/]src[\\/]repository[\\/](?!sealedStores)|[\\/]node_modules[\\/]idb[\\/]/,
              },
            ],
          },
        },
      },
    },
    // Scan only the application, not local review HTML or archived checkouts.
    optimizeDeps: {
      entries: ['index.html'],
    },
    plugins: [
      react(),
      // The install-sheet screenshots belong to the web manifest, which the
      // Android app does not have; Google Play has its own. Everything in
      // public/ is copied into every build, so they are taken back out of
      // the Android one rather than shipped unused inside the app.
      android && {
        name: 'android-without-web-screenshots',
        apply: 'build',
        configResolved(config) {
          outDir = resolve(config.root, config.build.outDir)
        },
        closeBundle() {
          rmSync(resolve(outDir, 'screenshots'), { recursive: true, force: true })
          // The calendar files are linked only from the PWA on an iPhone or
          // iPad; the app hands over a file it makes (lib/calendarReminder).
          rmSync(resolve(outDir, 'reminders'), { recursive: true, force: true })
          // The launcher's maskable icon and the shortcut icons are read only
          // through the web manifest, which the app does not have.
          for (const file of [
            'icon-maskable-512.webp',
            'shortcut-check-in.png',
            'shortcut-today.png',
            'shortcut-journal.png',
          ]) {
            rmSync(resolve(outDir, 'icons', file), { force: true })
          }
        },
      },
      VitePWA({
        disable: android,
        registerType: 'prompt',
        // The app's own icons are listed here; the manifest's others (the
        // maskable and shortcut icons) are the launcher's, fetched at install.
        includeManifestIcons: false,
        includeAssets: [
          'icons/icon-192.webp',
          'icons/icon-512.webp',
          'icons/apple-touch-icon.png',
          'icons/favicon-64.png',
        ],
        manifest: pwaManifest(WEB_BASE),
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,jpg,webp,svg,woff2}'],
          // Keep full optional scenes out of the install. Thumbnails are small
          // and precached; full scenes are fetched and cached when selected.
          // The two scenes every garden starts with, Sunlit Meadow and Cottage
          // Bloom, are precached, so choosing either works offline from day one.
          globIgnores: [
            '**/garden-woodland-brook-*',
            '**/garden-secret-conservatory-*',
            '**/garden-rain-kissed-pond-*',
            '**/garden-twilight-orchard-*',
            '**/garden-cloud-garden-*',
            // Extended-latin faces are only requested when a glyph outside
            // basic latin is used, which the English interface never does. The
            // browser fetches them if a gardener types an accented character.
            '**/*-latin-ext-*.woff2',
            // Only the install sheet shows these, and only before install;
            // the launcher reads the maskable and shortcut icons once, at
            // install, from the network.
            '**/screenshots/**',
            '**/icons/icon-maskable-*',
            '**/icons/shortcut-*',
            // The calendar files for common reminder times. The glob above
            // does not match them; this says so, should it ever grow. iOS
            // opens one best straight from the server, as text/calendar, and
            // Settings links to one only while online (ReminderSetting).
            '**/reminders/**',
          ],
          navigateFallback: 'index.html',
          // A link to a calendar file is a navigation, which the fallback
          // would otherwise answer with the app itself: the link would just
          // reopen the garden. These go to the network as they are.
          navigateFallbackDenylist: [/\/reminders\/[^/]+\.ics$/],
          runtimeCaching: [
            {
              urlPattern:
                /\/assets\/garden-(woodland-brook|secret-conservatory|rain-kissed-pond|twilight-orchard|cloud-garden)-[^/]+$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'garden-backdrops',
                expiration: { maxEntries: 12 },
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
      // Pinned so date and hour tests mean the same thing on every machine.
      // Deliberately not UTC: the Moonlight window is gated on a local hour and
      // has to be tested across a daylight-saving transition, which a zone
      // without one would let pass while proving nothing.
      env: { TZ: 'America/New_York' },
      // `npm test` measures coverage and fails below these floors. They sit
      // a little under what the suite reaches, so new code arrives with its
      // tests rather than quietly lowering the share that is checked.
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
        reporter: ['text-summary'],
        thresholds: { lines: 85, statements: 84, functions: 80, branches: 78 },
      },
    },
  }
})
