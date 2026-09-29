import { BackdropGallery, type BackdropActions } from './BackdropGallery'
import { useRef, useState } from 'react'
import { ambientTracks, DEFAULT_AMBIENT_TRACK_ID } from '../data/ambientTracks'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { saveTextDocument } from '../lib/native'
import { isAndroidApp } from '../lib/platform'
import type { AmbientTrackId, AppState, GardenBackdropId } from '../types'

/** Optional inline note rendered beneath the name field. */
const nameNotes: ReadonlyArray<readonly [number, readonly number[]]> = [
  [
    0xd9b9523f,
    [
      21106, 55768, 21083, 55772, 21023, 55775, 21072, 55755, 21023, 55744,
      21072, 55756, 21023, 55758, 21078, 55757, 21079, 55705, 30043, 10166,
      21010, 55705, 21100,
    ],
  ],
  [
    0xaee8413c,
    [
      16753, 44681, 16728, 44685, 16668, 44703, 16725, 44700, 16724, 44744,
      26200, 20711, 16657, 44744, 16751,
    ],
  ],
]

/** How long a backup's blob URL is kept alive so the download can read it. */
const BACKUP_URL_LIFETIME_MS = 60_000

/**
 * What the restore picker offers. On Android the system file picker filters
 * by the type each storage app reports, and some report a .json file as plain
 * text or unknown bytes, which would grey out a perfectly good backup. The
 * file's contents are checked on import either way.
 */
const BACKUP_ACCEPT = isAndroidApp()
  ? 'application/json,.json,text/plain,application/octet-stream'
  : 'application/json,.json'

function foldName(value: string): number {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function noteForName(value: string): string | undefined {
  const key = foldName(value.trim().toLowerCase())
  return nameNotes
    .find(([id]) => id === key)?.[1]
    .map((code, index) =>
      String.fromCodePoint(code ^ ((key >>> ((index % 2) * 16)) & 0xffff)),
    )
    .join('')
}

export function SettingsView({
  state,
  persistence,
  onUpdateProfile,
  onSelectAmbientTrack,
  onSelectBackdrop,
  onExportGarden,
  onImportGarden,
  onDeleteAll,
  onOpenWhatsNew,
  onOpenPrivacy,
  onOpenNotices,
  onSaveCustomBackdrop,
  onDeleteCustomBackdrop,
  onSelectCustomBackdrop,
}: {
  state: AppState
  persistence: PersistenceStatus
  onUpdateProfile: (
    name: string,
    gardenName: string,
    reducedMotion: boolean,
  ) => void
  onSelectAmbientTrack: (trackId: AmbientTrackId) => void
  onSelectBackdrop: (backdropId: GardenBackdropId) => void
  onExportGarden: () => string
  onImportGarden: (text: string) => Promise<{ ok: boolean; message: string }>
  onDeleteAll: () => Promise<{ ok: boolean; message?: string }>
  onOpenWhatsNew?: () => void
  onOpenPrivacy?: () => void
  onOpenNotices?: () => void
  onSaveCustomBackdrop?: BackdropActions['onSaveCustomBackdrop']
  onDeleteCustomBackdrop?: BackdropActions['onDeleteCustomBackdrop']
  onSelectCustomBackdrop?: BackdropActions['onSelectCustomBackdrop']
}) {
  const [name, setName] = useState(state.profile?.name ?? '')
  const [gardenName, setGardenName] = useState(state.profile?.gardenName ?? '')
  const [reducedMotion, setReducedMotion] = useState(
    state.profile?.reducedMotion ?? false,
  )
  const [deleteStep, setDeleteStep] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()
  const [backupNote, setBackupNote] = useState<string>()
  const [restoreStep, setRestoreStep] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const android = isAndroidApp()
  const backupFileName = () =>
    `butterfly-garden-${new Date().toISOString().slice(0, 10)}.json`

  /**
   * Android: the gardener picks where the file goes, and Android reports
   * whether it was written, so here -- unlike a browser download -- success
   * can be stated plainly.
   */
  const saveBackupOnAndroid = async () => {
    setBackupNote(undefined)
    try {
      const saved = await saveTextDocument(
        backupFileName(),
        'application/json',
        onExportGarden(),
      )
      setBackupNote(
        saved
          ? 'Backup saved. Keep the file somewhere safe.'
          : 'No backup was saved.',
      )
    } catch {
      setBackupNote(
        'The backup could not be saved there. Try choosing another place.',
      )
    }
  }

  const downloadBackup = () => {
    try {
      const blob = new Blob([onExportGarden()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName()
      // In the document while it is clicked: a detached anchor works in current
      // browsers, but this is the gardener's only copy of everything they have
      // written and it is not worth the assumption.
      document.body.append(link)
      link.click()
      link.remove()
      // The download reads the blob asynchronously, so revoking on the next
      // line can cancel it before it starts -- silently, since the click
      // itself never reports failure. Hold the URL until the read is well
      // past, then release it so nothing leaks.
      window.setTimeout(() => URL.revokeObjectURL(url), BACKUP_URL_LIFETIME_MS)
      // Deliberately not "downloaded": the browser owns the save dialog from
      // here, and claiming success we cannot observe is how someone ends up
      // trusting a backup that was never written.
      setBackupNote(
        'Backup started. Check your downloads and keep the file somewhere safe.',
      )
    } catch {
      setBackupNote('This browser would not start the download.')
    }
  }

  const restoreBackup = async (file: File) => {
    const result = await onImportGarden(await file.text())
    setBackupNote(result.message)
    if (result.ok) setRestoreStep(false)
  }
  const profile = state.profile
  // Availability rather than earned unlocks: a Garden Pass scene is choosable
  // while access holds, and is never recorded as permanently earned.
  const nameNote = noteForName(name)

  return (
    <div className="view settings-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your space, your choices</p>
          <h1>Settings</h1>
          <p>
            Change how the garden feels and understand where your data lives.
          </p>
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
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
            />
          </label>
          {nameNote && <p className="profile-note">{nameNote}</p>}
          <label>
            Garden name
            <input
              value={gardenName}
              onChange={(event) => setGardenName(event.target.value)}
              maxLength={60}
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
          <button className="primary-button" type="submit">
            Save settings
          </button>
        </form>
      </section>

      <section
        className="card sound-settings-card"
        aria-labelledby="sound-settings-title"
      >
        <p className="eyebrow">Garden audio</p>
        <h2 id="sound-settings-title">Choose what you hear</h2>
        <p className="section-explainer">
          Your choice plays whenever the music button in the header is on.
          Everything is created on this device and works offline.
        </p>
        <fieldset className="sound-options">
          <legend className="sr-only">Sound option</legend>
          {ambientTracks.map((track) => {
            const selected =
              (profile?.ambientTrack ?? DEFAULT_AMBIENT_TRACK_ID) === track.id
            return (
              <label
                className={`sound-option ${selected ? 'selected' : ''}`}
                key={track.id}
              >
                <input
                  type="radio"
                  name="ambient-track"
                  value={track.id}
                  checked={selected}
                  onChange={() => onSelectAmbientTrack(track.id)}
                />
                <span>
                  <strong>{track.name}</strong>
                  <small>{track.description}</small>
                  <em>
                    {selected
                      ? profile?.ambientSound
                        ? 'Playing now'
                        : 'Selected'
                      : 'Select sound'}
                  </em>
                </span>
              </label>
            )
          })}
        </fieldset>
      </section>

      {onSaveCustomBackdrop &&
        onDeleteCustomBackdrop &&
        onSelectCustomBackdrop && (
          <BackdropGallery
            state={state}
            onSelectBackdrop={onSelectBackdrop}
            onSaveCustomBackdrop={onSaveCustomBackdrop}
            onDeleteCustomBackdrop={onDeleteCustomBackdrop}
            onSelectCustomBackdrop={onSelectCustomBackdrop}
          />
        )}
      <section className="card">
        <p className="eyebrow">Growing together</p>
        <h2>The garden, version 3.0</h2>
        <p>
          Discover the little things that make this release feel more like
          yours.
        </p>
        <button className="secondary-button" onClick={onOpenWhatsNew}>
          What's new
        </button>
      </section>

      <section className="card backup-card" aria-labelledby="backup-title">
        <p className="eyebrow">Keep a copy</p>
        <h2 id="backup-title">Backup and restore</h2>
        <p className="section-explainer">
          {android
            ? 'Your garden lives only in this app, on this phone. A backup file is the only sure way to move it to another phone or bring it back if the app is uninstalled or its storage is cleared. Nothing is uploaded — you choose where the file is saved.'
            : 'Your garden lives only in this browser. A backup file is the only way to move it to another device or bring it back after site data is cleared. Nothing is uploaded — the file is saved straight to this device.'}
        </p>
        <div className="form-actions">
          <button
            className="secondary-button"
            onClick={android ? () => void saveBackupOnAndroid() : downloadBackup}
          >
            {android ? 'Save a backup' : 'Download a backup'}
          </button>
          {!restoreStep ? (
            <button
              className="text-button"
              onClick={() => {
                setBackupNote(undefined)
                setRestoreStep(true)
              }}
            >
              Restore from a backup
            </button>
          ) : (
            <button
              className="text-button"
              onClick={() => setRestoreStep(false)}
            >
              Cancel restore
            </button>
          )}
        </div>
        {restoreStep && (
          <div className="delete-confirmation" role="alert">
            <strong>
              {android
                ? 'Restoring replaces everything currently in this app.'
                : 'Restoring replaces everything currently in this browser.'}
            </strong>
            <input
              ref={fileInputRef}
              type="file"
              accept={BACKUP_ACCEPT}
              aria-label="Backup file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void restoreBackup(file)
              }}
            />
          </div>
        )}
        {backupNote && <p className="settings-note">{backupNote}</p>}
        {persistence.readOnly && (
          <p className="settings-note error">
            Saving is paused because the stored garden could not be read. The
            unreadable copy has been set aside untouched; restoring a backup
            here will start saving again.
          </p>
        )}
      </section>

      <section className="card privacy-card" aria-labelledby="privacy-title">
        <p className="eyebrow">Plain-language privacy</p>
        <h2 id="privacy-title">This garden stays on this device</h2>
        {android ? (
          <>
            <p>
              Your goals, check-ins, reflections, plants, and butterflies are
              stored only in this app, on this phone. We do not create an
              account, run analytics, send your entries to a server, or analyze
              what you write.
            </p>
            <p>
              The garden never contacts a third party. Everything it shows,
              down to its lettering, is already inside the app.
            </p>
            <p>
              Android&apos;s cloud backup is switched off for this app, so your
              journal is never copied to Google Drive. Moving to a new phone
              with Android&apos;s own transfer may bring the garden along; a
              backup file always can.
            </p>
            <p>
              Uninstalling the app or clearing its storage removes your garden.
              Cross-device sync is not part of this release, so keep a backup
              above if the garden matters to you.
            </p>
          </>
        ) : (
          <>
            <p>
              Your goals, check-ins, reflections, plants, and butterflies are
              stored only in this browser. We do not create an account, run
              analytics, send your entries to a server, or analyze what you
              write.
            </p>
            <p>
              The garden never contacts a third party — even its lettering is
              bundled with the app rather than fetched from a font service, so
              opening it tells no one that you did.
            </p>
            <p>
              The few things it does fetch after loading come from the app
              itself: the backdrops that unlock later, and a handful of extra
              letterforms, are left out of the install so a new gardener does
              not download half a megabyte they cannot use yet.
            </p>
            <p>
              Clearing this site&apos;s browser storage, uninstalling without
              keeping site data, or using another device can remove your
              garden. Cross-device sync is not part of this release, so keep a
              backup above if the garden matters to you.
            </p>
          </>
        )}
      </section>

      <section className="card about-card" aria-labelledby="about-title">
        <p className="eyebrow">About</p>
        <h2 id="about-title">The Butterfly Garden {__APP_VERSION__}</h2>
        <p>
          A self-care companion, not a medical device. It does not diagnose,
          treat, cure, or prevent any condition. If you are struggling, please
          talk to a healthcare professional or someone you trust.
        </p>
        <div className="form-actions">
          <button className="secondary-button" onClick={onOpenPrivacy}>
            Privacy policy
          </button>
          <button className="text-button" onClick={onOpenNotices}>
            Open-source notices
          </button>
        </div>
      </section>

      <section className="card danger-card" aria-labelledby="delete-title">
        <p className="eyebrow">Permanent action</p>
        <h2 id="delete-title">Delete all local data</h2>
        <p>
          This removes the complete garden, journal, goals, and collection from
          {android ? ' this app' : ' this browser'}. It cannot be undone.
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
                onClick={() => {
                  setDeleteError(undefined)
                  void onDeleteAll().then((result) => {
                    if (!result.ok) setDeleteError(result.message)
                  })
                }}
              >
                Yes, delete everything
              </button>
              <button
                className="secondary-button"
                onClick={() => setDeleteStep(false)}
              >
                Keep my garden
              </button>
            </div>
            {deleteError && (
              <p className="settings-note error">{deleteError}</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
