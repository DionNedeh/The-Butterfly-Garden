import { isAndroidApp } from './platform'

/**
 * Where the app is served from, and what happens when that changes.
 *
 * A browser keeps a garden per origin (scheme and host), so moving the PWA
 * to a new address leaves every garden behind at the old one. The plan for
 * that move (docs/Voyager, a.5 WP3) is a final build at the old address, made
 * with VITE_MOVED_TO set to the new one, that walks each gardener through
 * carrying their garden over as a backup file. Until that build is made,
 * VITE_MOVED_TO is unset and nothing here changes what anyone sees.
 */

/** The hash the old address links to, so the new one opens ready to restore. */
export const ARRIVAL_HASH = '#/arrive'

/**
 * The garden's new address, when this is the old address's final build.
 * Only an https URL counts. The Android app has no address to move, so it
 * never shows the move.
 */
export function movedTo(): URL | undefined {
  if (isAndroidApp()) return undefined
  const raw = import.meta.env.VITE_MOVED_TO
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

/** The new address, opened ready to take the backup the gardener just saved. */
export function arrivalUrl(target: URL): string {
  const url = new URL(target.href)
  url.hash = ARRIVAL_HASH
  return url.href
}

/** Whether this page was opened from the old address to receive a garden. */
export function isArrival(location: Pick<Location, 'hash'> = window.location): boolean {
  return location.hash === ARRIVAL_HASH
}

/**
 * Whether the app is running inside another page's frame.
 *
 * GitHub Pages cannot send a frame-ancestors header, and the same directive
 * in a meta tag is ignored, so any site can frame the app. Framed, it shows a
 * link to open it in its own tab instead of the garden. A cross-origin parent
 * makes reading `top` throw in some engines; that counts as framed too.
 */
export function isFramed(
  win: { readonly self: unknown; readonly top: unknown } = window,
): boolean {
  try {
    return win.self !== win.top
  } catch {
    return true
  }
}
