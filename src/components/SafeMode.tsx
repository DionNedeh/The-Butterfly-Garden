import { useEffect, useRef, useState } from 'react'
import type { ArriveRestore } from './move/ArriveRestore'
import {
  gardenRepository,
  inspectImportedState,
} from '../repository/gardenRepository'
import { readBackupFile, sealedKind } from '../lib/backupFile'
import { hasPictures } from '../lib/customBackdrops'
import { datedFileName, saveTextFile } from '../lib/download'
import { reloadApp } from '../lib/reload'
import { storedCopy } from '../lib/storedCopy'
import { ProtectedRestore } from './backup/ProtectedRestore'

/**
 * What the gardener sees when the app itself could not draw.
 *
 * Deliberately independent of the garden's React state, which is what failed:
 * everything here talks to the repository directly. The order of the buttons
 * is the order of safety -- keep a copy, put a backup back, and only then,
 * behind a second confirmation, start again.
 */
export function SafeMode({ error }: { error: Error }) {
  const [note, setNote] = useState<string>()
  const [downloaded, setDownloaded] = useState(false)
  const [confirmFresh, setConfirmFresh] = useState(false)
  /** A protected backup chosen to restore, waiting for its passphrase. */
  const [sealedChoice, setSealedChoice] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)
  const arriveButton = useRef<HTMLButtonElement>(null)
  const [Arrive, setArrive] = useState<typeof ArriveRestore>()
  const [arriving, setArriving] = useState(false)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])
  const arrive = async () => {
    setNote(undefined)
    try {
      const module = await import('./move/ArriveRestore')
      if (!live.current) return
      setArrive(() => module.ArriveRestore)
      setArriving(true)
    } catch {
      if (live.current) setNote('Arriving could not start just now. Restore a backup still works; try Arrive again when connected.')
    }
  }

  const downloadStored = async () => {
    setNote(undefined)
    try {
      const copy = await storedCopy()
      const outcome = await saveTextFile(
        datedFileName('everything-stored'),
        'application/json',
        copy.text,
      )
      if (outcome === 'cancelled') {
        setNote('Nothing was saved.')
        return
      }
      setDownloaded(true)
      // Under the lock the copy is sealed as the garden is stored, and is
      // known by the lock's record in it: it can be restored, but only with
      // the lock's own secrets (lib/lockedCopy).
      setNote(
        `${outcome === 'saved' ? 'Saved.' : 'Download started.'} ${
          sealedKind(copy.text)
            ? 'This copy is sealed with your lock: it keeps everything, but it can only be opened by this app, with your passcode or recovery code.'
            : 'Keep this file: it holds everything this app had stored, and can be restored later.'
        }${copy.leftOut ? ` ${copy.leftOut}` : ''}`,
      )
    } catch {
      setNote('What is stored could not be read just now.')
    }
  }

  const restoreText = async (text: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      // The parser's own wording ("Unexpected token…") means nothing here.
      setNote('That file is not a garden backup.')
      return
    }
    try {
      const inspection = inspectImportedState(parsed)
      if (!inspection.state) {
        setNote(
          `That backup could not be restored. ${inspection.refused ?? ''}`,
        )
        return
      }
      if (hasPictures(inspection.state)) {
        const { verifyGardenImages } = await import('../lib/imageImport')
        await verifyGardenImages(inspection.state)
      }
      await gardenRepository.replace(inspection.state, { snapshot: true })
      reloadApp()
    } catch (problem) {
      setNote(
        problem instanceof Error && problem.message
          ? problem.message
          : 'That file is not a garden backup.',
      )
    }
  }

  const restore = async (file: File) => {
    setNote(undefined)
    const chosen = await readBackupFile(file)
    if (!chosen.ok) {
      setNote(chosen.message)
      return
    }
    // A protected backup asks for its passphrase, and a locked garden's copy
    // for its passcode or recovery code; then each restores as any other.
    if (sealedKind(chosen.text)) setSealedChoice(chosen.text)
    else await restoreText(chosen.text)
  }

  const startFresh = async () => {
    try {
      await gardenRepository.clear()
      reloadApp()
    } catch (problem) {
      setNote(
        problem instanceof Error ? problem.message : 'The garden could not be cleared.',
      )
    }
  }

  return (
    <main className="safe-mode" aria-labelledby="safe-mode-title">
      <section className="card safe-mode-card">
        <p className="eyebrow">Safe mode</p>
        <h1 id="safe-mode-title">The garden hit a problem it could not draw</h1>
        <p>
          Nothing has been deleted. Your garden is still stored on this device.
          You can keep a copy of everything stored, put a backup back, or try
          again.
        </p>
        <details className="safe-mode-detail">
          <summary>What went wrong</summary>
          <p>{error.message || 'An unexpected error.'}</p>
        </details>
        <div className="form-actions">
          <button
            className="primary-button"
            onClick={() => void downloadStored()}
          >
            Download what's stored
          </button>
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
          <button
            className="text-button"
            onClick={reloadApp}
          >
            Try again
          </button>
          <button ref={arriveButton} className="secondary-button" onClick={() => void arrive()}>
            Arrive from another device
          </button>
        </div>
        {arriving && Arrive && (
          <Arrive
            next="replace"
            returnFocus={() => arriveButton.current}
            onOpened={(plain) => { setArriving(false); void restoreText(plain) }}
            onClose={(message) => { setArriving(false); setNote(message) }}
          />
        )}
        {sealedChoice !== undefined && (
          <ProtectedRestore
            text={sealedChoice}
            next="replace"
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
        <div className="safe-mode-fresh">
          {!confirmFresh ? (
            <button
              className="text-button danger-text"
              onClick={() => setConfirmFresh(true)}
            >
              Start a new garden instead…
            </button>
          ) : (
            <div className="delete-confirmation" role="alert">
              <strong>
                {downloaded
                  ? 'This deletes everything stored here and starts a new garden.'
                  : 'Download what is stored first. Starting again deletes everything stored here.'}
              </strong>
              <div className="form-actions">
                <button
                  className="danger-button"
                  disabled={!downloaded}
                  onClick={() => void startFresh()}
                >
                  Delete and start again
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setConfirmFresh(false)}
                >
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
