import { lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useLockState } from '../../hooks/useLockState'
import type { AutoLockMinutes, LockRecord } from '../../lib/gardenLock'
import type { LockChangeKind } from './LockChange'
import './lock.css'

// The flows, and the code that seals, load only when one is opened.
const LockSetup = lazy(() => import('./LockSetup').then((m) => ({ default: m.LockSetup })))
const LockChange = lazy(() => import('./LockChange').then((m) => ({ default: m.LockChange })))

/** The lock's actions, loaded once the lock is on or is being used. */
const actions = () => import('../../lib/gardenLockActions')

const AUTO_LOCK_LABELS: ReadonlyArray<[AutoLockMinutes | undefined, string]> = [
  [undefined, 'Never'],
  [1, 'After 1 minute out of sight'],
  [5, 'After 5 minutes out of sight'],
  [15, 'After 15 minutes out of sight'],
  [60, 'After an hour out of sight'],
]

/** The auto-lock as the lock's actions know it, once they have loaded. */
function useAutoLock(on: boolean) {
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof actions>>>()
  useEffect(() => {
    if (!on) return
    let active = true
    void actions().then(async (module) => {
      await module.loadAutoLock().catch(() => undefined)
      if (active) setLoaded(module)
    })
    return () => {
      active = false
    }
  }, [on])
  const minutes = useSyncExternalStore(
    (listener) => loaded?.onAutoLockChange(listener) ?? (() => undefined),
    () => loaded?.autoLockMinutes(),
  )
  return { ready: Boolean(loaded), minutes }
}

/**
 * Settings → Privacy → the garden lock: turn it on, and while it is on and
 * open here, lock now, choose when it locks itself, change its passcode or
 * recovery code, add a passkey, or turn it off. The small print says plainly
 * what it does not protect against.
 */
export function LockSettings() {
  const ids = useId()
  const lock = useLockState()
  const on = lock === 'unlocked'
  const [open, setOpen] = useState<'setup' | LockChangeKind>()
  const [note, setNote] = useState<string>()
  const [passkey, setPasskey] = useState<{ offered: boolean; stored?: LockRecord['passkey'] }>({
    offered: false,
  })
  const heading = useRef<HTMLHeadingElement>(null)
  const autoLock = useAutoLock(on)
  const android = import.meta.env.VITE_PLATFORM === 'android'

  // Whether a passkey can be offered here, and whether there is one: asked
  // only once the lock is on, and again after a change.
  useEffect(() => {
    if (!on || open) return
    let active = true
    void Promise.all([import('../../lib/passkey'), actions()])
      .then(async ([{ passkeysOffered }, { passkeyOf }]) => {
        const [offered, stored] = await Promise.all([passkeysOffered(), passkeyOf()])
        if (active) setPasskey({ offered, stored })
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [on, open])

  const close = () => {
    setOpen(undefined)
    heading.current?.focus()
  }

  const lockNow = async () => {
    setNote(undefined)
    await (await actions()).lockGarden(true)
  }

  const chooseAutoLock = async (value: string) => {
    setNote(undefined)
    const minutes = value ? (Number(value) as AutoLockMinutes) : undefined
    try {
      await (await actions()).chooseAutoLock(minutes)
      setNote(minutes ? 'Saved. The garden will lock itself after that long out of sight.' : 'Saved. The garden will stay open here until you lock it.')
    } catch {
      setNote('That could not be saved just now.')
    }
  }

  const removePasskey = async () => {
    // The garden is sealed again under a key the passkey does not open.
    setNote('Removing the passkey… this can take a few seconds.')
    try {
      const lock = await actions()
      await lock.removePasskey(() => setNote(lock.WAITING_FOR_WINDOWS))
      setPasskey((current) => ({ ...current, stored: undefined }))
      setNote('The passkey no longer opens the garden.')
      // Its button is gone; focus stays in the lock's section.
      heading.current?.focus()
    } catch {
      setNote('The passkey could not be removed just now.')
    }
  }

  return (
    <section className="lock-settings" aria-labelledby={`${ids}-title`}>
      <h3 id={`${ids}-title`} ref={heading} tabIndex={-1}>
        The garden lock
      </h3>
      {on ? (
        <>
          <p>
            The lock is on: your garden is stored sealed here, and it opens with your
            passcode. It is open in this tab now.
          </p>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => void lockNow()}>
              Lock now
            </button>
          </div>
          {autoLock.ready && (
            <>
              <label>
                Lock by itself
                <select
                  value={autoLock.minutes ?? ''}
                  aria-describedby={`${ids}-auto-lock`}
                  onChange={(event) => void chooseAutoLock(event.target.value)}
                >
                  {AUTO_LOCK_LABELS.map(([minutes, label]) => (
                    <option key={label} value={minutes ?? ''}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {/* What it waits for: components/lock/LockWatch. */}
              <p className="field-hint" id={`${ids}-auto-lock`}>
                It waits while you are choosing a photo or a file, or have a sighting, a goal or a
                garden image open to edit, so nothing you are part-way through is lost.
              </p>
            </>
          )}
          <div className="form-actions">
            <button className="text-button" type="button" onClick={() => setOpen('passcode')}>
              Change my passcode…
            </button>
            <button className="text-button" type="button" onClick={() => setOpen('recovery')}>
              Make a new recovery code…
            </button>
            {passkey.offered && !passkey.stored && (
              <button className="text-button" type="button" onClick={() => setOpen('passkey')}>
                Add a passkey…
              </button>
            )}
            {passkey.stored && (
              <button className="text-button" type="button" onClick={() => void removePasskey()}>
                Remove the passkey
              </button>
            )}
            <button className="text-button danger-text" type="button" onClick={() => setOpen('off')}>
              Turn the lock off…
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Lock your journal on this device. With the lock on, your garden is stored sealed
            here, and it opens only with your passcode.
          </p>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setOpen('setup')}>
              Lock my garden…
            </button>
          </div>
        </>
      )}
      {note && (
        <p className="settings-note" role="status">
          {note}
        </p>
      )}
      <p className="lock-small-print">
        {android
          ? 'The lock keeps what the garden stores on this phone sealed, so on a lost or shared phone your journal can’t be read without your passcode or recovery code. It can’t protect the garden while it is open, from someone using the phone then, or from software that already controls this phone. Backups you save are not locked. Each time the lock is turned on or changed, the garden is stored afresh and its old copy deleted; like any deleted file, traces of it can stay on the phone’s storage until that space is used again.'
          : 'The lock keeps what the garden stores in this browser sealed, so on a shared, lost or borrowed device your journal can’t be read without your passcode or recovery code. It can’t protect the garden while it is open, from someone using the device then, or from other code running at the same web address as the garden. Backups you download are not locked. Each time the lock is turned on or changed, the garden is stored afresh and its old copy deleted; like any deleted file, traces of it can stay on the device’s disk until that space is used again.'}
      </p>
      {open && (
        <Suspense fallback={null}>
          {open === 'setup' ? <LockSetup onClose={close} /> : <LockChange kind={open} onClose={close} />}
        </Suspense>
      )}
    </section>
  )
}
