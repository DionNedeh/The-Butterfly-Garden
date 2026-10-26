import { useState } from 'react'
import {
  gardenRepository,
  inspectImportedState,
} from '../repository/gardenRepository'
import { datedFileName, saveTextFile } from '../lib/download'

/** Largest backup file read into memory, in bytes. */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024

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

  const downloadStored = async () => {
    setNote(undefined)
    try {
      const raw = await gardenRepository.readRaw()
      const outcome = await saveTextFile(
        datedFileName('everything-stored'),
        'application/json',
        JSON.stringify(raw, null, 2),
      )
      if (outcome === 'cancelled') {
        setNote('Nothing was saved.')
        return
      }
      setDownloaded(true)
      setNote(
        outcome === 'saved'
          ? 'Saved. Keep this file: it holds everything this app had stored, and can be restored later.'
          : 'Download started. Keep this file: it holds everything this app had stored, and can be restored later.',
      )
    } catch {
      setNote('What is stored could not be read just now.')
    }
  }

  const restore = async (file: File) => {
    setNote(undefined)
    if (file.size > MAX_BACKUP_BYTES) {
      setNote('That file is too large to be a garden backup.')
      return
    }
    try {
      const inspection = inspectImportedState(JSON.parse(await file.text()))
      if (!inspection.state) {
        setNote(
          `That backup could not be restored. ${inspection.refused ?? ''}`,
        )
        return
      }
      if (inspection.state.customBackdrops.length) {
        const { verifyBackdropImages } = await import('../lib/imageImport')
        await verifyBackdropImages(inspection.state.customBackdrops)
      }
      await gardenRepository.replace(inspection.state, { snapshot: true })
      window.location.reload()
    } catch (problem) {
      setNote(
        problem instanceof Error && problem.message
          ? problem.message
          : 'That file is not a garden backup.',
      )
    }
  }

  const startFresh = async () => {
    try {
      await gardenRepository.clear()
      window.location.reload()
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
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
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
