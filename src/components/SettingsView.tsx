import { useState } from 'react'
import {
  DAILY_SEED_REWARD,
  DAILY_SUNLIGHT_CAP,
  EMERGENCE_SEED_REWARD,
  PLANT_SEED_COST,
  STARTER_SEEDS,
} from '../lib/progression'
import type { AppState } from '../types'

const guideSections = [
  {
    title: 'Garden and daily care',
    body: `The Garden shows your plants, developing caterpillars and chrysalises, and every butterfly you have welcomed. In Today, a mood check-in, a completed goal, or a saved reflection can each earn one Sunlight. You can earn up to ${DAILY_SUNLIGHT_CAP} Sunlight per local calendar day. Missing a day never harms plants or butterflies.`,
  },
  {
    title: 'Seeds and planting',
    body: `You begin with ${STARTER_SEEDS} seeds. The first Sunlight you earn each local day adds ${DAILY_SEED_REWARD} seed, and every butterfly that emerges adds ${EMERGENCE_SEED_REWARD} more. Planting costs ${PLANT_SEED_COST} seed. Open Plant a seed in the Garden to choose a host or nectar plant.`,
  },
  {
    title: 'Host plants, nectar plants, and growth',
    body: 'Sunlight automatically goes where care is needed: first to a caterpillar already in the garden, otherwise to the next plant that can grow. Plants have three growth stages. A mature host plant can welcome one of its matching caterpillars. Shared host plants prefer a species you have not discovered yet. Nectar plants enrich the sanctuary for adult butterflies but do not attract caterpillars.',
  },
  {
    title: 'Caterpillars, chrysalises, and emergence',
    body: 'A caterpillar needs two care moments before forming a chrysalis. The chrysalis then transforms for a fixed 72 real hours. Its timer updates while the app is open and when you return. Once emergence is reached it cannot reverse, even if the device clock changes. The new butterfly joins your field notes and brings two seeds.',
  },
  {
    title: 'Butterflies and companions',
    body: 'All emerged butterflies live in the garden. Choose one butterfly card as your active companion. Butterflies fly through the garden, pause near flowers, and show tiny hearts when tapped or clicked. Marigold remains your monarch guide.',
  },
  {
    title: 'Journal and Sunlight streak',
    body: 'The Journal contains your butterfly field notes, dated moods, and reflections. Personal entries can be edited or deleted. Your Sunlight streak grows when you earn at least one Sunlight on consecutive local calendar days and restarts after a completely missed day. It does not change plant or butterfly progress.',
  },
  {
    title: 'Goals and the local calendar',
    body: 'Goals can happen once, every day, or on selected weekdays. Recurrence uses the calendar date on this device and is designed to handle daylight-saving changes. Repeating the same completed activity does not create extra Sunlight.',
  },
  {
    title: 'Offline use, updates, and installation',
    body: 'After the first successful load, the app shell is available offline. Changes remain in this browser and save locally. Supported browsers may offer an Install app button for a standalone home-screen experience. When a new version is ready, the app asks before refreshing to apply it.',
  },
  {
    title: 'Privacy, motion, and starting over',
    body: 'There are no accounts, analytics, cloud sync, social features, or analysis of your writing. Reduce garden motion pauses decorative animation. Delete all local data permanently removes this garden from the current browser. Clearing site storage or uninstalling without preserving data can do the same.',
  },
]

export function SettingsView({
  state,
  onUpdateProfile,
  onDeleteAll,
}: {
  state: AppState
  onUpdateProfile: (
    name: string,
    gardenName: string,
    reducedMotion: boolean,
  ) => void
  onDeleteAll: () => Promise<void>
}) {
  const [name, setName] = useState(state.profile?.name ?? '')
  const [gardenName, setGardenName] = useState(state.profile?.gardenName ?? '')
  const [reducedMotion, setReducedMotion] = useState(
    state.profile?.reducedMotion ?? false,
  )
  const [deleteStep, setDeleteStep] = useState(false)

  return (
    <div className="view settings-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your space, your choices</p>
          <h1>Settings</h1>
          <p>Change how the garden feels and understand where your data lives.</p>
        </div>
      </header>

      <section className="card" aria-labelledby="garden-settings-title">
        <p className="eyebrow">Garden details</p>
        <h2 id="garden-settings-title">Make the space yours</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onUpdateProfile(name, gardenName, reducedMotion)
          }}
        >
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {name.trim().toLowerCase() === 'pumpkin' && (
            <p className="pumpkin-message">Made for you with ❤️- S</p>
          )}
          <label>
            Garden name
            <input
              value={gardenName}
              onChange={(event) => setGardenName(event.target.value)}
              required
            />
          </label>
          <label className="toggle-row">
            <span>
              <strong>Reduce garden motion</strong>
              <small>Pause decorative swaying and butterfly flight.</small>
            </span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
          </label>
          <button className="primary-button" type="submit">Save settings</button>
        </form>
      </section>

      <section className="card guide-card" aria-labelledby="guide-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Garden handbook</p>
            <h2 id="guide-title">How everything works</h2>
          </div>
          <span className="guide-seed-balance">
            {state.seeds} seed{state.seeds === 1 ? '' : 's'} ready
          </span>
        </div>
        <p className="section-explainer">
          Open any topic for a plain-language explanation. Your current seed
          balance is shown above.
        </p>
        <div className="guide-list">
          {guideSections.map((section, index) => (
            <details key={section.title} open={index === 1}>
              <summary>{section.title}</summary>
              <p>{section.body}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="card privacy-card" aria-labelledby="privacy-title">
        <p className="eyebrow">Plain-language privacy</p>
        <h2 id="privacy-title">This garden stays on this device</h2>
        <p>
          Your goals, check-ins, reflections, plants, and butterflies are stored
          only in this browser. We do not create an account, run analytics, send
          your entries to a server, or analyze what you write.
        </p>
        <p>
          Clearing this site&apos;s browser storage, uninstalling without keeping
          site data, or using another device can remove your garden. Automatic
          backup and cross-device sync are not part of this first release.
        </p>
      </section>

      <section className="card danger-card" aria-labelledby="delete-title">
        <p className="eyebrow">Permanent action</p>
        <h2 id="delete-title">Delete all local data</h2>
        <p>
          This removes the complete garden, journal, goals, and collection from
          this browser. It cannot be undone.
        </p>
        {!deleteStep ? (
          <button className="danger-button" onClick={() => setDeleteStep(true)}>
            Begin deletion
          </button>
        ) : (
          <div className="delete-confirmation" role="alert">
            <strong>Are you certain you want to start over?</strong>
            <div className="form-actions">
              <button
                className="danger-button"
                onClick={() => void onDeleteAll()}
              >
                Yes, delete everything
              </button>
              <button className="secondary-button" onClick={() => setDeleteStep(false)}>
                Keep my garden
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
