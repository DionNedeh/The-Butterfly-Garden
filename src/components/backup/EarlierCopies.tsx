import { useEffect, useRef, useState } from 'react'
import { formatJournalDate } from '../../lib/date'
import { counted } from '../../lib/plural'
import { formatBytes } from '../../lib/storage'
import type { EarlierCopy } from '../../repository/dailyCopies'
import { gardenRepository } from '../../repository/gardenRepository'
import { datedFileName, saveTextFile } from '../../lib/download'
import './keep.css'

/** The daily copies kept, and the room every copy kept here takes. */
export interface CopiesKept {
  copies: EarlierCopy[]
  bytes: number
}

function heldWords(held: NonNullable<EarlierCopy['held']>): string {
  return `${counted(held.checkIns, 'check-in', 'check-ins')}, ${counted(
    held.reflections,
    'reflection',
    'reflections',
  )} and ${counted(held.goals, 'goal', 'goals')}`
}

/**
 * Settings → Backup and restore → the daily copies kept on this device
 * (repository/dailyCopies): each day, and what it held in a few words. Looking
 * at one opens the usual restore preview (in SettingsView), whose Put back is
 * a restore like any other, with its undo. The words say plainly what these
 * copies are for, and what they cannot do.
 */
export function EarlierCopies({
  onList,
  onLook,
  looking,
  refresh,
  android,
  onMeasured,
}: {
  onList: () => Promise<CopiesKept>
  /** Show this copy in the restore preview. */
  onLook: (copy: EarlierCopy) => void
  /** The copy the preview shows now, if any: focus comes back to it after. */
  looking?: string
  /** Read the copies again when this changes (a restore, an undo). */
  refresh?: unknown
  android: boolean
  /** The room every copy takes, for the storage line. */
  onMeasured?: (bytes: number) => void
}) {
  const [found, setFound] = useState<CopiesKept | 'failed'>()
  const [note, setNote] = useState('')
  const [discard, setDiscard] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [changed, setChanged] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const lastLooked = useRef<string>(undefined)

  useEffect(() => {
    let active = true
    onList().then(
      (list) => {
        if (!active) return
        setFound(list)
        onMeasured?.(list.bytes)
      },
      () => {
        if (active) setFound('failed')
      },
    )
    return () => {
      active = false
    }
  }, [onList, refresh, onMeasured, changed])

  const download = async (id: string) => {
    setBusy(true)
    try {
      const { snapshot: record, lock } = await gardenRepository.snapshotForDownload(id)
      if (!record) throw new Error('That copy is no longer here.')
      const { fileCopy } = await import('../../lib/sightingPhotos')
      const copy = await fileCopy({ format: 'the-butterfly-garden-snapshot',
        exportedAt: new Date().toISOString(), snapshot: record,
        lock }, true)
      const result = await saveTextFile(datedFileName('earlier-copy'), 'application/json', copy.text)
      setNote(result === 'cancelled' ? 'No copy was saved.' : `${result === 'saved' ? 'Copy saved' : 'Download started'} as it is.${copy.leftOut ? ` ${copy.leftOut}` : ''} This is a recovery record; an unreadable copy may still need repair.`)
    } catch (error) { setNote(error instanceof Error ? error.message : 'That copy could not be saved.') }
    finally { setBusy(false) }
  }
  const discardCopy = async (id: string) => {
    setBusy(true)
    try {
      await gardenRepository.discardSnapshot(id)
      setDiscard(undefined)
      setChanged((value) => value + 1)
      setNote('The earlier copy was discarded. Your current garden is unchanged.')
      heading.current?.focus()
    } catch { setNote('The copy could not be discarded. Reload Settings and try again.') }
    finally { setBusy(false) }
  }

  // Back from the preview without putting the copy back: focus returns to
  // the button that opened it, unless something else has taken it.
  useEffect(() => {
    if (looking) {
      lastLooked.current = looking
      return
    }
    const id = lastLooked.current
    lastLooked.current = undefined
    const focused = document.activeElement
    if (id && (!focused || focused === document.body)) buttons.current.get(id)?.focus()
  }, [looking])

  const list = found === 'failed' ? undefined : found
  return (
    <div className="earlier-copies">
      <h3 ref={heading} tabIndex={-1}>Earlier copies on this device</h3>
      <p className="subtle-copy">
        Before the first change you make on a day, the garden keeps a copy of how it
        was: up to seven, one for each day. Put one back to undo a mistake, like a
        wrong delete or restore.{' '}
        {android
          ? 'They live in this app with your garden, so they cannot help if the app is uninstalled or its storage cleared; a backup file can.'
          : 'They live in this browser with your garden, so they cannot help if the browser clears the site’s storage; a backup file can.'}{' '}
        To save room they leave out your field book’s photos, and putting one back
        keeps the photos you have now. The two copies kept before a restore are
        listed here too; those include their photos.
      </p>
      {found === 'failed' && (
        <p className="settings-note">The earlier copies could not be read just now.</p>
      )}
      {list &&
        (list.copies.length > 0 ? (
          <ul className="earlier-copies-list">
            {list.copies.map((copy) => {
              const day = formatJournalDate(copy.day)
              const when = copy.takenAt && !Number.isNaN(Date.parse(copy.takenAt))
                ? `${day}, before a restore at ${new Date(copy.takenAt).toLocaleTimeString()}` : day
              return (
                <li key={copy.id}>
                  <span>
                    <strong>{day}</strong>
                    {copy.reason === 'restore' && <small>Before a restore{copy.gardenName ? `: ${copy.gardenName}` : ''}</small>}
                    {copy.takenAt && !Number.isNaN(Date.parse(copy.takenAt)) && <time dateTime={copy.takenAt}>{new Date(copy.takenAt).toLocaleTimeString()}</time>}
                    <small>
                      {copy.held ? heldWords(copy.held) : 'This copy cannot be opened here.'}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Look at this copy, from ${when}`}
                    disabled={!copy.held}
                    ref={(button) => {
                      if (button) buttons.current.set(copy.id, button)
                      else buttons.current.delete(copy.id)
                    }}
                    onClick={() => onLook(copy)}
                  >
                    Look at this copy
                  </button>
                  <button className="text-button" type="button" disabled={busy}
                    aria-label={`Download copy as it is, from ${when}`} onClick={() => void download(copy.id)}>
                    Download as it is
                  </button>
                  <button className="text-button danger-text" type="button" disabled={busy}
                    aria-label={`Discard copy, from ${when}`} onClick={() => setDiscard(copy.id)}>
                    Discard…
                  </button>
                  {discard === copy.id && <div className="delete-confirmation" role="alert">
                    <p>Discard this earlier copy? It cannot be undone. Your current garden stays as it is.</p>
                    <button className="danger-button" type="button" disabled={busy} onClick={() => void discardCopy(copy.id)}>Discard this copy</button>
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => setDiscard(undefined)}>Keep it</button>
                  </div>}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="settings-note">
            None yet: one is kept before the first change you make on a day.
          </p>
        ))}
      {android && list && list.bytes > 0 && (
        <p className="settings-note">
          The copies kept in this app take about {formatBytes(list.bytes)}.
        </p>
      )}
      {note && <p className="settings-note" role="status">{note}</p>}
    </div>
  )
}
