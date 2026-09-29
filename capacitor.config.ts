import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android app: the same garden as the PWA, bundled inside the APK.
 *
 * Capacitor serves dist-android/ from its own local origin
 * (https://localhost), so nothing is fetched from a network and no server
 * address appears here. Leave `server.url` unset: pointing it anywhere would
 * load the app from that host instead of from the device.
 */
const config: CapacitorConfig = {
  // Permanent once the first build is uploaded to Google Play.
  appId: 'io.github.dionnedeh.butterflygarden',
  appName: 'The Butterfly Garden',
  webDir: 'dist-android',
  // The PWA manifest's background_color: what shows before the page paints.
  backgroundColor: '#f8f2df',
  android: {
    // Plain-http subresources are never needed; keep them blocked.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // index.html asks for viewport-fit=cover, so the page draws under the
      // system bars and pads itself with env(safe-area-inset-*). Telling
      // Capacitor up front avoids a layout jump on launch.
      initialViewportFitValueHint: 'cover',
      insetsHandling: 'css',
      // Dark status-bar icons for the cream header. The app switches them to
      // light while its own night mode is on; the system's dark setting does
      // not change the header, so it must not change the icons either.
      style: 'LIGHT',
    },
  },
}

export default config
