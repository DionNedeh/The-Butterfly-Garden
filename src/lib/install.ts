/**
 * Whether, and how, to suggest adding the garden to the Home Screen.
 *
 * iPhone and iPad have no install prompt of their own, and it matters more
 * there than anywhere: Safari may clear what a website keeps after seven days
 * of use without a visit, while a site on the Home Screen keeps its storage
 * (lib/storage, docs/Voyager a.4 D3). Chrome on Android offers its own
 * install, which App.tsx already answers through `beforeinstallprompt`, and
 * the Android app is installed by definition, so neither is ever advised.
 *
 * This is the one place the app reads the user agent, and only to word a
 * suggestion, or to choose how a calendar file is handed over: nothing
 * stored or allowed depends on it beyond that.
 */

/** Safari's own steps, or the same steps in another iOS browser's menu. */
export type HomeScreenAdvice = 'safari' | 'browser'

/** Where this browser remembers that the garden's guide was put away. */
const PUT_AWAY_KEY = 'butterfly-garden:home-screen-guide'

/**
 * Whether the Home Screen guide was put away in this browser.
 *
 * Kept in the browser's own storage for the site, apart from the garden and
 * its drafts: read at once, so a guide put away long ago never flashes up while
 * the garden is being read, and written on its own, so no other tab's drafts
 * can write over it. It is advice about this browser, so it does not travel
 * with a backup. Where that storage is refused (a private window), the guide
 * is simply offered again next time.
 */
export function isHomeScreenGuidePutAway(): boolean {
  try {
    return localStorage.getItem(PUT_AWAY_KEY) === 'put away'
  } catch {
    return false
  }
}

/** Remember, in this browser, that the guide was put away for good. */
export function putAwayHomeScreenGuide(): void {
  try {
    localStorage.setItem(PUT_AWAY_KEY, 'put away')
  } catch {
    // Offered again next time, which is the gentler failure.
  }
}

/**
 * Browsers on iPhone and iPad that are not Safari. They are all WebKit
 * underneath, and since iOS 16.4 each can add a site to the Home Screen from
 * its own Share menu, but their menus are their own, so the steps are worded
 * for "your browser" there. Edge and DuckDuckGo carry Safari's Version token
 * too, which is why the tokens are checked and not only its absence.
 */
const OTHER_IOS_BROWSER =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|GSA\/|DuckDuckGo|Ddg\/|FBAN|FBAV|Instagram/

function navigatorOrUndefined(): (Navigator & { standalone?: boolean }) | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator
}

/**
 * An iPhone, an iPod or an iPad. iPadOS asks for desktop sites by default and
 * so reports itself as a Mac; a Mac has no touch screen, so a "Macintosh"
 * that takes several touches is an iPad.
 */
function isAppleTouchDevice(nav: Navigator): boolean {
  const agent = nav.userAgent
  return /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && nav.maxTouchPoints > 1)
}

/**
 * Whether this is an iPhone or iPad, which opens a calendar file best from a
 * plain link to it (components/ReminderSetting). Never the Android app.
 */
export function isIPhoneOrIPad(): boolean {
  if (import.meta.env.VITE_PLATFORM === 'android') return false
  const nav = navigatorOrUndefined()
  return nav !== undefined && isAppleTouchDevice(nav)
}

/** Whether the app is running from the Home Screen or as an installed app. */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  return (
    navigatorOrUndefined()?.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  )
}

/**
 * Which Home Screen steps to show, or undefined when there is nothing to
 * suggest: not an iPhone or iPad, already installed, or the Android app.
 */
export function homeScreenAdvice(): HomeScreenAdvice | undefined {
  // Inline rather than isAndroidApp(), so the Android build folds this away.
  if (import.meta.env.VITE_PLATFORM === 'android') return undefined
  const nav = navigatorOrUndefined()
  if (!nav || !isAppleTouchDevice(nav) || isInstalledApp()) return undefined
  const agent = nav.userAgent
  return /Version\/[\d.]+.*Safari\//.test(agent) && !OTHER_IOS_BROWSER.test(agent)
    ? 'safari'
    : 'browser'
}
