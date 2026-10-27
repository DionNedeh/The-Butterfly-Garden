import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './theme-aurora.css'
import './garden-3.css'
import './android.css'
import { currentRelease, hasUnseenRelease, releaseName } from './data/currentRelease'
import { GardenView } from './components/GardenView'
import { Icon } from './components/Icons'
import { BottomNav, PrimaryNav } from './components/Navigation'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RecoveryScreen } from './components/RecoveryScreen'
import { ViewProblem } from './components/ViewProblem'
import { SplashScreen } from './components/SplashScreen'

/**
 * The garden and Today are what the app opens on; everything else is fetched
 * when the gardener first walks into it, so the initial download does not
 * carry the shop catalogue, the guide, and every journal view at once.
 */
const WhatsNewView = lazy(() =>
  import('./components/WhatsNewView').then((m) => ({
    default: m.WhatsNewView,
  })),
)
const CareView = lazy(() =>
  import('./components/CareView').then((m) => ({ default: m.CareView })),
)
const FlightPatternsView = lazy(() =>
  import('./components/FlightPatternsView').then((m) => ({
    default: m.FlightPatternsView,
  })),
)
const GuideView = lazy(() =>
  import('./components/GuideView').then((m) => ({ default: m.GuideView })),
)
const JournalView = lazy(() =>
  import('./components/JournalView').then((m) => ({ default: m.JournalView })),
)
const MoonlightRecap = lazy(() =>
  import('./components/MoonlightRecap').then((m) => ({
    default: m.MoonlightRecap,
  })),
)
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({
    default: m.SettingsView,
  })),
)
const ShopView = lazy(() =>
  import('./components/ShopView').then((m) => ({ default: m.ShopView })),
)
const PrivacyPolicyView = lazy(() =>
  import('./components/PrivacyPolicyView').then((m) => ({
    default: m.PrivacyPolicyView,
  })),
)
// Today and onboarding load with the rest of the pages rather than with the
// garden: a returning gardener lands on the garden and may never need them.
const TodayView = lazy(() =>
  import('./components/TodayView').then((m) => ({ default: m.TodayView })),
)
const Onboarding = lazy(() =>
  import('./components/Onboarding').then((m) => ({ default: m.Onboarding })),
)
const NoticesView = lazy(() =>
  import('./components/NoticesView').then((m) => ({ default: m.NoticesView })),
)
const SupportView = lazy(() =>
  import('./components/SupportView').then((m) => ({ default: m.SupportView })),
)
const BreathingView = lazy(() =>
  import('./components/BreathingView').then((m) => ({ default: m.BreathingView })),
)
// Only ever shown on the address the garden moved from, never in the app.
const MovedBanner = lazy(() =>
  import('./components/MovedBanner').then((m) => ({ default: m.MovedBanner })),
)
// The offer of a new version, and the hourly look for one, arrive once the
// garden is on screen. A chunk that cannot be fetched shows nothing, rather
// than taking the garden down with it.
const UpdatePrompt = lazy(() =>
  import('./components/UpdatePrompt').then(
    (m) => ({ default: m.UpdatePrompt }),
    () => ({ default: () => null }),
  ),
)

/** What the support page's own back button says, for the page that opened it. */
const SUPPORT_BACK_LABELS: Partial<Record<AppView, string>> = {
  settings: 'Back to Settings',
  today: 'Back to Today',
  guide: 'Back to the Guide',
}
import { ambientTrackName } from './data/ambientTracks'
import { useAmbientSound } from './hooks/useAmbientSound'
import { useEffectiveTheme } from './hooks/useEffectiveTheme'
import { useFadeOut, type FadeOutMinutes } from './hooks/useFadeOut'
import { useGardenState, type StarterGoal } from './hooks/useGardenState'
import { useLocalDate } from './hooks/useLocalDate'
import { useWhatsNewOnce } from './hooks/useWhatsNewOnce'
import { followUpdates } from './lib/appUpdate'
import { useRecapWindow } from './hooks/useRecapWindow'
import { usePassStatus } from './hooks/usePassStatus'
import { setPassStatus, trackPassStatus } from './lib/passEntitlement'
import { dismissPassLapseNotice } from './lib/playBilling'
import {
  backAction,
  putBackAt,
  requestDialogClose,
  requestDismiss,
} from './lib/backNavigation'
import {
  leaveApp,
  onAppActiveChange,
  onBackButton,
  setSystemBarsForTheme,
} from './lib/native'
import type { NavItem } from './lib/navigation'
import { isAndroidApp } from './lib/platform'
import {
  DAILY_SUNLIGHT_CAP,
  moonlightForDate,
  sunlightForDate,
} from './lib/progression'
import { addDaysToLocalDate, localDateToNoon, recapHoursOf } from './lib/date'
import { isBackupDue } from './lib/backupReminder'
import type { AppView } from './types'
import { motionClass, motionPreference } from './lib/motion'
import { applyTextSize } from './lib/textSize'
import { nextMorning, paintBrowserBars } from './lib/theme'
import { useDraft } from './lib/drafts'
import { heardTrack, soundVolumeOf } from './lib/sound'
import { isArrival, movedTo } from './lib/hosting'
import {
  returnFromGuide,
  routeFromHash,
  urlForRoute,
  type LinkPlace,
  type Route,
} from './lib/routes'
import { Celebrations } from './components/Celebrations'

function currentUrl(): string {
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}

/**
 * Puts the gardener back where they pressed a "What does this do?" link, once
 * the page they return to is drawn. Rendered after the page, inside the same
 * Suspense, so it runs after the page's own first focus (Care's chip) and
 * never before the page is there.
 */
function PutBack({ place }: { place: LinkPlace }) {
  useEffect(() => putBackAt(place), [place])
  return null
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Just long enough for the opening animation to read, rather than a fixed
 * pause the gardener waits through on every launch — the garden itself
 * usually loads from IndexedDB in a few dozen milliseconds.
 */
const SPLASH_MINIMUM_MS = 700

/**
 * How long the sound takes to fade when the recap ends by fading the garden
 * to night and no fade-out was chosen in Settings: the shortest one offered,
 * since the gardener has just said they are putting the phone down.
 */
const FADE_TO_NIGHT_MINUTES: FadeOutMinutes = 15

/** The draft that holds night until the morning after the recap's ending. */
const NIGHT_UNTIL_DRAFT = 'night-until'

/**
 * Every page in the navigation, in the header's order. On a phone the dock
 * holds the first four and More, and More's sheet holds the pages marked
 * `inMore`. A page's `badge` (lib/navigation) shows on its button and on More.
 */
const navigation: readonly NavItem[] = [
  { id: 'garden', label: 'Garden', icon: 'garden' },
  { id: 'care', label: 'Care', icon: 'care' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'shop', label: 'Shop', icon: 'shop', inMore: true },
  { id: 'flight-patterns', label: 'Flight', icon: 'flight', inMore: true },
  { id: 'guide', label: 'Guide', icon: 'flower', inMore: true },
  { id: 'settings', label: 'Settings', icon: 'settings', inMore: true },
]

function App() {
  const garden = useGardenState()
  const today = useLocalDate()
  const recap = useRecapWindow(recapHoursOf(garden.state?.profile))
  // One quiet mark on Settings while a fresh copy of the garden is due, the
  // same reminder Settings words in full (lib/backupReminder), asked at the
  // same moment: noon of the day. By the day is close enough for a
  // thirty-day rule, keeps the clock out of render, and lets a copy made any
  // time today be believed.
  const reminderAt = useMemo(() => localDateToNoon(today), [today])
  // Only what the rule reads, so the count is not redone on every change.
  const journalProfile = garden.state?.profile
  const journalMoods = garden.state?.moods
  const journalReflections = garden.state?.reflections
  const journalRecaps = garden.state?.recaps
  const backupDue = useMemo(
    () =>
      journalMoods && journalReflections && journalRecaps && !garden.persistence.readOnly
        ? isBackupDue(
            {
              profile: journalProfile,
              moods: journalMoods,
              reflections: journalReflections,
              recaps: journalRecaps,
            },
            reminderAt,
          )
        : false,
    [
      journalProfile,
      journalMoods,
      journalReflections,
      journalRecaps,
      garden.persistence.readOnly,
      reminderAt,
    ],
  )
  const navItems = useMemo(
    () =>
      backupDue
        ? navigation.map((item) =>
            item.id === 'settings' ? { ...item, badge: 'time for a fresh copy' } : item,
          )
        : navigation,
    [backupDue],
  )
  // The page lives in the address (lib/routes), so Back and Forward work, a
  // reload stays put, and a link or shortcut can open a page directly.
  const [route, setRoute] = useState<Route>(
    () => routeFromHash(window.location.hash) ?? { view: 'garden' },
  )
  const view = route.view
  /** Set only when something asks for the shop's Garden Pass tab. */
  const shopOpensOnPass = route.view === 'shop' && route.onPass === true
  const navigate = (next: Route, options: { replace?: boolean } = {}) => {
    // A page opens at its top, except one being returned to, which PutBack
    // scrolls back to where it was.
    if (!next.restore) window.scrollTo({ top: 0, behavior: 'instant' })
    const url = urlForRoute(next)
    if (url !== currentUrl()) {
      if (options.replace) window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
    }
    setRoute(next)
  }
  const setView = (next: AppView, options: { onPass?: boolean } = {}) =>
    navigate({ view: next, onPass: options.onPass })
  /** The page "If you need support now" was opened from, to return to. */
  const [supportFrom, setSupportFrom] = useState<AppView>('garden')
  const openSupport = () => {
    setSupportFrom(route.view)
    setView('support')
  }
  useEffect(() => {
    const follow = () => {
      window.scrollTo({ top: 0, behavior: 'instant' })
      setRoute(routeFromHash(window.location.hash) ?? { view: 'garden' })
    }
    window.addEventListener('popstate', follow)
    return () => window.removeEventListener('popstate', follow)
  }, [])
  // With a garden open, the address always names the page on screen: an
  // unknown or spent hash (an old link, a recap from last night, the move's
  // #/arrive) is quietly replaced. Not before: onboarding still needs #/arrive.
  const hasGarden = Boolean(garden.state?.profile)
  useEffect(() => {
    if (!hasGarden) return
    const wanted = urlForRoute(route)
    if (wanted !== currentUrl()) window.history.replaceState(null, '', wanted)
  }, [route, hasGarden])
  /** Read once: whether this visit arrived from the old address (lib/hosting). */
  const [arriving] = useState(isArrival)
  const finishOnboarding = (
    name: string,
    gardenName: string,
    starterGoals?: readonly StarterGoal[],
  ) => {
    navigate({ view: 'garden' }, { replace: true })
    garden.onboard(name, gardenName, starterGoals)
  }
  const [seedFocus, setSeedFocus] = useState<string>()
  /** The day the recap was actually opened for, so it is never re-entered. */
  const [recapOpenedFor, setRecapOpenedFor] = useState<string>()
  // Always true in the PWA. In the Android app, false while the app is in the
  // background, so the soundscape does not keep playing from a pocket.
  const [appActive, setAppActive] = useState(true)
  const { setAmbientSound } = garden
  const fadeOut = useFadeOut(useCallback(() => setAmbientSound(false), [setAmbientSound]))
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSplashDone(true),
      SPLASH_MINIMUM_MS,
    )
    return () => window.clearTimeout(timer)
  }, [])

  // Ambient motion costs nothing to keep running while nobody is looking, but
  // it is not free on every device, so it stops when the tab is hidden.
  useEffect(() => {
    const syncVisibility = () => {
      document.documentElement.classList.toggle(
        'page-hidden',
        document.visibilityState === 'hidden' || !appActive,
      )
    }
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      document.documentElement.classList.remove('page-hidden')
    }
  }, [appActive])

  useEffect(() => onAppActiveChange(setAppActive), [])

  // Android's back gesture walks back through the app the way a gardener
  // would expect: the open dialog first, then the recap to Today, then any
  // page to the garden, and only then out of the app. The handler is
  // registered once and reads the current page from a ref, with the page a
  // "What does this do?" link left, which back returns the Guide to.
  const routeRef = useRef(route)
  useEffect(() => {
    routeRef.current = route
  }, [route])
  useEffect(
    () =>
      onBackButton(() => {
        const current = routeRef.current
        const action = backAction(current.view, document, current.from)
        if (action.kind === 'close-dialog') requestDialogClose(action.dialog)
        else if (action.kind === 'dismiss') requestDismiss(action.element)
        else if (action.kind === 'view') {
          // Out of the Guide, back does what its Back button does: the same
          // companion on Care, and the gardener where they were on the page.
          const back = returnFromGuide(current)
          const next = back?.view === action.view ? back : { view: action.view }
          // Android's back walks up a fixed ladder (lib/backNavigation), not
          // through history, so each step replaces the address.
          if (!next.restore) window.scrollTo({ top: 0, behavior: 'instant' })
          const url = urlForRoute(next)
          if (url !== currentUrl()) window.history.replaceState(null, '', url)
          setRoute(next)
        } else void leaveApp()
      }),
    [],
  )

  // The Android app follows Google Play's answer about the Garden Pass; reading
  // it here re-renders the whole garden whenever that answer changes, so
  // every Pass check below sees it at once.
  const pass = usePassStatus()
  useEffect(() => (isAndroidApp() ? trackPassStatus() : undefined), [])

  // The theme on screen, chosen or followed (lib/theme). Everything that
  // matches the theme reads this, never profile.theme, which is only the
  // choice made by hand.
  //
  // The recap's "Fade the garden to night and close" holds night until the
  // morning without touching that choice, so following the device, or a
  // sunlight chosen by hand, is back after it. A draft, so a reload keeps it.
  const [nightUntilDraft, setNightUntil] = useDraft(NIGHT_UNTIL_DRAFT, '')
  const nightUntil = Number(nightUntilDraft) || undefined
  const chosenTheme = useEffectiveTheme(garden.state?.profile)
  const theme = useEffectiveTheme(garden.state?.profile, nightUntil)
  const night = theme === 'night'
  const nightHeld = theme !== chosenTheme
  // The soundscape follows the theme on screen when night brings the piano.
  const soundProfile = garden.state?.profile
  const heardTrackId = heardTrack(soundProfile, theme)
  const ambient = useAmbientSound({
    enabled: Boolean(soundProfile?.ambientSound) && appActive,
    trackId: heardTrackId,
    volume: soundVolumeOf(soundProfile),
    fadeEndsAt: fadeOut.endsAt,
    pauseWhenHidden: soundProfile?.soundInBackground === false,
  })
  useEffect(() => {
    void setSystemBarsForTheme(night)
  }, [night])
  // The browser's own bars follow the garden while one is open, and the
  // device's dark setting again (as index.html has it) once none is.
  useEffect(() => (hasGarden ? paintBrowserBars(theme) : undefined), [hasGarden, theme])

  // Text size scales the root, which every rem in the stylesheets reads. It
  // goes with the garden: onboarding and the recovery screen are always at
  // the usual size.
  const textSize = garden.state?.profile?.textSize
  useEffect(() => applyTextSize(textSize), [textSize])

  // The recap's "Fade the garden to night and close" hands focus to the
  // garden's name when the garden arrives, rather than leaving it nowhere.
  const focusGardenTitle = useRef(false)
  useEffect(() => {
    if (view !== 'garden' || !focusGardenTitle.current) return
    focusGardenTitle.current = false
    document.getElementById('garden-title')?.focus()
  }, [view])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    const handleInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeinstallprompt', handleInstall)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeinstallprompt', handleInstall)
    }
  }, [])

  // When another tab applies an update, this one reloads with it, whatever
  // it shows (lib/appUpdate). The Android app has one window and no service
  // worker; the check is inline so its build leaves all of this out.
  useEffect(
    () => (import.meta.env.VITE_PLATFORM === 'android' ? undefined : followUpdates()),
    [],
  )

  // After an update, What's new opens by itself once (hooks/useWhatsNewOnce).
  useWhatsNewOnce({
    screen:
      garden.loading || !splashDone ? 'loading' : garden.state?.profile ? 'garden' : 'no-garden',
    readOnly: garden.persistence.readOnly,
    lastSeenReleaseId: garden.state?.profile?.lastSeenReleaseId,
    onOpen: () => {
      garden.markReleaseSeen(currentRelease.id)
      setView('whats-new')
    },
  })

  if (garden.loading || !splashDone) {
    return <SplashScreen />
  }

  if (!garden.state?.profile) {
    // A garden is stored but could not be read: never greet its gardener as
    // a newcomer. The recovery screen says what happened and what to do.
    if (garden.persistence.readOnly) {
      return (
        <RecoveryScreen
          reason={garden.persistence.reason}
          onRestore={garden.importGarden}
          onDownloadSetAside={garden.quarantinedCopy}
          onStartFresh={garden.startFresh}
        />
      )
    }
    return (
      <>
        {garden.persistence.notice && (
          <div className="persistence-banner notice-banner" role="status">
            <span>{garden.persistence.notice}</span>
            <button
              className="notice-dismiss"
              aria-label="Dismiss notice"
              onClick={garden.dismissNotice}
            >
              ×
            </button>
          </div>
        )}
        <Suspense fallback={<SplashScreen />}>
          <Onboarding
            onComplete={finishOnboarding}
            onRestore={garden.importGarden}
            arriving={arriving}
            movedTo={movedTo()}
          />
        </Suspense>
      </>
    )
  }

  const state = garden.state
  const profile = state.profile
  const newAddress = movedTo()
  // Unreachable after the check above; it narrows the type for what follows.
  if (!profile) return null
  const sunlight = sunlightForDate(state, today)
  const activeTrackName = ambientTrackName(heardTrackId)
  const recapCollected = recap.targetDate
    ? Boolean(moonlightForDate(state, recap.targetDate))
    : false
  // Withheld gardens cannot save, and a bonus that silently does not persist
  // is worse than one that was never offered.
  const offeredRecap = garden.persistence.readOnly ? undefined : recap
  /** The day the recap would close, once it is actually on offer. */
  const recapTarget =
    offeredRecap?.open && !recapCollected ? offeredRecap.targetDate : undefined
  /**
   * The recap is the one view that can stop being available while the gardener
   * is standing in it: four o'clock arrives, or another tab collects the night
   * first.
   *
   * A recap already opened stays open for the day it was opened for, until it
   * is collected or left -- four o'clock arriving mid-answer used to drop the
   * gardener back on Today with their words gone. It is bounded to that day or
   * the one after, so a tab left in the recap does not keep offering a night
   * from days ago. Another tab collecting the night still closes it, derived
   * here rather than corrected after the fact, so the flow is never rendered
   * against a day already closed.
   */
  const openedRecapDate =
    recapOpenedFor &&
    !garden.persistence.readOnly &&
    !moonlightForDate(state, recapOpenedFor) &&
    addDaysToLocalDate(recapOpenedFor, 1) >= today
      ? recapOpenedFor
      : undefined
  const inRecap = view === 'recap' && openedRecapDate !== undefined
  const activeView: AppView = view === 'recap' && !inRecap ? 'today' : view
  /**
   * The Guide at one of its sections, remembering the page to return to and
   * where on it the link was: how far down, and on Care, whose link it was.
   */
  const openGuideAt = (section: string, companionId?: string) =>
    navigate({
      view: 'guide',
      section,
      from: activeView,
      fromPlace: { section, scrollY: window.scrollY, companionId },
    })
  /** Breathing with a butterfly, remembering the page that offered it. */
  const openBreathe = (from: AppView = activeView) => navigate({ view: 'breathe', from })
  // The header's switch says what pressing it does, following included: it
  // chooses the other theme by hand, which ends following. A night held by
  // the recap simply ends, and what was chosen or followed is back.
  const themeSwitchLabel = `${night ? 'Switch to sunlight mode' : 'Switch to night mode'}${
    nightHeld
      ? ''
      : profile.themeFollows === 'device'
      ? ' and stop following your device'
      : profile.themeFollows === 'evening'
        ? ' and stop following your evening'
        : ''
  }`
  /**
   * The recap's other ending: put the phone down. The night is collected as
   * ever (MoonlightRecap does that first); then the garden turns to night
   * until the morning, unless it is already night, without changing the
   * theme chosen or followed; and a sound that is playing starts to fade, as
   * Settings' timer would, unless a fade is already on its way.
   */
  const fadeToNight = () => {
    if (!night) setNightUntil(String(nextMorning(profile, new Date()).getTime()))
    if (profile.ambientSound && fadeOut.endsAt === undefined)
      fadeOut.choose(fadeOut.minutes ?? FADE_TO_NIGHT_MINUTES, true)
    focusGardenTitle.current = true
    setView('garden')
  }

  return (
    <div
      className={`app-shell theme-${theme} ${motionClass(motionPreference(profile))}`}
    >
      <header className="app-header">
        <button
          className="brand"
          onClick={() => setView('garden')}
          // The wordmark is hidden on narrow screens, which would otherwise
          // leave this button with no accessible name at all.
          aria-label={`The Butterfly Garden — ${profile.gardenName}. Go to the garden.`}
        >
          <img
            src={`${import.meta.env.BASE_URL}icons/icon-192.webp`}
            alt=""
            width={40}
            height={40}
          />
          <span aria-hidden="true">
            <strong>The Butterfly Garden</strong>
            <small>{profile.gardenName}</small>
          </span>
        </button>
        <PrimaryNav items={navItems} current={activeView} onNavigate={setView} />
        <div className="header-actions">
          <span className="header-sunlight" title="Sunlight earned today">
            <Icon name="sun" size={19} />
            {sunlight} / {DAILY_SUNLIGHT_CAP}
            <span className="sr-only"> Sunlight today</span>
          </span>
          <span className="nectar-wallet" title="Nectar balance">
            <Icon name="nectar" size={19} />
            <strong>{state.nectar}</strong> <span>Nectar</span>
          </span>
          <span className="stardust-wallet" title="Stardust balance">
            <Icon name="stardust" size={19} />
            <strong>{state.stardust}</strong> <span>Stardust</span>
          </span>
          {installPrompt && (
            <button
              className="install-button"
              onClick={() => {
                void (async () => {
                  await installPrompt.prompt()
                  await installPrompt.userChoice
                  setInstallPrompt(undefined)
                })()
              }}
            >
              Install app
            </button>
          )}
          <button
            className={`theme-toggle sound-toggle ${profile.ambientSound ? 'sound-on' : ''}`}
            onClick={() => {
              fadeOut.soundSwitched(!profile.ambientSound)
              garden.toggleAmbientSound()
            }}
            aria-pressed={profile.ambientSound ?? false}
            aria-label={
              profile.ambientSound
                ? `Turn off ${activeTrackName}`
                : `Turn on ${activeTrackName}`
            }
            title={
              profile.ambientSound
                ? `Turn off ${activeTrackName}`
                : `Turn on ${activeTrackName}`
            }
          >
            <Icon name="music" />
          </button>
          <button
            className="theme-toggle"
            onClick={() => {
              setNightUntil('')
              if (!nightHeld) garden.toggleTheme(theme)
            }}
            aria-label={themeSwitchLabel}
            title={themeSwitchLabel}
          >
            <Icon name={night ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      {!online && !isAndroidApp() && (
        <div className="offline-banner" role="status">
          You are offline. Your garden is still available and changes remain on
          this device.
        </div>
      )}

      {garden.persistence.readOnly &&
        garden.persistence.reason === 'deleting' && (
          <div className="persistence-banner" role="alert">
            <strong>This garden is being deleted in another tab.</strong>
            <span>Saving is paused here so nothing can be written back.</span>
          </div>
        )}

      {garden.persistence.readOnly &&
        garden.persistence.reason !== 'deleting' && (
        <div className="persistence-banner" role="alert">
          <strong>Your saved garden could not be opened.</strong>
          <span>
            {garden.persistence.reason === 'incompatible'
              ? 'It was written by a newer version of the app. Nothing has been changed or deleted — update the app, or restore a backup from Settings.'
              : garden.persistence.reason === 'unavailable'
                ? isAndroidApp()
                  ? 'The app could not open its storage on this phone. Your garden is still here; try closing and reopening the app.'
                  : 'This browser would not open its local storage. Your garden is still on this device; try reopening the app.'
                : 'The stored garden could not be read, so a copy has been set aside untouched. Restore a backup from Settings, or start fresh.'}
          </span>
          <span>
            Saving is paused so nothing already stored is overwritten.
          </span>
        </div>
      )}

      {garden.persistence.notice && (
        <div className="persistence-banner notice-banner" role="status">
          <span>{garden.persistence.notice}</span>
          <button
            className="notice-dismiss"
            aria-label="Dismiss notice"
            onClick={garden.dismissNotice}
          >
            ×
          </button>
        </div>
      )}

      {garden.persistence.writeError && (
        <div className="persistence-banner" role="alert">
          <strong>Your last change could not be saved.</strong>
          <span>{garden.persistence.writeError}</span>
          <span>
            {isAndroidApp()
              ? 'Recent edits are only held in memory. Save a backup from Settings before closing the app.'
              : 'Recent edits are only in this tab. Export a backup from Settings before closing it.'}
          </span>
        </div>
      )}

      {newAddress && (
        <Suspense fallback={null}>
          <MovedBanner target={newAddress} onExportGarden={garden.exportGarden} />
        </Suspense>
      )}

      <Celebrations />

      <main id="main-content">
        {activeView === 'garden' &&
          hasUnseenRelease(state.profile?.lastSeenReleaseId) && (
            <aside className="release-notice">
              <div>
                <span className="eyebrow">
                  A little more wonder · {releaseName()}
                </span>
                <strong>Your garden has grown.</strong>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  garden.markReleaseSeen(currentRelease.id)
                  setView('whats-new')
                }}
              >
                See what's new →
              </button>
              <button
                className="notice-dismiss"
                aria-label="Dismiss update notice"
                onClick={() => garden.markReleaseSeen(currentRelease.id)}
              >
                ×
              </button>
            </aside>
          )}

        {activeView === 'garden' &&
          isAndroidApp() &&
          pass.lapsed &&
          pass.state !== 'active' && (
            <aside className="release-notice pass-lapse-notice">
              <div>
                <span className="eyebrow">Garden Pass</span>
                <strong>
                  {pass.state === 'suspended'
                    ? 'Your Garden Pass is on hold until Google Play can take the payment.'
                    : pass.state === 'pending'
                      ? 'Your Garden Pass is waiting for a payment to go through.'
                      : 'Your Garden Pass has ended.'}
                </strong>
              </div>
              <span>
                Its outfits, scenes and your own backdrops are resting, not
                deleted.
              </span>
              <button
                className="text-button"
                onClick={() => setView('shop', { onPass: true })}
              >
                See the Garden Pass →
              </button>
              <button
                className="notice-dismiss"
                aria-label="Dismiss Garden Pass notice"
                onClick={() => {
                  setPassStatus({ ...pass, lapsed: false })
                  void dismissPassLapseNotice()
                }}
              >
                ×
              </button>
            </aside>
          )}

        <ErrorBoundary
          resetKey={activeView}
          fallback={() => <ViewProblem onHome={() => setView('garden')} />}
        >
        <Suspense
          fallback={
            <p className="view-loading" role="status">
              Opening…
            </p>
          }
        >
          {activeView === 'garden' && (
            <GardenView
              state={state}
              onPlant={garden.plant}
              onRemovePlant={garden.removePlant}
              onPlaceJar={garden.placeJar}
              onRemoveJarPlacement={garden.removeJarPlacement}
              onSelectCompanion={garden.selectCompanion}
              onRenameCreature={garden.renameCreature}
              onOpenCare={() => setView('care')}
              onCareFor={(companionId) => navigate({ view: 'care', companionId })}
              seedFocus={seedFocus}
              onOpenGuide={() => setView('guide')}
              onPutAwayWelcomeBack={garden.putAwayWelcomeBack}
              onOpenLetter={() => navigate({ view: 'journal', letter: true })}
              onReadLetter={garden.readLetter}
              theme={theme}
            />
          )}
          {activeView === 'care' && (
            <CareView
              state={state}
              today={today}
              onCare={garden.careForCreature}
              onEquip={garden.equipItem}
              onUnequip={garden.unequipSlot}
              onSavePreset={garden.savePreset}
              onWearPreset={garden.wearPreset}
              onRenamePreset={garden.renamePreset}
              onDeletePreset={garden.deletePreset}
              onRestorePreset={garden.restorePreset}
              onRenameCreature={garden.renameCreature}
              onGoToShop={() => setView('shop')}
              openOn={route.companionId}
              onChooseFlight={garden.chooseCompanionFlight}
              onOpenGuide={openGuideAt}
              onAdoptGoal={garden.adoptGoal}
            />
          )}
          {activeView === 'shop' && (
            <ShopView
              state={state}
              onPurchasePattern={garden.purchaseFlightPattern}
              onPurchaseJar={garden.purchaseJar}
              onRecycleJar={garden.recycleJar}
              onRestoreJar={garden.restoreJar}
              onPurchaseItem={garden.purchaseItem}
              onOpenCare={() => setView('care')}
              onOpenFlight={() => setView('flight-patterns')}
              initialTab={shopOpensOnPass ? 'pass' : undefined}
              onSelectBackdrop={garden.selectBackdrop}
              onSaveCustomBackdrop={garden.saveCustomBackdrop}
              onDeleteCustomBackdrop={garden.deleteCustomBackdrop}
              onSelectCustomBackdrop={garden.selectCustomBackdrop}
              onChooseNightBackdrop={garden.chooseNightBackdrop}
            />
          )}
          {activeView === 'flight-patterns' && (
            <FlightPatternsView
              state={state}
              onSelect={garden.selectFlightPattern}
            />
          )}
          {activeView === 'today' && (
            <TodayView
              state={state}
              today={today}
              onSaveMood={garden.saveMood}
              onSaveReflection={garden.saveReflection}
              onAddGoal={garden.addGoal}
              onUpdateGoal={garden.updateGoal}
              onDeleteGoal={garden.deleteGoal}
              onCompleteGoal={garden.completeGoal}
              onSkipGoal={garden.skipGoal}
              onSnoozeGoal={garden.snoozeGoal}
              onWakeGoal={garden.wakeGoal}
              onPlanGoal={garden.planGoal}
              onSetGoalArchived={garden.setGoalArchived}
              onUncompleteGoal={garden.uncompleteGoal}
              onRestoreGoal={garden.restoreGoal}
              onOpenSupport={openSupport}
              onSetGentleDay={garden.setGentleDay}
              onChooseNextPlant={garden.chooseNextPlant}
              onOpenCare={() => setView('care')}
              onAdoptGoal={garden.adoptGoal}
              recap={offeredRecap}
              moonlightCollected={recapCollected}
              openAtCheckIn={route.checkIn}
              onOpenGuide={openGuideAt}
              onOpenBreathe={openBreathe}
              onOpenRecap={() => {
                setRecapOpenedFor(recapTarget)
                setView('recap')
              }}
            />
          )}
          {inRecap && openedRecapDate && (
            <MoonlightRecap
              state={state}
              targetDate={openedRecapDate}
              today={today}
              onCollect={(submission) =>
                garden.collectMoonlight(openedRecapDate, submission)
              }
              onClose={() => setView('today')}
              onFadeToNight={fadeToNight}
              onOpenGuide={openGuideAt}
              onBreathe={() => openBreathe('today')}
            />
          )}
          {activeView === 'guide' && (
            <GuideView
              state={state}
              onShowSeed={(id) => {
                setSeedFocus(id)
                setView('garden')
              }}
              onOpenSupport={openSupport}
              section={route.section}
              returnTo={route.from}
              onReturn={() => {
                const back = returnFromGuide(route)
                if (back) navigate(back)
              }}
              onOpenSection={(section) => navigate({ ...route, section })}
            />
          )}
          {activeView === 'whats-new' && <WhatsNewView />}
          {activeView === 'privacy' && (
            <PrivacyPolicyView onBack={() => setView('settings')} />
          )}
          {activeView === 'notices' && (
            <NoticesView onBack={() => setView('settings')} />
          )}
          {activeView === 'support' && (
            <SupportView
              onBack={() => setView(supportFrom)}
              backLabel={SUPPORT_BACK_LABELS[supportFrom] ?? 'Back to the garden'}
              state={state}
              onBreathe={openBreathe}
            />
          )}
          {activeView === 'breathe' && (
            <BreathingView
              state={state}
              // A session cannot be counted where nothing can be saved.
              onFinish={garden.persistence.readOnly ? undefined : garden.finishBreathing}
              from={route.from}
              onBack={() => setView(route.from ?? 'garden')}
            />
          )}
          {activeView === 'journal' && (
            <JournalView
              state={state}
              onUpdateMood={garden.updateMood}
              onDeleteMood={garden.deleteMood}
              onUpdateReflection={garden.updateReflection}
              onDeleteReflection={garden.deleteReflection}
              onUpdateRecap={garden.updateRecap}
              onDeleteRecap={garden.deleteRecap}
              onAddEarlierMood={garden.addEarlierMood}
              onAddEarlierReflection={garden.addEarlierReflection}
              openLetter={route.letter}
              onReadLetter={garden.readLetter}
              onSetStarred={garden.setStarred}
            />
          )}
          {activeView === 'settings' && (
            <SettingsView
              state={state}
              persistence={garden.persistence}
              onUpdateProfile={garden.updateProfile}
              onSelectAmbientTrack={garden.selectAmbientTrack}
              onSelectBackdrop={garden.selectBackdrop}
              onExportGarden={garden.exportGarden}
              onBackupMade={garden.recordBackup}
              reminderAt={reminderAt}
              onImportGarden={garden.importGarden}
              onUndoRestore={garden.undoRestore}
              onDownloadSetAside={garden.quarantinedCopy}
              onDiscardSetAside={garden.discardQuarantine}
              onCountSetAside={garden.countQuarantined}
              onDeleteAll={garden.deleteAll}
              onOpenWhatsNew={() => {
                garden.markReleaseSeen(currentRelease.id)
                setView('whats-new')
              }}
              onOpenPrivacy={() => setView('privacy')}
              onOpenGardenPass={() => setView('shop', { onPass: true })}
              onOpenNotices={() => setView('notices')}
              onOpenSupport={openSupport}
              onSetDayCountsHidden={garden.setDayCountsHidden}
              onSetRecapHours={garden.setRecapHours}
              onChooseTheme={(choice) => {
                setNightUntil('')
                garden.chooseTheme(choice)
              }}
              onSetTextSize={garden.setTextSize}
              onSetGardenPace={garden.setGardenPace}
              fadeOutMinutes={fadeOut.minutes}
              fadeOutEndsAt={fadeOut.endsAt}
              onChooseFadeOut={(minutes) =>
                fadeOut.choose(minutes, Boolean(profile.ambientSound))
              }
              heardTrackId={heardTrackId}
              onSetSoundVolume={garden.setSoundVolume}
              onHearSoundVolume={ambient.hearVolume}
              onSetSoundFollowsTheme={garden.setSoundFollowsTheme}
              onSetSoundInBackground={garden.setSoundInBackground}
              onSaveCustomBackdrop={garden.saveCustomBackdrop}
              onDeleteCustomBackdrop={garden.deleteCustomBackdrop}
              onSelectCustomBackdrop={garden.selectCustomBackdrop}
              onSetRegion={garden.setRegion}
              onOpenGuide={openGuideAt}
              onChooseNightBackdrop={garden.chooseNightBackdrop}
              onSetReminderTime={garden.setReminderTime}
              onSetLetterQuotes={garden.setLetterQuotes}
            />
          )}
          {route.restore && <PutBack place={route.restore} />}
        </Suspense>
        </ErrorBoundary>
      </main>

      <BottomNav items={navItems} current={activeView} onNavigate={setView} />
      {import.meta.env.VITE_PLATFORM !== 'android' && (
        <Suspense fallback={null}>
          <UpdatePrompt />
        </Suspense>
      )}
    </div>
  )
}

export default App
