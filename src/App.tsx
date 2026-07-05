import { useEffect, useState } from 'react'
import './App.css'
import './theme-aurora.css'
import { CareView } from './components/CareView'
import { GardenView } from './components/GardenView'
import { GuideView } from './components/GuideView'
import { Icon } from './components/Icons'
import { JournalView } from './components/JournalView'
import { Onboarding } from './components/Onboarding'
import { SettingsView } from './components/SettingsView'
import { ShopView } from './components/ShopView'
import { SplashScreen } from './components/SplashScreen'
import { FlightPatternsView } from './components/FlightPatternsView'
import { TodayView } from './components/TodayView'
import { UpdatePrompt } from './components/UpdatePrompt'
import { useAmbientSound } from './hooks/useAmbientSound'
import { useGardenState } from './hooks/useGardenState'
import { sunlightForDate } from './lib/progression'
import { toLocalDate } from './lib/date'
import type { AppView } from './types'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SPLASH_MINIMUM_MS = 2400

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
  const [view, setView] = useState<AppView>('garden')
  useAmbientSound(Boolean(garden.state?.profile?.ambientSound))
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashDone(true), SPLASH_MINIMUM_MS)
    return () => window.clearTimeout(timer)
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
  const sunlight = sunlightForDate(state, toLocalDate())

  return (
    <div
      className={`app-shell theme-${profile.theme ?? 'sunlight'} ${profile.reducedMotion ? 'reduce-motion' : ''}`}
    >
      <header className="app-header">
        <button className="brand" onClick={() => setView('garden')}>
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
          <span>
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
              onClick={async () => {
                await installPrompt.prompt()
                await installPrompt.userChoice
                setInstallPrompt(undefined)
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
                ? 'Turn off garden sounds'
                : 'Turn on garden sounds'
            }
            title={
              profile.ambientSound
                ? 'Turn off garden sounds'
                : 'Garden sounds: breeze, chimes, and birdsong'
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

      <main id="main-content">
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
            onUpdateProfile={garden.updateProfile}
            onSelectBackdrop={garden.selectBackdrop}
            onDeleteAll={garden.deleteAll}
          />
        )}
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
