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
  support: 'support',
  breathe: 'breathe',
  year: 'year',
  comfort: 'comfort',
}

const VIEWS = new Map<string, AppView>(
  Object.entries(PATHS).map(([view, path]) => [path, view as AppView]),
)

/**
 * A way into breathing with a butterfly (plan c.1), named for where it is
 * offered: a breathing goal's "Breathe now" on Today, the step offered under
 * Today's check-in, the support page's link, and the recap's last step.
 */
export type BreatheWay = 'goal' | 'next-step' | 'support' | 'recap'

/**
 * Where on a page a link to a page opened for a moment was pressed (a "What
 * does this do?" link to the Guide, or a way into breathing), so that leaving
 * that page puts the gardener back there, rather than at the top of a fresh
 * copy of the page with focus nowhere.
 */
export interface LinkPlace {
  /** A Guide link: the section it opened, which names the link on its page. */
  section?: string
  /** A way into breathing: which one, which names it on its page. */
  breathe?: BreatheWay
  /** How far down the page had been scrolled. */
  scrollY: number
  /** On Care, the companion whose link it was. */
  companionId?: string
  /** On Today, the breathing goal whose "Breathe now" it was. */
  goalId?: string
}

export interface Route {
  view: AppView
  /** The shop opened on its Garden Pass tab: `#/shop/pass`. */
  onPass?: boolean
  /**
   * Today opened at its check-in question: `#/today/check-in`, where the
   * installed app's "Check in" shortcut leads.
   */
  checkIn?: boolean
  /**
   * Care opened for one companion, from its card in the garden or back from
   * the Guide its bond meter's link opened. Not part of the address: a
   * reload or a link opens Care as usual.
   */
  companionId?: string
  /**
   * The Guide opened at one of its sections: `#/guide/stardust`. Any short
   * name is kept; the Guide opens at the top when it has no such section.
   */
  section?: string
  /**
   * The page a "What does this do?" link left, which the Guide offers a way
   * back to and Android's back gesture returns to; for breathing and the
   * comfort plan, the page that opened them. Not part of the address.
   */
  from?: AppView
  /** On the Guide or breathing, where on the page `from` its link was pressed. */
  fromPlace?: LinkPlace
  /**
   * Back from the Guide or breathing: the place on this page to put the
   * gardener at, as it was when they pressed the link. Not part of the
   * address.
   */
  restore?: LinkPlace
  /**
   * The year "Your garden's year" looks back on: `#/year/2025`. Without it,
   * this year (`#/year`). The page offers only years it has something for.
   */
  year?: number
  /**
   * The Journal opened on Marigold's newest letter, from the garden's card.
   * Not part of the address: a reload opens the Journal as usual, where the
   * letter is kept.
   */
  letter?: boolean
}

/** A Guide section's name in the address: lower case words and hyphens. */
const GUIDE_SECTION = /^guide\/([a-z][a-z-]{0,39})$/

/** A year looked back on, in the address: four digits. */
const YEAR = /^year\/(\d{4})$/

/**
 * The page a hash names, or undefined for one that names no page (an old
 * link, `#/arrive`, a typo). Callers fall back to the garden.
 */
export function routeFromHash(hash: string): Route | undefined {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (path === 'shop/pass') return { view: 'shop', onPass: true }
  if (path === 'today/check-in') return { view: 'today', checkIn: true }
  // The recap opens for a particular evening, chosen on Today; a reload or a
  // saved link cannot know which, so it lands on Today, where it is offered.
  if (path === 'recap') return { view: 'today' }
  const section = GUIDE_SECTION.exec(path)?.[1]
  if (section) return { view: 'guide', section }
  const year = YEAR.exec(path)?.[1]
  if (year) return { view: 'year', year: Number(year) }
  const view = VIEWS.get(path)
  return view ? { view } : undefined
}

/**
 * The way back from a page another page opened for a moment: the Guide, from
 * a "What does this do?" link, or breathing, from wherever it was offered.
 * It is the page left, for the same companion on Care, with the place to put
 * the gardener back at. Nothing for either opened any other way (a link, the
 * navigation), or for any other page.
 */
export function returnFrom(route: Route): Route | undefined {
  if (route.view !== 'guide' && route.view !== 'breathe') return undefined
  if (!route.from || route.from === route.view) return undefined
  return { view: route.from, companionId: route.fromPlace?.companionId, restore: route.fromPlace }
}

/** The hash for a page: empty for the garden, so its address stays plain. */
export function hashForRoute(route: Route): string {
  if (route.view === 'shop' && route.onPass) return '#/shop/pass'
  if (route.view === 'today' && route.checkIn) return '#/today/check-in'
  if (route.view === 'guide' && route.section) return `#/guide/${route.section}`
  if (route.view === 'year' && route.year) return `#/year/${route.year}`
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
