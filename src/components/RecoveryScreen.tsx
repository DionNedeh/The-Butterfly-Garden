import { useRef, useState } from 'react'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { isSealedBackup, readBackupFile } from '../lib/backupFile'
import { datedFileName, saveTextFile } from '../lib/download'
import { reloadApp } from '../lib/reload'
import type { FileCopy } from '../lib/sightingPhotos'
import { ProtectedRestore } from './backup/ProtectedRestore'

/**
 * Shown instead of onboarding when a garden is stored but could not be read.
 *
 * This used to greet the gardener as brand new and ask them to name a garden,
 * which is the worst thing to say to someone with years of entries. Here they
 * are told what happened and what each choice does, safest first.
 */
export function RecoveryScreen({
  reason,
  onRestore,
  onDownloadSetAside,
  onStartFresh,
}: {
  reason: PersistenceStatus['reason']
  onRestore: (text: string) => Promise<{ ok: boolean; message: string }>
  onDownloadSetAside: () => Promise<FileCopy | undefined>
  onStartFresh: () => Promise<{ ok: boolean; message?: string }>
}) {
  const [note, setNote] = useState<string>()
  const [confirmFresh, setConfirmFresh] = useState(false)
  /** A protected backup chosen to restore, waiting for its passphrase. */
  const [sealedChoice, setSealedChoice] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)
  const unavailable = reason === 'unavailable'

  // The platform is checked inline, so each build carries only its own words.
  const explanation =
    reason === 'incompatible'
      ? 'It was written by a newer version of the app. Nothing has been changed or deleted. Updating the app is the simplest fix.'
      : unavailable
        ? import.meta.env.VITE_PLATFORM === 'android'
          ? 'The app could not open its storage on this phone. Your garden is still here. Closing and reopening the app usually fixes this.'
          : 'This browser would not open its storage just now. Your garden is still on this device. Reopening the app usually fixes this.'
        : 'Part of it could not be read, so a copy has been set aside untouched. You can download that copy, put a backup back, or start a new garden.'

  const downloadSetAside = async () => {
    setNote(undefined)
    try {
      const copy = await onDownloadSetAside()
      if (!copy) {
        setNote('There is no set-aside copy to download yet.')
        return
      }
      const outcome = await saveTextFile(
        datedFileName('set-aside-copy'),
        'application/json',
        copy.text,
      )
      setNote(
        outcome === 'cancelled'
          ? 'Nothing was saved.'
          : `Keep that file safe: it is the garden exactly as it was stored.${copy.leftOut ? ` ${copy.leftOut}` : ''}`,
      )
    } catch {
      setNote('The set-aside copy could not be saved there.')
    }
  }

  const restoreText = async (text: string) => {
    setNote((await onRestore(text)).message)
  }

  const restore = async (file: File) => {
    setNote(undefined)
    const chosen = await readBackupFile(file)
    if (!chosen.ok) {
      setNote(chosen.message)
      return
    }
    // A protected backup asks for its passphrase, then restores as any other.
    if (isSealedBackup(chosen.text)) setSealedChoice(chosen.text)
    else await restoreText(chosen.text)
  }

  return (
    <main className="safe-mode recovery-screen" aria-labelledby="recovery-title">
      <section className="card safe-mode-card">
        <p className="eyebrow">Your garden is safe</p>
        <h1 id="recovery-title">Your saved garden could not be opened</h1>
        <p>{explanation}</p>
        <p>Saving is paused, so nothing already stored can be overwritten.</p>
        <div className="form-actions">
          {unavailable ? (
            <button
              className="primary-button"
              onClick={reloadApp}
            >
              Try again
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() => void downloadSetAside()}
            >
              Download the set-aside copy
            </button>
          )}
          <label className="secondary-button file-button">
            Restore a backup
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json,text/plain,application/octet-stream"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void restore(file)
              }}
            />
          </label>
        </div>
        {sealedChoice !== undefined && (
          <ProtectedRestore
            text={sealedChoice}
            returnFocus={() => fileInput.current}
            onOpened={(plain) => {
              setSealedChoice(undefined)
              void restoreText(plain)
            }}
            onClose={(message) => {
              setSealedChoice(undefined)
              setNote(message)
            }}
          />
        )}
        {note && (
          <p className="settings-note" role="status">
            {note}
          </p>
        )}
        {!unavailable && (
          <div className="safe-mode-fresh">
            {!confirmFresh ? (
              <button
                className="text-button"
                onClick={() => setConfirmFresh(true)}
              >
                Start a new garden instead…
              </button>
            ) : (
              <div className="delete-confirmation" role="alert">
                <strong>
                  The set-aside copy stays on this device, and you can still
                  download it from Settings. A new garden starts empty.
                </strong>
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      void onStartFresh().then(
                        (result) => {
                          if (!result.ok) setNote(result.message)
                        },
                        () => setNote('A new garden could not be started just now.'),
                      )
                    }}
                  >
                    Start a new garden
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setConfirmFresh(false)}
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
