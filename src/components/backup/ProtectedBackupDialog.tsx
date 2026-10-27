import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { datedFileName, saveTextFile } from '../../lib/download'
import {
  MIN_PASSPHRASE_LENGTH,
  passphraseLength,
  passphraseStrength,
  strengthWords,
} from '../../lib/passphrase'
import { sealBackup, type SealingStep } from '../../lib/sealedBackup'
import { shareTextFile } from '../../lib/shareFile'
import { useModal } from './useModal'
import { useProblem } from './useProblem'
import './backup.css'

/** What became of the dialog: a copy that reached the gardener, said in words. */
export interface ProtectedBackupResult {
  note: string
  /** When the backup inside was exported, for the backup reminder. */
  madeAt: Date
}

/** The words shown while the slow part runs. */
const STEP_WORDS: Partial<Record<SealingStep, string>> = {
  deriving: 'Turning your passphrase into a key. This can take a few seconds…',
  locking: 'Locking the backup…',
}

/** The file locked and ready: its text, and when the garden in it was exported. */
interface Ready {
  text: string
  madeAt: Date
}

/**
 * Make a protected backup: the usual backup file, locked with a passphrase
 * the gardener chooses twice, then saved, downloaded or shared the way the
 * plain one is.
 *
 * Two steps, on purpose. Turning a passphrase into a key takes a few seconds
 * on a phone, longer than a browser keeps the tap that asked for a download
 * or a share sheet; so the file is locked first, and handed over by a second
 * tap of its own. The passphrase is gone from here as soon as it has been
 * used, and is never stored anywhere.
 *
 * Escape and Android's back gesture put it away (its cancel event; see
 * lib/backNavigation), except while the file is being locked.
 */
export function ProtectedBackupDialog({
  share = false,
  onExportGarden,
  onClose,
}: {
  /** Offer the share sheet rather than a download (where the browser can). */
  share?: boolean
  /** The plain backup's text, or undefined while the garden cannot be saved. */
  onExportGarden: () => string | undefined | Promise<string | undefined>
  /** Put away; with a result when a copy reached the gardener. */
  onClose: (result?: ProtectedBackupResult) => void
}) {
  // Inline, so each build keeps only its own words and save path.
  const android = import.meta.env.VITE_PLATFORM === 'android'
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef<HTMLInputElement>(null)
  const second = useRef<HTMLInputElement>(null)
  const deliver = useRef<HTMLButtonElement>(null)
  const ids = useId()
  const [passphrase, setPassphrase] = useState('')
  const [again, setAgain] = useState('')
  const [shown, setShown] = useState(false)
  const [step, setStep] = useState<SealingStep>()
  const [handing, setHanding] = useState(false)
  const [problem, say] = useProblem()
  const [ready, setReady] = useState<Ready>()
  const busy = step !== undefined || handing
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const shut = useModal(dialog, heading, () => onClose())
  // The fields go once the file is ready; focus goes to what hands it over.
  useEffect(() => {
    if (ready) deliver.current?.focus()
  }, [ready])

  const title = share
    ? 'Share a protected backup'
    : android
      ? 'Save a protected backup'
      : 'Download a protected backup'
  const length = passphraseLength(passphrase)
  const strength = passphraseStrength(passphrase)

  const close = () => {
    if (!busy && shut()) onClose()
  }

  const lock = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    say('')
    if (length < MIN_PASSPHRASE_LENGTH) {
      say(`Use at least ${MIN_PASSPHRASE_LENGTH} characters for the passphrase.`)
      first.current?.focus()
      return
    }
    if (again !== passphrase) {
      say('The two passphrases are not the same. Type the second one again.')
      second.current?.focus()
      second.current?.select()
      return
    }
    setStep('deriving')
    const fail = (message: string) => {
      if (!live.current) return
      setStep(undefined)
      say(message)
      first.current?.focus()
    }
    try {
      const madeAt = new Date()
      const plain = await onExportGarden()
      if (plain === undefined) {
        fail('Saving a backup is paused while the stored garden cannot be read.')
        return
      }
      const outcome = await sealBackup(plain, passphrase, {
        onStep: (next) => {
          if (live.current) setStep(next)
        },
      })
      if (!outcome.ok) {
        fail(
          `This garden is too large for a protected backup that could be opened again. ${android ? 'Save' : 'Download'} the plain backup instead.`,
        )
        return
      }
      if (!live.current) return
      // Used: nothing here holds the passphrase any longer.
      setPassphrase('')
      setAgain('')
      setStep(undefined)
      setReady({ text: outcome.text, madeAt })
    } catch {
      fail('This browser could not lock the backup just now. Please try again.')
    }
  }

  const handOver = async (by: 'save' | 'share') => {
    if (!ready || busy) return
    say('')
    setHanding(true)
    const fileName = datedFileName('protected')
    let note: string | undefined
    try {
      if (by === 'share') {
        const outcome = await shareTextFile(
          fileName,
          'application/json',
          ready.text,
          'The Butterfly Garden protected backup',
        )
        // Closing the share sheet is a choice: the file waits here for another try.
        if (outcome === 'shared')
          note = 'Protected backup shared. Keep its passphrase somewhere safe, apart from the file.'
      } else {
        const outcome = await saveTextFile(fileName, 'application/json', ready.text)
        if (outcome === 'saved')
          note = 'Protected backup saved. Keep its passphrase somewhere safe, apart from the file.'
        else if (outcome === 'started')
          note =
            'Protected backup started. Check your downloads, and keep its passphrase somewhere safe, apart from the file.'
        else if (live.current) say('Nothing was saved. Choose Save again to pick a place.')
      }
    } catch {
      if (live.current)
        say(
          by === 'share'
            ? 'This browser would not share the file. Download it instead.'
            : android
              ? 'The protected backup could not be saved there. Try choosing another place.'
              : 'This browser would not start the download.',
        )
    }
    if (!live.current) return
    setHanding(false)
    if (note && shut()) onClose({ note, madeAt: ready.madeAt })
  }

  const saveLabel = android ? 'Save protected backup' : 'Download protected backup'

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
      <p className="eyebrow">Keep a copy</p>
      <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
        {title}
      </h2>
      {!ready ? (
        <form onSubmit={(event) => void lock(event)} noValidate>
          <p id={`${ids}-about`}>
            Choose a passphrase to lock this copy of your garden. Without it,
            nobody can open the file: not this app, not us, and not you if it
            is forgotten. It is never stored, here or in the file, so keep it
            somewhere safe, apart from the file.
          </p>
          <label>
            Passphrase
            <input
              ref={first}
              type={shown ? 'text' : 'password'}
              value={passphrase}
              autoComplete="new-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              readOnly={busy}
              aria-describedby={`${ids}-strength`}
              aria-invalid={problem.text && length < MIN_PASSPHRASE_LENGTH ? true : undefined}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
          <p id={`${ids}-strength`} className="subtle-copy protected-strength">
            {strengthWords(strength, length)}
          </p>
          <label>
            Passphrase again
            <input
              ref={second}
              type={shown ? 'text' : 'password'}
              value={again}
              autoComplete="new-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              readOnly={busy}
              aria-invalid={problem.text && again !== passphrase ? true : undefined}
              onChange={(event) => setAgain(event.target.value)}
            />
          </label>
          <label className="protected-show">
            <input
              type="checkbox"
              checked={shown}
              onChange={(event) => setShown(event.target.checked)}
            />
            Show passphrases
          </label>
          <p className="protected-progress" role="status">
            {step ? STEP_WORDS[step] : ''}
          </p>
          <p key={problem.said} className="settings-note error protected-problem" role="alert">
            {problem.text}
          </p>
          <div className="form-actions">
            <button className="primary-button" type="submit" aria-disabled={busy}>
              Lock the backup
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
          <p id={`${ids}-about`}>
            Your protected backup is ready. It opens only with the passphrase
            you just chose.
          </p>
          <p className="protected-progress" role="status">
            {handing ? 'Handing over the file…' : ''}
          </p>
          <p key={problem.said} className="settings-note error protected-problem" role="alert">
            {problem.text}
          </p>
          <div className="form-actions">
            {share && (
              <button
                ref={deliver}
                className="primary-button"
                type="button"
                aria-disabled={busy}
                onClick={() => void handOver('share')}
              >
                Share protected backup
              </button>
            )}
            <button
              ref={share ? undefined : deliver}
              className={share ? 'secondary-button' : 'primary-button'}
              type="button"
              aria-disabled={busy}
              onClick={() => void handOver('save')}
            >
              {saveLabel}
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
        </>
      )}
    </dialog>
  )
}
