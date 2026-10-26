import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
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
  ],
})
