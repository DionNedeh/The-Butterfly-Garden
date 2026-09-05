import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import './theme-aurora.css'
import { GardenView } from './components/GardenView'
import { Icon } from './components/Icons'
import { Onboarding } from './components/Onboarding'
import { SplashScreen } from './components/SplashScreen'
import { TodayView } from './components/TodayView'
import { UpdatePrompt } from './components/UpdatePrompt'

/**
 * The garden and Today are what the app opens on; everything else is fetched
 * when the gardener first walks into it, so the initial download does not
 * carry the shop catalogue, the guide, and every journal view at once.
 */
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
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView })),
)
const ShopView = lazy(() =>
  import('./components/ShopView').then((m) => ({ default: m.ShopView })),
)
import {
  ambientTrackName,
  DEFAULT_AMBIENT_TRACK_ID,
} from './data/ambientTracks'
import { useAmbientSound } from './hooks/useAmbientSound'
import { useGardenState } from './hooks/useGardenState'
import { useLocalDate } from './hooks/useLocalDate'
import { sunlightForDate } from './lib/progression'
import type { AppView } from './types'

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

const navigation: Array<{
  id: AppView
  label: string
  icon:
    | 'garden'
    | 'care'
    | 'today'
    | 'journal'
    | 'shop'
    | 'flight'
    | 'flower'
    | 'settings'
}> = [
  { id: 'garden', label: 'Garden', icon: 'garden' },
  { id: 'care', label: 'Care', icon: 'care' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
  { id: 'flight-patterns', label: 'Flight', icon: 'flight' },
  { id: 'guide', label: 'Guide', icon: 'flower' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

function App() {
  const garden = useGardenState()
  const today = useLocalDate()
  const [view, setView] = useState<AppView>('garden')
  useAmbientSound(
    Boolean(garden.state?.profile?.ambientSound),
    garden.state?.profile?.ambientTrack ?? DEFAULT_AMBIENT_TRACK_ID,
  )
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashDone(true), SPLASH_MINIMUM_MS)
    return () => window.clearTimeout(timer)
  }, [])

  // Ambient motion costs nothing to keep running while nobody is looking, but
  // it is not free on every device, so it stops when the tab is hidden.
  useEffect(() => {
    const syncVisibility = () => {
      document.documentElement.classList.toggle(
        'page-hidden',
        document.visibilityState === 'hidden',
      )
    }
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      document.documentElement.classList.remove('page-hidden')
    }
  }, [])

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

  if (garden.loading || !splashDone) {
    return <SplashScreen />
  }

  if (!garden.state?.profile) {
    return <Onboarding onComplete={garden.onboard} />
  }

  const state = garden.state
  const profile = state.profile
  if (!profile) return <Onboarding onComplete={garden.onboard} />
  const sunlight = sunlightForDate(state, today)
  const activeTrackName = ambientTrackName(profile.ambientTrack)

  return (
    <div
      className={`app-shell theme-${profile.theme ?? 'sunlight'} ${profile.reducedMotion ? 'reduce-motion' : ''}`}
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
        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="header-sunlight" title="Sunlight earned today">
            <Icon name="sun" size={19} />
            {sunlight} / 5
          </span>
          <span className="nectar-wallet" title="Nectar balance">
            <Icon name="nectar" size={19} />
            <strong>{state.nectar}</strong>
            <span>Nectar</span>
          </span>
          <span className="stardust-wallet" title="Stardust balance">
            <Icon name="stardust" size={19} />
            <strong>{state.stardust}</strong>
            <span>Stardust</span>
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
            onClick={garden.toggleAmbientSound}
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
            onClick={garden.toggleTheme}
            aria-label={
              profile.theme === 'night'
                ? 'Switch to sunlight mode'
                : 'Switch to night mode'
            }
            title={
              profile.theme === 'night'
                ? 'Switch to sunlight mode'
                : 'Switch to night mode'
            }
          >
            <Icon name={profile.theme === 'night' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      {!online && (
        <div className="offline-banner" role="status">
          You are offline. Your garden is still available and changes remain on
          this device.
        </div>
      )}

      {garden.persistence.readOnly && (
        <div className="persistence-banner" role="alert">
          <strong>Your saved garden could not be opened.</strong>
          <span>
            {garden.persistence.reason === 'incompatible'
              ? 'It was written by a newer version of the app. Nothing has been changed or deleted — update the app, or restore a backup from Settings.'
              : garden.persistence.reason === 'unavailable'
                ? 'This browser would not open its local storage. Your garden is still on this device; try reopening the app.'
                : 'The stored garden could not be read, so a copy has been set aside untouched. Restore a backup from Settings, or start fresh.'}
          </span>
          <span>Saving is paused so nothing already stored is overwritten.</span>
        </div>
      )}

      {garden.persistence.writeError && (
        <div className="persistence-banner" role="alert">
          <strong>Your last change could not be saved.</strong>
          <span>{garden.persistence.writeError}</span>
          <span>
            Recent edits are only in this tab. Export a backup from Settings
            before closing it.
          </span>
        </div>
      )}

      <main id="main-content">
        <Suspense fallback={<p className="view-loading" role="status">Opening…</p>}>
        {view === 'garden' && (
          <GardenView
            state={state}
            onPlant={garden.plant}
            onRemovePlant={garden.removePlant}
            onPlaceJar={garden.placeJar}
            onRemoveJarPlacement={garden.removeJarPlacement}
            onSelectCompanion={garden.selectCompanion}
            onRenameCreature={garden.renameCreature}
            onOpenCare={() => setView('care')}
          />
        )}
        {view === 'care' && (
          <CareView
            state={state}
            today={today}
            onCare={garden.careForCreature}
            onEquip={garden.equipItem}
            onUnequip={garden.unequipSlot}
            onRenameCreature={garden.renameCreature}
            onGoToShop={() => setView('shop')}
          />
        )}
        {view === 'shop' && (
          <ShopView
            state={state}
            onPurchasePattern={garden.purchaseFlightPattern}
            onPurchaseJar={garden.purchaseJar}
            onPurchaseItem={garden.purchaseItem}
          />
        )}
        {view === 'flight-patterns' && (
          <FlightPatternsView
            state={state}
            onSelect={garden.selectFlightPattern}
          />
        )}
        {view === 'today' && (
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
          />
        )}
        {view === 'guide' && <GuideView />}
        {view === 'journal' && (
          <JournalView
            state={state}
            onUpdateMood={garden.updateMood}
            onDeleteMood={garden.deleteMood}
            onUpdateReflection={garden.updateReflection}
            onDeleteReflection={garden.deleteReflection}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            state={state}
            persistence={garden.persistence}
            onUpdateProfile={garden.updateProfile}
            onSelectAmbientTrack={garden.selectAmbientTrack}
            onSelectBackdrop={garden.selectBackdrop}
            onExportGarden={garden.exportGarden}
            onImportGarden={garden.importGarden}
            onDeleteAll={garden.deleteAll}
          />
        )}
        </Suspense>
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? 'active' : ''}
            onClick={() => setView(item.id)}
            aria-current={view === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <UpdatePrompt />
    </div>
  )
}

export default App
