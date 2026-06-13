import { useState } from 'react'
import type { AppState } from '../types'

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
