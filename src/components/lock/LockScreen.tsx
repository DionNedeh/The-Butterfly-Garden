import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { SYNC_CHANNEL } from '../../hooks/usePersistence'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import {
  openWithKey,
  passkeyOf,
  replaceForgottenPasscode,
  unlockGarden,
  unlockWithPasskey,
} from '../../lib/gardenLockActions'
import { openLock, passcodeProblem, WrongSecretError, type LockRecord } from '../../lib/gardenLock'
import { leaveApp, onBackButton, setSystemBarsForTheme } from '../../lib/native'
import { askPasskey, passkeysOffered } from '../../lib/passkey'
import { gardenRepository, GardenDeletionPendingError } from '../../repository/gardenRepository'
import './lock.css'

type Step = 'passcode' | 'recovery' | 'new-passcode'

/** Said while a key is being derived, which takes a moment on purpose. */
const OPENING = 'Opening your garden… this takes a moment.'

/**
 * The lock screen: the garden is resting, and opens with the passcode, the
 * recovery code or, where one was added, a passkey.
 *
 * A wrong passcode is told only that it did not open the garden. There is no
 * lockout: each try already costs the full key derivation, which is what
 * keeps guessing slow, here and on a copy of the stored garden alike.
 *
 * Shown in the device's own light or dark, since the garden's theme is part
 * of what the lock keeps sealed, with the Android app's system bars to match
 * (the garden sets its own again once it is open); and at the usual text
 * size, for the same reason. Android's back gesture leaves the app from here.
 */
export function LockScreen() {
  const ids = useId()
  const night = useMediaQuery('(prefers-color-scheme: dark)')
  const [step, setStep] = useState<Step>('passcode')
  const [passcode, setPasscode] = useState('')
  const [code, setCode] = useState('')
  const [newPasscode, setNewPasscode] = useState('')
  const [again, setAgain] = useState('')
  /**
   * What the recovery code opened: the lock, its key and the words, kept in
   * memory while a new passcode is chosen, so nothing is derived twice.
   */
  const [recovered, setRecovered] = useState<{
    record: LockRecord
    key: CryptoKey
    words: readonly string[]
  }>()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [passkey, setPasskey] = useState<LockRecord['passkey']>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteNote, setDeleteNote] = useState<string>()
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const keepButton = useRef<HTMLButtonElement>(null)
  /** Asking to delete, or thinking better of it, moves focus to what replaces the button. */
  const deleteAsked = useRef(false)

  useEffect(() => onBackButton(() => void leaveApp()), [])

  useEffect(() => {
    void setSystemBarsForTheme(night)
  }, [night])

  // The button pressed is taken away: focus goes to what stands in its
  // place, the safe choice first. Not on arrival, when nothing was asked.
  useEffect(() => {
    if (!deleteAsked.current) return
    deleteAsked.current = false
    ;(confirmDelete ? keepButton : deleteButton).current?.focus()
  }, [confirmDelete])

  // The lock turned off in another tab: nothing is left to open here, and
  // the garden comes back as it is (components/LockGate).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channel.onmessage = (event: MessageEvent<{ type?: unknown } | undefined>) => {
      if (event.data?.type === 'garden-lock') void gardenRepository.checkLock().catch(() => undefined)
    }
    return () => channel.close()
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([passkeyOf(), passkeysOffered()]).then(
      ([stored, offered]) => {
        if (active && offered) setPasskey(stored)
      },
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [])

  // Each step's field takes focus as the step opens.
  useEffect(() => {
    field.current?.focus()
  }, [step])

  const askToDelete = (asking: boolean) => {
    deleteAsked.current = true
    setConfirmDelete(asking)
  }

  const show = (next: Step) => {
    setProblem(undefined)
    setStep(next)
  }

  const fail = (error: unknown, wrong: string) => {
    setProblem(error instanceof WrongSecretError ? wrong : 'Your garden could not be opened just now. Please try again.')
    field.current?.focus()
    field.current?.select()
  }

  const openWithPasscode = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!passcode) {
      setProblem('Type your passcode.')
      field.current?.focus()
      return
    }
    setBusy(true)
    setProblem(undefined)
    try {
      await unlockGarden({ slot: 'passcode', passcode })
    } catch (error) {
      fail(error, 'That passcode didn’t open your garden. Please try again.')
      setBusy(false)
    }
  }

  const openWithCode = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const { readRecoveryCode } = await import('../../lib/recoveryCode')
    const reading = readRecoveryCode(code)
    if (!reading.ok) {
      setProblem(reading.problem)
      field.current?.focus()
      return
    }
    setBusy(true)
    setProblem(undefined)
    try {
      // Proved first, so a wrong code is said at once rather than after a
      // new passcode has been chosen.
      const record = await gardenRepository.readLock()
      if (!record) {
        // Turned off in another tab: there is nothing left to open.
        await gardenRepository.checkLock()
        return
      }
      const key = await openLock(record, { slot: 'recovery', words: reading.words })
      setRecovered({ record, key, words: reading.words })
      setBusy(false)
      show('new-passcode')
    } catch (error) {
      fail(error, 'Those words didn’t open your garden. Check them against your sheet, in order.')
      setBusy(false)
    }
  }

  const chooseNewPasscode = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !recovered) return
    const why = passcodeProblem(newPasscode, again)
    if (why) {
      setProblem(why)
      field.current?.focus()
      return
    }
    setBusy(true)
    setProblem(undefined)
    try {
      // Sealed under a new key first, then opened with it.
      await replaceForgottenPasscode(recovered.record, recovered.key, recovered.words, newPasscode)
    } catch {
      setProblem('The new passcode couldn’t be saved, so your old one still stands. You can open your garden without changing it.')
      setBusy(false)
    }
  }

  const openWithoutNewPasscode = () => {
    if (busy || !recovered) return
    openWithKey(recovered.record, recovered.key)
  }

  const openWithPasskey = async () => {
    if (busy || !passkey) return
    setBusy(true)
    setProblem(undefined)
    try {
      const answer = await askPasskey(passkey.credentialId, passkey.prfSalt)
      if (answer.ok) {
        await unlockWithPasskey(answer.prfOutput)
        return
      }
      if (answer.reason === 'no-prf') setProblem('That passkey couldn’t open your garden here. Use your passcode instead.')
    } catch (error) {
      setProblem(
        error instanceof WrongSecretError
          ? 'That passkey didn’t open your garden. Use your passcode instead.'
          : 'The passkey couldn’t be used just now. Use your passcode instead.',
      )
    }
    setBusy(false)
  }

  const deleteGarden = async () => {
    setDeleteNote(undefined)
    const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(SYNC_CHANNEL)
    channel?.postMessage({ type: 'garden-clearing' })
    try {
      // Gone, lock and all: the repository then has no lock, and the app
      // opens on a new garden.
      await gardenRepository.clear()
      channel?.postMessage({ type: 'garden-cleared' })
    } catch (error) {
      if (!(error instanceof GardenDeletionPendingError)) channel?.postMessage({ type: 'garden-clear-failed' })
      setDeleteNote(error instanceof Error ? error.message : 'The garden could not be deleted just now.')
    } finally {
      channel?.close()
    }
  }

  const status = busy ? (
    <p className="lock-progress" role="status">
      {step === 'passcode' || step === 'recovery' ? OPENING : 'Saving your new passcode and opening your garden…'}
    </p>
  ) : (
    <p className="lock-progress" role="status" />
  )
  const alert = problem && (
    <p className="settings-note error" role="alert" id={`${ids}-problem`}>
      {problem}
    </p>
  )

  return (
    <main
      className={`safe-mode lock-screen${night ? ' theme-night' : ''}`}
      aria-labelledby={`${ids}-title`}
    >
      <section className="card safe-mode-card lock-card">
        <img
          className="lock-emblem"
          src={`${import.meta.env.BASE_URL}icons/icon-192.webp`}
          alt=""
          width={72}
          height={72}
        />
        <p className="eyebrow">Your garden is locked</p>
        <h1 id={`${ids}-title`}>Your garden is resting</h1>

        {step === 'passcode' && (
          <form className="lock-form" onSubmit={(event) => void openWithPasscode(event)} noValidate>
            <p>Type your passcode to open it.</p>
            <label>
              Passcode
              <input
                ref={field}
                type="password"
                autoComplete="current-password"
                value={passcode}
                readOnly={busy}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `${ids}-problem` : undefined}
                onChange={(event) => setPasscode(event.target.value)}
              />
            </label>
            {alert}
            {status}
            <div className="form-actions">
              <button className="primary-button" type="submit" aria-disabled={busy}>
                Open my garden
              </button>
              {passkey && (
                <button
                  className="secondary-button"
                  type="button"
                  aria-disabled={busy}
                  onClick={() => void openWithPasskey()}
                >
                  Unlock with a passkey
                </button>
              )}
              <button className="text-button" type="button" aria-disabled={busy} onClick={() => !busy && show('recovery')}>
                Use my recovery code
              </button>
            </div>
          </form>
        )}

        {step === 'recovery' && (
          <form className="lock-form" onSubmit={(event) => void openWithCode(event)} noValidate>
            <p>Type the 24 words from your recovery sheet, in order.</p>
            <label>
              Recovery code
              <textarea
                ref={field}
                rows={4}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={code}
                readOnly={busy}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `${ids}-problem` : undefined}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            {alert}
            {status}
            <div className="form-actions">
              <button className="primary-button" type="submit" aria-disabled={busy}>
                Open with my recovery code
              </button>
              <button className="text-button" type="button" aria-disabled={busy} onClick={() => !busy && show('passcode')}>
                Use my passcode instead
              </button>
            </div>
          </form>
        )}

        {step === 'new-passcode' && (
          <form className="lock-form" onSubmit={(event) => void chooseNewPasscode(event)} noValidate>
            <h2>Choose a new passcode</h2>
            <p>
              Your recovery code opened the lock. Choose a passcode you will remember;
              the recovery code keeps working too, so keep the sheet safe.
            </p>
            <label>
              New passcode
              <input
                ref={field}
                type="password"
                autoComplete="new-password"
                value={newPasscode}
                readOnly={busy}
                aria-describedby={`${ids}-passcode-hint`}
                onChange={(event) => setNewPasscode(event.target.value)}
              />
            </label>
            <p className="field-hint" id={`${ids}-passcode-hint`}>
              At least 6 characters. A longer passphrase, a few words only you would put
              together, is stronger.
            </p>
            <label>
              The same passcode again
              <input
                type="password"
                autoComplete="new-password"
                value={again}
                readOnly={busy}
                onChange={(event) => setAgain(event.target.value)}
              />
            </label>
            {alert}
            {status}
            <div className="form-actions">
              <button className="primary-button" type="submit" aria-disabled={busy}>
                Save it and open my garden
              </button>
              <button
                className="text-button"
                type="button"
                aria-disabled={busy}
                onClick={openWithoutNewPasscode}
              >
                Not now, just open my garden
              </button>
            </div>
          </form>
        )}

        <details className="lock-help">
          <summary>I can’t open my garden</summary>
          <p>
            Your recovery sheet opens the garden if the passcode is forgotten: choose
            “Use my recovery code” above.
          </p>
          <p>
            Without the passcode or the recovery code, nobody can open this garden, not
            even the people who made the app. If both are lost, the only way forward is to
            delete it from this device and start a new garden.
          </p>
          {!confirmDelete ? (
            <button ref={deleteButton} className="text-button danger-text" type="button" onClick={() => askToDelete(true)}>
              Delete this garden…
            </button>
          ) : (
            <div className="delete-confirmation" role="alert">
              <strong>
                This deletes the locked garden from this device for good. Nobody can bring
                it back afterwards.
              </strong>
              <div className="form-actions">
                <button className="danger-button" type="button" onClick={() => void deleteGarden()}>
                  Delete it and start again
                </button>
                <button ref={keepButton} className="secondary-button" type="button" onClick={() => askToDelete(false)}>
                  Keep it
                </button>
              </div>
            </div>
          )}
          {deleteNote && (
            <p className="settings-note error" role="alert">
              {deleteNote}
            </p>
          )}
        </details>
      </section>
    </main>
  )
}
