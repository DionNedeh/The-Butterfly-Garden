import type { AppView } from '../types'

/**
 * Where each page lives in the address bar.
 *
 * Hash routes, because GitHub Pages cannot rewrite paths: `#/journal` is the
 * same file as the garden, and the app reads which page to show from it. The
 * garden is the bare address. Keeping the page in the URL is what makes Back
 * and Forward work, a reload stay put, and a link or a home-screen shortcut
 * open a particular page.
 */
const PATHS: Record<AppView, string> = {
  garden: '',
  care: 'care',
  today: 'today',
  journal: 'journal',
  shop: 'shop',
  'flight-patterns': 'flight',
  guide: 'guide',
  settings: 'settings',
  recap: 'recap',
  'whats-new': 'whats-new',
  privacy: 'privacy',
  notices: 'notices',
}

const VIEWS = new Map<string, AppView>(
  Object.entries(PATHS).map(([view, path]) => [path, view as AppView]),
)

export interface Route {
  view: AppView
  /** The shop opened on its Garden Pass tab: `#/shop/pass`. */
  onPass?: boolean
}

/**
 * The page a hash names, or undefined for one that names no page (an old
 * link, `#/arrive`, a typo). Callers fall back to the garden.
 */
export function routeFromHash(hash: string): Route | undefined {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (path === 'shop/pass') return { view: 'shop', onPass: true }
  // The recap opens for a particular evening, chosen on Today; a reload or a
  // saved link cannot know which, so it lands on Today, where it is offered.
  if (path === 'recap') return { view: 'today' }
  const view = VIEWS.get(path)
  return view ? { view } : undefined
}

/** The hash for a page: empty for the garden, so its address stays plain. */
export function hashForRoute(route: Route): string {
  if (route.view === 'shop' && route.onPass) return '#/shop/pass'
  const path = PATHS[route.view]
  return path ? `#/${path}` : ''
}

/** The full address for a page, keeping the path and any query as they are. */
export function urlForRoute(
  route: Route,
  location: Pick<Location, 'pathname' | 'search'> = window.location,
): string {
  return `${location.pathname}${location.search}${hashForRoute(route)}`
}
