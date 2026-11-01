/** Where the PWA has been served on GitHub Pages since its first release. */
export const WEB_BASE = '/The-Butterfly-Garden/'

/**
 * The path a build is served from, which vite.config.ts hands to Vite and
 * to the web manifest (pwaManifest.ts: its id, start_url and scope).
 *
 * The web build takes VITE_BASE when it is set, so the old address's final
 * build and a build for a host of the garden's own, served at '/', come from
 * one config (docs/moving-the-garden.md). Unset or blank, it is WEB_BASE, so
 * no build changes until someone asks it to. A path that is not a whole
 * directory from the root (a leading and a trailing slash, nothing else
 * before the first) is refused, rather than built into an app whose files
 * and manifest point somewhere it is not served.
 *
 * The Android app is served by Capacitor from the root of its own local
 * origin, whatever VITE_BASE says.
 *
 * Kept apart from vite.config.ts so a test can pin it.
 */
export function buildBase(env: Readonly<Record<string, string | undefined>>, android: boolean): string {
  if (android) return '/'
  const chosen = env.VITE_BASE?.trim()
  if (!chosen) return WEB_BASE
  if (!/^\/(?:[^/]+\/)*$/.test(chosen))
    throw new Error(`VITE_BASE must be a path from the root that ends with "/", such as "/" or "/garden/": ${chosen}`)
  return chosen
}
