import { useEffect, useState } from 'react'
import './App.css'
import { GardenView } from './components/GardenView'
import { Icon } from './components/Icons'
import { JournalView } from './components/JournalView'
import { Onboarding } from './components/Onboarding'
import { SettingsView } from './components/SettingsView'
import { TodayView } from './components/TodayView'
import { UpdatePrompt } from './components/UpdatePrompt'
import { useGardenState } from './hooks/useGardenState'
import { sunlightForDate } from './lib/progression'
import { toLocalDate } from './lib/date'
import type { AppView } from './types'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const navigation: Array<{
  id: AppView
  label: string
  icon: 'garden' | 'today' | 'journal' | 'settings'
}> = [
  { id: 'garden', label: 'Garden', icon: 'garden' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

function App() {
  const garden = useGardenState()
  const [view, setView] = useState<AppView>('garden')
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>()

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

  if (garden.loading) {
    return (
      <main className="loading-screen">
        <span className="chrysalis" aria-hidden="true" />
        <p>Waking the garden...</p>
      </main>
    )
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
      className={`app-shell ${profile.reducedMotion ? 'reduce-motion' : ''}`}
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
            onSelectCompanion={garden.selectCompanion}
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
          />
        )}
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
