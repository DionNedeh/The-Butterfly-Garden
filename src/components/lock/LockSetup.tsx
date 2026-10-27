import { useId, useRef, useState, type FormEvent } from 'react'
import { turnLockOn } from '../../lib/gardenLockActions'
import { MIN_PASSCODE_LENGTH, NO_WAY_BACK, passcodeProblem } from '../../lib/gardenLock'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { LockDialog } from './LockDialog'
import { ConfirmWords, RecoverySheet } from './RecoverySheet'
import './lock.css'

type Step = 'passcode' | 'sheet' | 'confirm' | 'done'

const TITLES: Record<Step, string> = {
  passcode: 'Choose a passcode',
  sheet: 'Save your recovery code',
  confirm: 'Check two words',
  done: 'Your garden is locked',
}

/**
 * Settings → Privacy → Lock my garden: choose a passcode, save the recovery
 * code, confirm two of its words, and only then does the lock turn on,
 * sealing everything stored here at once.
 */
export function LockSetup({ onClose }: { onClose: () => void }) {
  const ids = useId()
  const [step, setStep] = useState<Step>('passcode')
  const [passcode, setPasscode] = useState('')
  const [again, setAgain] = useState('')
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [words] = useState(newRecoveryCode)
  const [madeOn] = useState(() => new Date())
  const passcodeField = useRef<HTMLInputElement>(null)

  const choosePasscode = (event: FormEvent) => {
    event.preventDefault()
    const why = passcodeProblem(passcode, again)
    if (why) {
      setProblem(why)
      passcodeField.current?.focus()
      return
    }
    setProblem(undefined)
    setStep('sheet')
  }

  const lock = async () => {
    setBusy(true)
    setProblem(undefined)
    try {
      await turnLockOn(passcode, words)
      setPasscode('')
      setAgain('')
      setStep('done')
    } catch (error) {
      setProblem(
        `Your garden could not be locked, so nothing has changed. ${
          error instanceof Error && error.message ? error.message : ''
        }`.trim(),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <LockDialog eyebrow="Lock my garden" title={TITLES[step]} busy={busy} onClose={onClose}>
      {step === 'passcode' && (
        <form onSubmit={choosePasscode} noValidate>
          <p>
            With the lock on, everything the garden keeps on this device is sealed, and it
            opens only with your passcode, or with a recovery code you save next.
          </p>
          <p className="lock-warning">{NO_WAY_BACK}</p>
          <label>
            Passcode
            <input
              ref={passcodeField}
              type="password"
              autoComplete="new-password"
              value={passcode}
              aria-describedby={`${ids}-hint`}
              onChange={(event) => setPasscode(event.target.value)}
            />
          </label>
          <p className="field-hint" id={`${ids}-hint`}>
            At least {MIN_PASSCODE_LENGTH} characters. A longer passphrase, a few words only
            you would put together, is much stronger than a short code.
          </p>
          <label>
            The same passcode again
            <input
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(event) => setAgain(event.target.value)}
            />
          </label>
          {problem && (
            <p className="settings-note error" role="alert">
              {problem}
            </p>
          )}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              Next: your recovery code
            </button>
            <button className="text-button" type="button" onClick={onClose}>
              Not now
            </button>
          </div>
        </form>
      )}

      {step === 'sheet' && (
        <>
          <p>
            These 24 words open your garden if you forget your passcode. Write them down,
            print them or save the sheet, and keep it somewhere private, away from this
            device.
          </p>
          <RecoverySheet words={words} madeOn={madeOn} />
          <p className="lock-warning">{NO_WAY_BACK} There is no other way in.</p>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={() => setStep('confirm')}>
              I have kept the words
            </button>
            <button className="text-button" type="button" onClick={() => setStep('passcode')}>
              Back to the passcode
            </button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <ConfirmWords
            words={words}
            busy={busy}
            submitLabel="Lock my garden"
            onConfirmed={() => void lock()}
            onBack={() => setStep('sheet')}
          />
          <p className="lock-progress" role="status">
            {busy ? 'Locking your garden… this can take a few seconds.' : ''}
          </p>
          {problem && (
            <p className="settings-note error" role="alert">
              {problem}
            </p>
          )}
        </>
      )}

      {step === 'done' && (
        <>
          <p>
            Everything the garden keeps on this device is sealed now, and from now on it
            opens with your passcode. It stays open in this tab until you lock it, or until
            it locks itself after a while out of sight, if you choose that in Settings.
          </p>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      )}
    </LockDialog>
  )
}
