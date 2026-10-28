import { useState } from 'react'
import { datedFileName, saveTextFile } from '../lib/download'
import { arrivalUrl } from '../lib/hosting'
import type { FileCopy } from '../lib/sightingPhotos'

/**
 * Shown only by the old address's final build (lib/hosting): the garden has
 * moved, and this is how to bring it along. Saving comes first and opening
 * the new address second, as two taps, so nobody arrives there before their
 * backup exists, and no popup blocker can swallow the new tab.
 */
export function MovedBanner({
  target,
  onExportGarden,
}: {
  target: URL
  /** The backup's text, at once or once its photos are read. */
  onExportGarden: () => FileCopy | undefined | Promise<FileCopy | undefined>
}) {
  const [saved, setSaved] = useState(false)
  const [note, setNote] = useState<string>()

  const save = async () => {
    setNote(undefined)
    let copy: FileCopy | undefined
    try {
      // Making the file reads every photo from storage, which can fail.
      copy = await onExportGarden()
    } catch {
      setNote('Your garden could not be put into a file just now. Please try again.')
      return
    }
    if (!copy) {
      setNote(
        'This garden cannot be saved just now. Settings can download the copy that was set aside.',
      )
      return
    }
    try {
      const outcome = await saveTextFile(
        datedFileName('garden-backup'),
        'application/json',
        copy.text,
      )
      if (outcome === 'cancelled') {
        setNote('Nothing was saved. Your garden is still here.')
        return
      }
      setSaved(true)
      setNote(copy.leftOut)
    } catch {
      setNote('The backup could not be saved there. Please try again.')
    }
  }

  return (
    <section className="moved-banner" aria-labelledby="moved-title">
      <h2 id="moved-title">The garden has a new home</h2>
      <p>
        It now lives at <strong>{target.host}</strong>. Your garden is kept by
        this browser at this address, so it does not move by itself: save it to
        a file, then open the new address and choose “I have a backup”.
      </p>
      <div className="form-actions">
        <button className="primary-button" onClick={() => void save()}>
          {saved ? 'Save my garden again' : 'Save my garden to a file'}
        </button>
        {saved && (
          <a
            className="secondary-button"
            href={arrivalUrl(target)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open {target.host}
          </a>
        )}
      </div>
      {note && (
        <p className="settings-note" role="status">
          {note}
        </p>
      )}
      {saved && (
        <p className="settings-note" role="status">
          Saved. Nothing here is deleted, so your garden stays at this address
          too until you are happy with the new one.
        </p>
      )}
    </section>
  )
}
