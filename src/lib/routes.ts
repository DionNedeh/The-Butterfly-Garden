import type { AppView } from '../types'
import { isLocalDate } from './date'

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

/** The shop's tabs, in its order: each has an address, `#/shop/jars`. */
export type ShopTab = 'supplies' | 'boutique' | 'jars' | 'flight' | 'backdrops' | 'pass'

/**
 * Where on a page a link to a page opened for a moment was pressed (a "What
 * does this do?" link to the Guide, a way into breathing or into the comfort
 * plan, or the plan's own way to the support page), so that leaving that page
 * puts the gardener back there, rather than at the top of a fresh copy of the
 * page with focus nowhere.
 */
export interface LinkPlace {
  /** A Guide link: the section it opened, which names the link on its page. */
  section?: string
  /** A way into breathing: which one, which names it on its page. */
  breathe?: BreatheWay
  /** A way into the comfort plan: each page that offers one has one. */
  comfort?: boolean
  /** On the comfort plan, its way to the support page. */
  support?: boolean
  /** How far down the page had been scrolled. */
  scrollY: number
  /** On Care, the companion whose link it was. */
  companionId?: string
  /** On Today, the breathing goal whose "Breathe now" it was. */
  goalId?: string
  /** In the shop, the tab it was on. */
  shopTab?: ShopTab
  /** In the garden, the plant whose open panel the link was in. */
  plantId?: string
}

export interface Route {
  view: AppView
  /** The shop opened on its Garden Pass tab: `#/shop/pass`. */
  onPass?: boolean
  /** The shop opened on one of its other tabs: `#/shop/boutique`. */
  shopTab?: ShopTab
  /**
   * The Journal opened at one day of its timeline: `#/journal/2026-10-26`.
   * A day with nothing written opens the Journal at its top.
   */
  journalDay?: string
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
  /**
   * On the Guide, breathing or the comfort plan, where on the page `from` its
   * link was pressed.
   */
  fromPlace?: LinkPlace
  /**
   * Back from the Guide, breathing or the comfort plan, or from the support
   * page to the plan that opened it: the place on this page to put the
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
  /**
   * The evening the recap was open for, kept with its entry in the browser's
   * history so that the browser's Back from the Guide returns to it. Not part
   * of the address.
   */
  recapFor?: string
}

/**
 * Open the Guide at a section from a "What does this do?" link, with where on
 * its page the link was: on Care whose link it was, in the shop the tab, in
 * the garden the plant whose panel it was in.
 */
export type OpenGuide = (
  section: string,
  companionId?: string,
  place?: Pick<LinkPlace, 'shopTab' | 'plantId'>,
) => void

/** A Guide section's name in the address: lower case words and hyphens. */
const GUIDE_SECTION = /^guide\/([a-z][a-z-]{0,39})$/

/** A year looked back on, in the address: four digits. */
const YEAR = /^year\/(\d{4})$/

/** A day in the Journal, in the address: a real date, checked with isLocalDate. */
const JOURNAL_DAY = /^journal\/(\d{4}-\d{2}-\d{2})$/

/** One of the shop's tabs, in the address. */
const SHOP_TAB = /^shop\/(supplies|boutique|jars|flight|backdrops)$/

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
  const journalDay = JOURNAL_DAY.exec(path)?.[1]
  if (isLocalDate(journalDay)) return { view: 'journal', journalDay }
  const shopTab = SHOP_TAB.exec(path)?.[1] as ShopTab | undefined
  if (shopTab) return { view: 'shop', shopTab }
  const view = VIEWS.get(path)
  return view ? { view } : undefined
}

/**
 * The way back from a page another page opened for a moment: the Guide, from
 * a "What does this do?" link, or breathing or the comfort plan, from
 * wherever they were offered. It is the page left, for the same companion on
 * Care, with the place to put the gardener back at. Nothing for any of them
 * opened any other way (a link, the navigation), or for any other page.
 */
export function returnFrom(route: Route): Route | undefined {
  if (route.view !== 'guide' && route.view !== 'breathe' && route.view !== 'comfort') return undefined
  if (!route.from || route.from === route.view) return undefined
  const place = route.fromPlace
  return { view: route.from, companionId: place?.companionId, shopTab: place?.shopTab, restore: place }
}

/** The hash for a page: empty for the garden, so its address stays plain. */
export function hashForRoute(route: Route): string {
  if (route.view === 'shop' && (route.shopTab || route.onPass))
    return `#/shop/${route.shopTab ?? 'pass'}`
  if (route.view === 'journal' && route.journalDay) return `#/journal/${route.journalDay}`
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
