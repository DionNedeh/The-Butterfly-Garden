import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { sealedKind } from '../../lib/backupFile'
import {
  openSealedBackup,
  readSealedBackup,
  type SealedProblem,
  type SealingStep,
} from '../../lib/sealedBackup'
import { LockedCopyPrompt } from './LockedCopyPrompt'
import type { ProtectedRestoreProps } from './ProtectedRestore'
import { useModal } from './useModal'
import { useProblem } from './useProblem'
import { whatFollows } from './whatFollows'
import './backup.css'

/**
 * The secret a sealed file needs, asked for in a modal dialog before
 * anything is restored: a protected backup's passphrase, or the passcode or
 * recovery code of the garden a locked copy was made from (LockedCopyPrompt).
 */
export function SealedBackupPrompt(props: ProtectedRestoreProps) {
  // Decided once: the file chosen does not change while it is asked about.
  const [kind] = useState(() => sealedKind(props.text))
  return kind === 'copy' ? <LockedCopyPrompt {...props} /> : <PassphrasePrompt {...props} />
}

/** Why a protected backup cannot be opened at all, before any passphrase. */
const UNOPENABLE: Record<SealedProblem, string> = {
  newer:
    'It was made by a newer version of the garden, in a form this version cannot open. Update the app, then choose it again.',
  damaged:
    'It is damaged or incomplete, so it cannot be opened with any passphrase. Nothing has been changed.',
}

/**
 * The passphrase a protected backup was saved with, asked for calmly, in a
 * modal dialog, before anything is restored.
 *
 * A wrong passphrase is said plainly and never how near it came; GCM cannot
 * tell, and a hint would help a guesser more than the gardener. Opening runs
 * the same slow derivation as saving, so it says that it is working. What
 * opens is the plain backup's text, which goes on to the usual restore.
 * Nothing is replaced here, whatever happens; what the screen does next is
 * said as it does it (`whatFollows`).
 *
 * Escape and Android's back gesture put it away (through its cancel event;
 * see lib/backNavigation), except while it is opening the file.
 */
function PassphrasePrompt({ text, next, onOpened, onClose, returnFocus }: ProtectedRestoreProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const ids = useId()
  // Checked once, without the passphrase: a file that could never open says
  // so before anyone types anything.
  const [read] = useState(() => readSealedBackup(text))
  const [passphrase, setPassphrase] = useState('')
  const [shown, setShown] = useState(false)
  const [step, setStep] = useState<SealingStep>()
  const [problem, say] = useProblem()
  const [missed, setMissed] = useState(false)
  const busy = step !== undefined
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const shut = useModal(dialog, heading, () => onClose(), returnFocus)

  const close = () => {
    if (!busy && shut()) onClose()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !read.ok) return
    say('')
    if (!passphrase) {
      say('Enter the passphrase this backup was saved with.')
      field.current?.focus()
      return
    }
    setStep('deriving')
    let opened: string | undefined
    try {
      opened = await openSealedBackup(read.backup, passphrase, (next) => {
        if (live.current) setStep(next)
      })
    } catch {
      if (!live.current) return
      setStep(undefined)
      say('This browser could not open the backup just now. Please try again.')
      field.current?.focus()
      return
    }
    if (!live.current) return
    setStep(undefined)
    if (opened === undefined) {
      setMissed(true)
      say('That passphrase does not open this backup. Check it and try again.')
      field.current?.focus()
      field.current?.select()
      return
    }
    setPassphrase('')
    if (shut()) onOpened(opened, 'passphrase')
  }

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
            This backup is protected
          </h2>
          <p id={`${ids}-about`}>
            Enter the passphrase it was saved with. It is used only here, to
            open the file, and is not kept. {whatFollows(next, 'backup')}
          </p>
          <label>
            Passphrase
            <input
              ref={field}
              type={shown ? 'text' : 'password'}
              value={passphrase}
              autoComplete="current-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              readOnly={busy}
              aria-invalid={problem.text ? true : undefined}
              aria-describedby={missed ? `${ids}-exact` : undefined}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
          {missed && (
            <p id={`${ids}-exact`} className="subtle-copy">
              Passphrases are exact: capitals, spaces and punctuation all count.
            </p>
          )}
          <label className="protected-show">
            <input
              type="checkbox"
              checked={shown}
              onChange={(event) => setShown(event.target.checked)}
            />
            Show passphrase
          </label>
          <p className="protected-progress" role="status">
            {busy ? 'Opening the backup with your passphrase. This can take a few seconds…' : ''}
          </p>
          <p key={problem.said} className="settings-note error protected-problem" role="alert">
            {problem.text}
          </p>
          <div className="form-actions">
            <button className="primary-button" type="submit" aria-disabled={busy}>
              Open the backup
            </button>
            <button
              className="secondary-button"
              type="button"
              aria-disabled={busy}
              onClick={() => close()}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="eyebrow">Restore a backup</p>
          <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
            This protected backup cannot be opened
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
