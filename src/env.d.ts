interface ImportMetaEnv {
  /** Set to "android" by `.env.android`; absent in the PWA build. */
  readonly VITE_PLATFORM?: 'android'
}

/** package.json's version, injected by vite.config.ts. */
declare const __APP_VERSION__: string
