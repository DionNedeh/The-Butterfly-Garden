import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { sealedKind, readBackupFile } from '../../lib/backupFile'
import { codeHoldsTogether, moveSecret, readMoveCode } from '../../lib/moveCode'
import {
  openSealedBackup,
  readSealedBackup,
  type SealedBackup,
  type SealedProblem,
} from '../../lib/sealedBackup'
import { useModal } from '../backup/useModal'
import { useProblem } from '../backup/useProblem'
import { whatFollows } from '../backup/whatFollows'
import type { ProtectedRestoreProps } from '../backup/ProtectedRestore'
import './move.css'

/** Why a chosen file can never open here, before any code is asked for. */
const UNOPENABLE: Record<SealedProblem, string> = {
  newer:
    'That file was made by a newer version of the garden. Update the app, then choose it again.',
  damaged:
    'That file is damaged or incomplete, so no code can open it. Nothing has been changed.',
}

/** The slow part, said while it runs. */
type Busy = 'reading' | 'checking' | 'opening'

/** How the garden arrived: with a move file's code, or as a plain backup that needed none. */
export type ArrivedFrom = 'move' | 'plain'

export interface ArriveDialogProps {
  next?: ProtectedRestoreProps['next']
  /** A move file a restore has already chosen and read: straight to its code. */
  backup?: SealedBackup
  /** The plain backup the file held, open; how it was opened. */
  onOpened: (plainText: string, from: ArrivedFrom) => void
  /** A protected backup locked with a passphrase, not a code: ask for that instead. */
  onPassphrase?: (text: string) => void
  /** Put away without opening anything; `note` says why, when there is a reason. */
  onClose: (note?: string) => void
  /** Where focus goes as it closes, if nothing had it before. */
  returnFocus?: () => HTMLElement | null | undefined
}

/**
 * Arrive from another device: choose the move file the old device made,
 * then type its 12 words, and the garden inside goes
 * on to the usual restore, with its preview where the screen has one.
 * Nothing is replaced here, whatever happens.
 *
 * A plain backup chosen here needs no code and goes straight on;
 * a passphrase-protected one is handed to the passphrase prompt.
 *
 * Escape and Android's back gesture put it away (its cancel event; see
 * lib/backNavigation), except while the file is being opened.
 */
export function ArriveDialog({ next = 'arrive', backup, onOpened, onPassphrase, onClose, returnFocus }: ArriveDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const ids = useId()
  // A move file a restore recognised by its envelope (SealedBackupPrompt)
  // starts at its code.
  const [chosen, setChosen] = useState<SealedBackup | undefined>(backup)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState<Busy>()
  const [problem, say] = useProblem()
  const live = useRef(true)
  const choosing = useRef(0)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const shut = useModal(dialog, heading, () => onClose(), returnFocus)

  // From the file to its code: the new step's heading takes focus, so its
  // words are read first.
  const stepped = useRef(false)
  useEffect(() => {
    if (!stepped.current) {
      stepped.current = true
      return
    }
    heading.current?.focus()
  }, [chosen])

  const close = (note?: string) => {
    if (busy === 'opening' || busy === 'checking') return
    choosing.current += 1
    if (shut()) onClose(note)
  }

  const choose = async (file: File) => {
    const choice = ++choosing.current
    say('')
    setBusy('reading')
    const read = await readBackupFile(file)
    if (!live.current || choice !== choosing.current) return
    setBusy(undefined)
    if (!read.ok) {
      say(read.message)
      return
    }
    // A plain backup opens without a code: on to the usual restore.
    if (!sealedKind(read.text)) {
      if (shut()) onOpened(read.text, 'plain')
      return
    }
    if (sealedKind(read.text) === 'copy') {
      if (shut()) onPassphrase?.(read.text)
      return
    }
    const sealed = readSealedBackup(read.text)
    if (!sealed.ok) {
      say(UNOPENABLE[sealed.problem])
      return
    }
    if (sealed.backup.opensWith !== 'move-code') {
      if (!onPassphrase) {
        say('That is a protected backup, which opens with its passphrase. Choose it with Restore from a backup.')
        return
      }
      if (shut()) onPassphrase(read.text)
      return
    }
    setChosen(sealed.backup)
  }

  /** Open the chosen file with words that read as a code. */
  const openWith = async (words: string[]) => {
    if (!chosen) return
    setBusy('checking')
    const again = (message: string) => {
      if (!live.current) return
      setBusy(undefined)
      say(message)
      field.current?.focus()
    }
    let opened: string | undefined
    try {
      if (!(await codeHoldsTogether(words))) {
        again(
          'Those words do not fit together: one may be mistyped as another word, or two may have swapped places. Check them, in order, against your other device.',
        )
        return
      }
      if (!live.current) return
      setBusy('opening')
      opened = await openSealedBackup(chosen, moveSecret(words))
    } catch {
      again('This browser could not open the file just now. Please try again.')
      return
    }
    if (!live.current) return
    if (opened === undefined) {
      again(
        'Those words do not open this file. Each move file has a code of its own: check that this file is the one made with this code.',
      )
      return
    }
    setBusy(undefined)
    setTyped('')
    if (shut()) onOpened(opened, 'move')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    say('')
    const reading = readMoveCode(typed)
    if (!reading.ok) {
      say(reading.problem)
      field.current?.focus()
      return
    }
    await openWith(reading.words)
  }

  const chooseAgain = () => {
    if (busy) return
    setTyped('')
    say('')
    setChosen(undefined)
  }

  return (
    <dialog
      ref={dialog}
      className="garden-dialog move-dialog"
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-about`}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        close()
      }}
    >
      <p className="eyebrow">{backup === undefined ? 'A new home' : 'Restore a backup'}</p>
      {!chosen ? (
        <>
          <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
            Arrive from another device
          </h2>
          <p id={`${ids}-about`}>
            On your other device, choose Move my garden to another device in
            Settings. It makes a move file and shows a 12-word code. Choose that
            file here first; the code comes next. {whatFollows(next, 'backup')}
          </p>
          <label className="secondary-button file-button">
            Choose the move file
            <input
              type="file"
              accept="application/json,.json,text/plain,application/octet-stream"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void choose(file)
              }}
            />
          </label>
          <p className="move-progress" role="status">
            {busy === 'reading' ? 'Reading the file…' : ''}
          </p>
          <p key={problem.said} className="settings-note error move-problem" role="alert">
            {problem.text}
          </p>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => close()}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
            Open the move file
          </h2>
          <p id={`${ids}-about`}>
            It opens with the 12-word code your other device is showing.{' '}
            Type the words in order.{' '}
            The code is used only here, to open the file, and is not kept. {whatFollows(next, 'backup')}
          </p>
          <label>
            The 12 words
            <textarea
              ref={field}
              value={typed}
              rows={3}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              readOnly={busy !== undefined}
              aria-describedby={`${ids}-hint`}
              aria-invalid={problem.text ? true : undefined}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
          <p id={`${ids}-hint`} className="subtle-copy move-hint">
            Capitals, spaces and line breaks do not matter.
          </p>
          <p className="move-progress" role="status">
            {busy === 'checking'
              ? 'Checking the words…'
              : busy === 'opening'
                ? 'Opening the file with its code. This can take a few seconds…'
                : ''}
          </p>
          <p key={problem.said} className="settings-note error move-problem" role="alert">
            {problem.text}
          </p>
          <div className="form-actions">
            <button className="primary-button" type="submit" aria-disabled={busy !== undefined}>
              Open the file
            </button>
            {backup === undefined && (
              <button
                className="text-button"
                type="button"
                aria-disabled={busy !== undefined}
                onClick={chooseAgain}
              >
                Choose another file
              </button>
            )}
            <button
              className="secondary-button"
              type="button"
              aria-disabled={busy !== undefined}
              onClick={() => close()}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
