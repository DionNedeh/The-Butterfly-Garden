import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { datedFileName, saveTextFile } from '../../lib/download'
import { confirmsWord, positionsToConfirm, recoverySheet } from '../../lib/recoveryCode'

/**
 * The recovery code on screen, and the two ways to keep it: a plain-text
 * sheet saved as a file, made here on the device, or (in a browser) paper.
 * Printing prints the sheet alone (lock.css).
 */
export function RecoverySheet({ words, madeOn }: { words: readonly string[]; madeOn: Date }) {
  const [note, setNote] = useState<string>()
  const sheet = useMemo(() => recoverySheet(words, madeOn), [words, madeOn])
  const android = import.meta.env.VITE_PLATFORM === 'android'

  const save = async () => {
    setNote(undefined)
    try {
      const outcome = await saveTextFile(datedFileName('recovery-code', 'txt'), 'text/plain', sheet)
      setNote(
        outcome === 'saved'
          ? 'The sheet is saved. Keep it somewhere private.'
          : outcome === 'cancelled'
            ? 'The sheet was not saved.'
            : 'The sheet is downloading. Keep it somewhere private, and take it out of Downloads if others use this device.',
      )
    } catch {
      setNote('The sheet could not be saved there.')
    }
  }

  const print = () => {
    document.body.classList.add('printing-recovery')
    try {
      window.print()
    } finally {
      document.body.classList.remove('printing-recovery')
    }
  }

  return (
    <>
      <ol className="recovery-words" aria-label="Your recovery code, 24 words">
        {words.map((word, index) => (
          <li key={index}>{word}</li>
        ))}
      </ol>
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={() => void save()}>
          {android ? 'Save the sheet' : 'Download the sheet'}
        </button>
        {!android && (
          <button className="secondary-button" type="button" onClick={print}>
            Print the sheet
          </button>
        )}
      </div>
      {note && (
        <p className="settings-note" role="status">
          {note}
        </p>
      )}
      {createPortal(
        <pre className="recovery-print" aria-hidden="true">
          {sheet}
        </pre>,
        document.body,
      )}
    </>
  )
}

/**
 * Two words of the code, asked for by position: proof it was written down
 * before anything depends on it.
 */
export function ConfirmWords({
  words,
  busy,
  submitLabel,
  onConfirmed,
  onBack,
}: {
  words: readonly string[]
  busy: boolean
  submitLabel: string
  onConfirmed: () => void
  onBack: () => void
}) {
  const ids = useId()
  const [positions] = useState(positionsToConfirm)
  const [typed, setTyped] = useState(['', ''])
  const [problem, setProblem] = useState<string>()
  const fields = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const wrong = positions.findIndex((position, index) => !confirmsWord(words, position, typed[index]))
    if (wrong >= 0) {
      setProblem(`That is not word ${positions[wrong]}. Check your sheet and try again.`)
      fields[wrong].current?.focus()
      fields[wrong].current?.select()
      return
    }
    setProblem(undefined)
    onConfirmed()
  }

  return (
    <form onSubmit={submit} noValidate>
      <p>Type these two words from your sheet, so we know it is safely kept.</p>
      {positions.map((position, index) => (
        <label key={position}>
          {`Word ${position}`}
          <input
            ref={fields[index]}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={typed[index]}
            readOnly={busy}
            aria-describedby={problem ? `${ids}-problem` : undefined}
            onChange={(event) =>
              setTyped((current) => current.map((value, at) => (at === index ? event.target.value : value)))
            }
          />
        </label>
      ))}
      {problem && (
        <p className="settings-note error" role="alert" id={`${ids}-problem`}>
          {problem}
        </p>
      )}
      <div className="form-actions">
        <button className="primary-button" type="submit" aria-disabled={busy}>
          {submitLabel}
        </button>
        <button className="text-button" type="button" aria-disabled={busy} onClick={() => !busy && onBack()}>
          Back to the words
        </button>
      </div>
    </form>
  )
}
