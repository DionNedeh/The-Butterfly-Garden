import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import {
  addPasskey,
  changePasscode,
  checkPasscode,
  replaceRecoveryCode,
  turnLockOff,
} from '../../lib/gardenLockActions'
import { NO_WAY_BACK, passcodeProblem, WrongSecretError } from '../../lib/gardenLock'
import { makePasskey } from '../../lib/passkey'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { LockDialog } from './LockDialog'
import { ConfirmWords, RecoverySheet } from './RecoverySheet'
import './lock.css'

/** What can be changed about the lock while the garden is open. */
export type LockChangeKind = 'passcode' | 'recovery' | 'off' | 'passkey'

const WRONG_PASSCODE = 'That isn’t your current passcode.'

function problemOf(error: unknown, otherwise: string): string {
  return error instanceof WrongSecretError
    ? WRONG_PASSCODE
    : `${otherwise} ${error instanceof Error && error.message ? error.message : ''}`.trim()
}

/** A passcode field, the one every change asks for first. */
function CurrentPasscode({
  value,
  onChange,
  busy,
  label = 'Your passcode',
  field,
}: {
  value: string
  onChange: (value: string) => void
  busy: boolean
  label?: string
  field: RefObject<HTMLInputElement | null>
}) {
  return (
    <label>
      {label}
      <input
        ref={field}
        type="password"
        autoComplete="current-password"
        value={value}
        readOnly={busy}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function Feedback({ busy, working, problem }: { busy: boolean; working: string; problem?: string }) {
  return (
    <>
      <p className="lock-progress" role="status">
        {busy ? working : ''}
      </p>
      {problem && (
        <p className="settings-note error" role="alert">
          {problem}
        </p>
      )}
    </>
  )
}

function Done({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <>
      {children}
      <div className="form-actions">
        <button className="primary-button" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  )
}

/** Change the passcode: the data key is wrapped again; nothing stored changes. */
function ChangePasscode({ onClose }: { onClose: () => void }) {
  const ids = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [done, setDone] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const why = current ? passcodeProblem(next, again) : 'Type your current passcode.'
    if (why) {
      setProblem(why)
      return
    }
    setBusy(true)
    setProblem(undefined)
    try {
      await changePasscode(current, next)
      setDone(true)
    } catch (error) {
      setProblem(problemOf(error, 'Your passcode could not be changed, so the old one still stands.'))
      field.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <LockDialog
      eyebrow="The garden lock"
      title={done ? 'Your passcode is changed' : 'Change my passcode'}
      busy={busy}
      onClose={onClose}
    >
      {done ? (
        <Done onClose={onClose}>
          <p>From now on the garden opens with your new passcode. Your recovery code still works as before.</p>
        </Done>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <CurrentPasscode field={field} value={current} onChange={setCurrent} busy={busy} label="Current passcode" />
          <label>
            New passcode
            <input
              type="password"
              autoComplete="new-password"
              value={next}
              readOnly={busy}
              aria-describedby={`${ids}-hint`}
              onChange={(event) => setNext(event.target.value)}
            />
          </label>
          <p className="field-hint" id={`${ids}-hint`}>
            At least 6 characters. A longer passphrase is stronger.
          </p>
          <label>
            The new passcode again
            <input
              type="password"
              autoComplete="new-password"
              value={again}
              readOnly={busy}
              onChange={(event) => setAgain(event.target.value)}
            />
          </label>
          <Feedback busy={busy} working="Changing your passcode… this takes a moment." problem={problem} />
          <div className="form-actions">
            <button className="primary-button" type="submit" aria-disabled={busy}>
              Change my passcode
            </button>
            <button className="text-button" type="button" aria-disabled={busy} onClick={() => !busy && onClose()}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </LockDialog>
  )
}

type RecoveryStep = 'passcode' | 'sheet' | 'confirm' | 'done'

/** A new recovery code: the old one stops working the moment the new one is stored. */
function NewRecoveryCode({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<RecoveryStep>('passcode')
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [words] = useState(newRecoveryCode)
  const [madeOn] = useState(() => new Date())
  const field = useRef<HTMLInputElement>(null)

  const prove = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!passcode) {
      setProblem('Type your passcode.')
      return
    }
    setBusy(true)
    setProblem(undefined)
    try {
      await checkPasscode(passcode)
      setStep('sheet')
    } catch (error) {
      setProblem(problemOf(error, 'Your passcode could not be checked just now.'))
      field.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const replace = async () => {
    setBusy(true)
    setProblem(undefined)
    try {
      await replaceRecoveryCode(passcode, words)
      setPasscode('')
      setStep('done')
    } catch (error) {
      setProblem(problemOf(error, 'The new code could not be saved, so your old code still works.'))
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<RecoveryStep, string> = {
    passcode: 'Make a new recovery code',
    sheet: 'Save your new recovery code',
    confirm: 'Check two words',
    done: 'Your new recovery code is in place',
  }

  return (
    <LockDialog eyebrow="The garden lock" title={titles[step]} busy={busy} onClose={onClose}>
      {step === 'passcode' && (
        <form onSubmit={(event) => void prove(event)} noValidate>
          <p>
            A new code replaces the one you have. As soon as it is saved, your old recovery
            code stops working, so keep only the new sheet.
          </p>
          <CurrentPasscode field={field} value={passcode} onChange={setPasscode} busy={busy} />
          <Feedback busy={busy} working="Checking your passcode… this takes a moment." problem={problem} />
          <div className="form-actions">
            <button className="primary-button" type="submit" aria-disabled={busy}>
              Next: the new code
            </button>
            <button className="text-button" type="button" aria-disabled={busy} onClick={() => !busy && onClose()}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {step === 'sheet' && (
        <>
          <p>Write these 24 words down, print them or save the sheet, and keep it somewhere private.</p>
          <RecoverySheet words={words} madeOn={madeOn} />
          <p className="lock-warning">{NO_WAY_BACK}</p>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={() => setStep('confirm')}>
              I have kept the words
            </button>
            <button className="text-button" type="button" onClick={onClose}>
              Cancel, keep my old code
            </button>
          </div>
        </>
      )}
      {step === 'confirm' && (
        <>
          <ConfirmWords
            words={words}
            busy={busy}
            submitLabel="Use the new code"
            onConfirmed={() => void replace()}
            onBack={() => setStep('sheet')}
          />
          <Feedback busy={busy} working="Saving your new code… this takes a moment." problem={problem} />
        </>
      )}
      {step === 'done' && (
        <Done onClose={onClose}>
          <p>Your old recovery code no longer opens the garden; you can destroy that sheet.</p>
        </Done>
      )}
    </LockDialog>
  )
}

/** Turn the lock off: everything stored is opened back into the clear, at once. */
function TurnLockOff({ onClose }: { onClose: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [done, setDone] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!passcode) {
      setProblem('Type your passcode.')
      return
    }
    setBusy(true)
    setProblem(undefined)
    try {
      await turnLockOff(passcode)
      setDone(true)
    } catch (error) {
      setProblem(problemOf(error, 'The lock could not be turned off, so it is still on.'))
      field.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <LockDialog
      eyebrow="The garden lock"
      title={done ? 'The lock is off' : 'Turn the lock off'}
      busy={busy}
      onClose={onClose}
    >
      {done ? (
        <Done onClose={onClose}>
          <p>Your garden opens without a passcode now, and your old passcode and recovery code are no longer needed.</p>
        </Done>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <p>
            Your garden will be stored on this device unsealed again, as it was before the
            lock, and anyone using this device could read it.
          </p>
          <CurrentPasscode field={field} value={passcode} onChange={setPasscode} busy={busy} />
          <Feedback busy={busy} working="Unsealing your garden… this takes a moment." problem={problem} />
          <div className="form-actions">
            <button className="danger-button" type="submit" aria-disabled={busy}>
              Turn the lock off
            </button>
            <button className="text-button" type="button" aria-disabled={busy} onClick={() => !busy && onClose()}>
              Keep it locked
            </button>
          </div>
        </form>
      )}
    </LockDialog>
  )
}

/** A passkey as a faster way in, where the device's passkeys can give one. */
function AddPasskey({ onClose }: { onClose: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [done, setDone] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!passcode) {
      setProblem('Type your passcode.')
      return
    }
    setBusy(true)
    setProblem(undefined)
    try {
      // Proved first, so no passkey is made for a passcode that is wrong.
      await checkPasscode(passcode)
      const made = await makePasskey()
      if (made.ok) {
        await addPasskey(passcode, made)
        setDone(true)
      } else if (made.reason === 'no-prf') {
        setProblem(
          'This device’s passkeys can’t open the garden, so nothing was added. You can remove the passkey it just made in your device’s passkey settings.',
        )
      }
    } catch (error) {
      setProblem(problemOf(error, 'The passkey could not be added.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <LockDialog
      eyebrow="The garden lock"
      title={done ? 'Your passkey can open the garden' : 'Add a passkey'}
      busy={busy}
      onClose={onClose}
    >
      {done ? (
        <Done onClose={onClose}>
          <p>Choose “Unlock with a passkey” on the lock screen. Your passcode and recovery code still work too.</p>
        </Done>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <p>
            A passkey opens the garden with this device’s fingerprint, face or screen lock,
            as well as your passcode.
          </p>
          <CurrentPasscode field={field} value={passcode} onChange={setPasscode} busy={busy} />
          <Feedback busy={busy} working="Checking your passcode… then your device will ask." problem={problem} />
          <div className="form-actions">
            <button className="primary-button" type="submit" aria-disabled={busy}>
              Add a passkey
            </button>
            <button className="text-button" type="button" aria-disabled={busy} onClick={() => !busy && onClose()}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </LockDialog>
  )
}

/** One change to the lock, in its dialog. */
export function LockChange({ kind, onClose }: { kind: LockChangeKind; onClose: () => void }) {
  switch (kind) {
    case 'passcode':
      return <ChangePasscode onClose={onClose} />
    case 'recovery':
      return <NewRecoveryCode onClose={onClose} />
    case 'off':
      return <TurnLockOff onClose={onClose} />
    case 'passkey':
      return <AddPasskey onClose={onClose} />
  }
}
