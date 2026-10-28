/**
 * Which build of the garden this is.
 *
 * The PWA on GitHub Pages and the Android app ship the same code. What differs
 * is decided when the app is built (`vite build --mode android` sets
 * `VITE_PLATFORM`), never guessed at run time: sniffing a user agent or probing
 * for a native bridge could be wrong in either direction, and a build-time
 * constant lets the bundler drop the other platform's branches entirely.
 */
export type Platform = 'web' | 'android'

export function currentPlatform(): Platform {
  return import.meta.env.VITE_PLATFORM === 'android' ? 'android' : 'web'
}

/** Whether this is the Android app rather than the browser PWA. */
export function isAndroidApp(): boolean {
  return currentPlatform() === 'android'
}
