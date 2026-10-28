import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { LockSecret } from '../../lib/gardenLock'
import { openLockedCopy, readLockedCopy, type LockedCopyProblem } from '../../lib/lockedCopy'
import type { ProtectedRestoreProps } from './ProtectedRestore'
import { useModal } from './useModal'
import { useProblem } from './useProblem'
import { whatFollows } from './whatFollows'
import './backup.css'

/** Why a locked copy cannot be opened at all, before any passcode. */
const UNOPENABLE: Record<LockedCopyProblem, string> = {
  newer:
    'Its lock was made by a newer version of the garden, in a form this version cannot open. Update the app, then choose it again.',
  damaged:
    'It is damaged or incomplete, so it cannot be opened with any passcode or recovery code. Nothing has been changed.',
}

/** Said when the secret was right but a part of the copy will not open. */
const DAMAGED_INSIDE =
  'That opened the copy’s lock, but part of the copy is damaged, so it cannot be restored. Nothing has been changed.'

/**
 * What becomes of the lock, which never comes back with the garden: a
 * restore is kept under the lock of the garden it replaces, or none, and
 * where nothing is stored yet there is none.
 */
const LOCK_AFTER: Record<ProtectedRestoreProps['next'], string> = {
  preview: 'The garden comes back without its old lock, under this garden’s lock if it has one.',
  replace: 'The garden comes back without its old lock, under this garden’s lock if it has one.',
  arrive: 'The garden comes back without its lock; turn the lock on again in Settings if you want it.',
}

/**
 * Safe mode's copy of a garden that had the lock on ("Download what's
 * stored"), opened with that garden's passcode or its recovery code, in a
 * modal dialog, before anything is restored (lib/lockedCopy).
 *
 * The passcode is asked for first, as the lock screen asks; the recovery
 * code is one tap away, in a field that takes its 24 words however they
 * are pasted. A wrong one is told only that it is wrong. Opening runs the
 * lock's slow key derivation, so it says that it is working. What opens is
 * the text of a plain backup of the garden, which goes on to the usual
 * restore; nothing is replaced here, whatever happens.
 *
 * Escape and Android's back gesture put it away (through its cancel event;
 * see lib/backNavigation), except while it is opening the copy.
 */
export function LockedCopyPrompt({ text, next, onOpened, onClose, returnFocus }: ProtectedRestoreProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const ids = useId()
  // Checked once, without any secret: a copy that could never open says so
  // before anyone types anything.
  const [read] = useState(() => readLockedCopy(text))
  const [slot, setSlot] = useState<LockSecret['slot']>('passcode')
  const [passcode, setPasscode] = useState('')
  const [code, setCode] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, say] = useProblem()
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const shut = useModal(dialog, heading, () => onClose(), returnFocus)

  // A field changed by choice takes focus; the first one waits behind the heading.
  const switched = useRef(false)
  useEffect(() => {
    if (switched.current) field.current?.focus()
  }, [slot])

  const close = () => {
    if (!busy && shut()) onClose()
  }

  const turnTo = (other: LockSecret['slot']) => {
    if (busy) return
    say('')
    switched.current = true
    setSlot(other)
  }

  const again = (words: string) => {
    say(words)
    field.current?.focus()
    field.current?.select()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !read.ok) return
    say('')
    let given: LockSecret
    if (slot === 'passcode') {
      if (!passcode) {
        again('Enter the passcode of the garden this copy was made from.')
        return
      }
      given = { slot, passcode }
    } else {
      // The word list loads only for a recovery code, as on the lock screen.
      let reading: Awaited<typeof import('../../lib/recoveryCode')>['readRecoveryCode']
      try {
        reading = (await import('../../lib/recoveryCode')).readRecoveryCode
      } catch {
        if (live.current) again('This browser could not open the copy just now. Please try again.')
        return
      }
      if (!live.current) return
      const words = reading(code)
      if (!words.ok) {
        again(words.problem)
        return
      }
      given = { slot, words: words.words }
    }
    setBusy(true)
    let opened: Awaited<ReturnType<typeof openLockedCopy>>
    try {
      opened = await openLockedCopy(read.copy, given)
    } catch {
      if (!live.current) return
      setBusy(false)
      again('This browser could not open the copy just now. Please try again.')
      return
    }
    if (!live.current) return
    setBusy(false)
    if (opened.ok) {
      setPasscode('')
      setCode('')
      if (shut()) onOpened(opened.text, 'lock')
    } else if (opened.problem === 'damaged') {
      if (shut()) onClose(DAMAGED_INSIDE)
    } else {
      again(
        slot === 'passcode'
          ? 'That passcode does not open this copy. It needs the passcode the garden had when the copy was made.'
          : 'Those words do not open this copy. Check them against your recovery sheet, in order.',
      )
    }
  }

  const status = (
    <p className="protected-progress" role="status">
      {busy ? 'Opening the copy… this can take a few seconds.' : ''}
    </p>
  )

  return (
    <dialog
      ref={dialog}
      className="garden-dialog protected-dialog"
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-about`}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      {read.ok ? (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <p className="eyebrow">Restore a backup</p>
          <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
            This copy is locked
          </h2>
          <p id={`${ids}-about`}>
            It is a sealed copy of everything a locked garden had stored. It
            opens with the passcode or recovery code that garden had when the
            copy was made, used only here and not kept. {whatFollows(next, 'copy')}{' '}
            {LOCK_AFTER[next]}
          </p>
          {slot === 'passcode' ? (
            <>
              <label>
                Passcode
                <input
                  ref={field}
                  type={shown ? 'text' : 'password'}
                  value={passcode}
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  readOnly={busy}
                  aria-invalid={problem.text ? true : undefined}
                  onChange={(event) => setPasscode(event.target.value)}
                />
              </label>
              <label className="protected-show">
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={(event) => setShown(event.target.checked)}
                />
                Show passcode
              </label>
            </>
          ) : (
            <label>
              Recovery code
              <textarea
                ref={field}
                rows={4}
                value={code}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                readOnly={busy}
                aria-invalid={problem.text ? true : undefined}
                aria-describedby={`${ids}-words`}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
          )}
          {slot === 'recovery' && (
            <p id={`${ids}-words`} className="subtle-copy">
              The 24 words from the recovery sheet, in order.
            </p>
          )}
          {status}
          <p key={problem.said} className="settings-note error protected-problem" role="alert">
            {problem.text}
          </p>
          <div className="form-actions">
            <button className="primary-button" type="submit" aria-disabled={busy}>
              Open the copy
            </button>
            <button
              className="text-button"
              type="button"
              aria-disabled={busy}
              onClick={() => turnTo(slot === 'passcode' ? 'recovery' : 'passcode')}
            >
              {slot === 'passcode' ? 'Use the recovery code instead' : 'Use the passcode instead'}
            </button>
            <button className="secondary-button" type="button" aria-disabled={busy} onClick={() => close()}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="eyebrow">Restore a backup</p>
          <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
            This locked copy cannot be opened
          </h2>
          <p id={`${ids}-about`}>{UNOPENABLE[read.problem]}</p>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => close()}>
              Close
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
