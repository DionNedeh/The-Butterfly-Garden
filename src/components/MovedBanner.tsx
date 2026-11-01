import { useState } from 'react'
import { useLockState } from '../hooks/useLockState'
import type { PersistenceStatus } from '../hooks/usePersistence'
import { datedFileName, saveTextFile } from '../lib/download'
import { arrivalUrl } from '../lib/hosting'
import type { FileCopy } from '../lib/sightingPhotos'
import {
  COLLECTION_STORES,
  GARDEN_COLLECTIONS,
  gardenRepository,
  type LockState,
} from '../repository/gardenRepository'

/** Whether the garden here has a lock, open in this tab or not. */
function isLockOn(lock: LockState): boolean {
  return lock === 'locked' || lock === 'unlocked'
}

/**
 * The stores a copy of a locked garden is opened from at the new address
 * (lib/lockedCopy): the lock's record and the garden's own parts. What else
 * is stored (restore and daily copies, drafts, a set-aside copy) is never
 * restored from such a copy, and each restore copy is a whole garden with
 * its photos: carried too, they could make the file larger than a restore
 * takes (lib/backupFile's MAX_BACKUP_BYTES).
 */
const GARDEN_STORES = new Set<string>([
  'lock',
  'meta',
  ...GARDEN_COLLECTIONS.map((collection) => COLLECTION_STORES[collection]),
])

const CANNOT_SAVE =
  'This garden cannot be saved just now. Settings can download the copy that was set aside.'

/**
 * A garden with the lock on, as a file: the garden sealed as it is stored,
 * the lock's record with it, once every write already asked for is on disk.
 * It opens again only with the lock's passcode or recovery code
 * (lib/lockedCopy), which onboarding's "I have a backup" asks for at the new
 * address. A plain backup would leave the journal in the clear in a
 * downloads folder, which is what the lock is for.
 *
 * In the form of the copy safe mode saves (lib/storedCopy), made from the
 * same two parts here rather than through it, and of the garden's own
 * stores alone: that module loads with the app's last-resort screens, and
 * reaching it from this page would cost every first load an export.
 */
async function lockedCopy(): Promise<FileCopy> {
  await gardenRepository.settled()
  const [raw, { fileCopy }] = await Promise.all([
    gardenRepository.readRaw(),
    import('../lib/sightingPhotos'),
  ])
  const stores = Object.entries(raw.stores as Record<string, unknown>).filter(([name]) =>
    GARDEN_STORES.has(name),
  )
  return fileCopy({ ...raw, stores: Object.fromEntries(stores) }, true)
}

/**
 * Shown only by the old address's final build (lib/hosting): the garden has
 * moved, and this is how to bring it along. Saving comes first and opening
 * the new address second, as two taps, so nobody arrives there before their
 * backup exists, and no popup blocker can swallow the new tab.
 *
 * With the garden lock on, what is saved is the garden sealed with its lock
 * (`lockedCopy`), never the plain backup `onExportGarden` makes. That file
 * is made from what is stored, so it is refused while the latest change is
 * not: the plain backup comes from this tab, which still holds it. The lock
 * does not move with it: a restored garden arrives unlocked, and a passkey
 * belongs to the address it was made at, so both are set up again there.
 */
export function MovedBanner({
  target,
  onExportGarden,
  persistence,
}: {
  target: URL
  /** The backup's text, at once or once its photos are read. */
  onExportGarden: () => FileCopy | undefined | Promise<FileCopy | undefined>
  /** Whether saving is paused, and why the latest write failed, if it did. */
  persistence?: Pick<PersistenceStatus, 'readOnly' | 'writeError'>
}) {
  const [saved, setSaved] = useState(false)
  const [note, setNote] = useState<string>()
  const lockOn = isLockOn(useLockState())

  const save = async () => {
    setNote(undefined)
    if (persistence?.readOnly) {
      setNote(CANNOT_SAVE)
      return
    }
    if (lockOn && persistence?.writeError) {
      setNote(
        'Your latest change is not stored on this device yet, so the sealed file would leave it out. Nothing was saved. Try again once your changes save again, or save a protected backup in Settings: it is made from what this tab holds, and opens with a passphrase you choose.',
      )
      return
    }
    let copy: FileCopy | undefined
    try {
      // Making the file reads every photo from storage, which can fail.
      // The lock as this tab knows it decides: a tab holds a garden only
      // once it has read the lock along with it, and follows every change.
      copy = lockOn ? await lockedCopy() : await onExportGarden()
    } catch {
      setNote('Your garden could not be put into a file just now. Please try again.')
      return
    }
    if (!copy) {
      setNote(CANNOT_SAVE)
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
      {lockOn && (
        <p>
          Your garden is locked, so the file stays sealed with your lock and
          opens there with your passcode or recovery code. The lock does not
          move with it: turn it on again in Settings at the new address, and
          add your passkey again if you use one, as a passkey works only at
          the address where it was made.
        </p>
      )}
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
