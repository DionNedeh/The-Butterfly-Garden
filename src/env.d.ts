interface ImportMetaEnv {
  /** Set to "android" by `.env.android`; absent in the PWA build. */
  readonly VITE_PLATFORM?: 'android'
  /**
   * The garden's new https address, set only for the final build served at
   * an old one (see lib/hosting). Absent in every ordinary build.
   */
  readonly VITE_MOVED_TO?: string
}

/** package.json's version, injected by vite.config.ts. */
declare const __APP_VERSION__: string

/**
 * This build's name: a digest of what it was built from, injected by
 * vite.config.ts. Unlike the version, it changes whenever the app does.
 */
declare const __BUILD_ID__: string
