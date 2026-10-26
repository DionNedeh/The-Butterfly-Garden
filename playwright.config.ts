import { defineConfig, devices, type Project } from '@playwright/test'

/**
 * Safari (desktop and iPhone) and Firefox, for the PWA only: the Android app
 * is always a Chromium WebView. Opt-in with E2E_ALL_BROWSERS=1, because these
 * engines are installed only in CI (see the `browsers` job in
 * deploy-pages.yml); a contributor's machine usually has Chromium alone.
 */
const otherBrowsers: Project[] = process.env.E2E_ALL_BROWSERS
  ? [
      {
        name: 'desktop-webkit',
        testIgnore: /android\.spec\.ts/,
        use: { ...devices['Desktop Safari'] },
      },
      {
        name: 'mobile-webkit',
        testIgnore: /android\.spec\.ts/,
        use: { ...devices['iPhone 15'] },
      },
      {
        name: 'desktop-firefox',
        testIgnore: /android\.spec\.ts/,
        use: { ...devices['Desktop Firefox'] },
      },
    ]
  : []

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // In CI: failures annotated on the run, every test listed with what it
  // printed (the moderate accessibility warnings among it), and an HTML
  // report with traces for the artifact the workflow uploads on failure.
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1',
      url: 'http://127.0.0.1:4173/The-Butterfly-Garden/',
      reuseExistingServer: true,
    },
    {
      // The Android app's bundle, served from the root as Capacitor serves it.
      // No `tsc -b` here: the server above already type-checks, and two builds
      // writing the same tsbuildinfo at once would race.
      command:
        'npx vite build --mode android && npx vite preview --mode android --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174/',
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /android\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testIgnore: /android\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      // The Android build in a phone-sized Chromium. Capacitor falls back to
      // its web implementations here, so everything but the native plugins
      // themselves runs exactly as it will on a device.
      name: 'android-webview',
      testMatch: /android\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:4174' },
    },
    ...otherBrowsers,
  ],
})
