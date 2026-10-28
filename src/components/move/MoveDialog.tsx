import { useEffect, useId, useRef, useState } from 'react'
import { datedFileName, saveTextFile } from '../../lib/download'
import { moveSecret, newMoveCode } from '../../lib/moveCode'
import { sealBackup } from '../../lib/sealedBackup'
import { shareTextFile } from '../../lib/shareFile'
import type { FileCopy } from '../../lib/sightingPhotos'
import { useModal } from '../backup/useModal'
import { useProblem } from '../backup/useProblem'
import './move.css'

/** Where the dialog is: before the file, making it, handing it over, then the code. */
type Step = 'start' | 'making' | 'send' | 'code'

/** The move file, locked, and the code that opens it: held here and nowhere else. */
interface Made {
  text: string
  words: string[]
  /** Said with the file: a photo the plain backup had to leave out. */
  leftOut?: string
}

/** The lock stays behind: said wherever the gardener is when they move. */
function LockStaysNote() {
  return (
    <p className="move-note">
      Your garden lock stays on this device. The garden on your new device will
      not be locked until you turn the lock on there, in Settings.
    </p>
  )
}

/**
 * Move my garden to another device, from this end: a move file and the
 * one-time code that opens it.
 *
 * The file is a protected backup (lib/sealedBackup), locked with 12 words
 * chosen at random (lib/moveCode) rather than a passphrase, so it can go
 * any way the gardener likes. The code is shown once, here, as words, and is never stored: closing
 * the dialog forgets it, and the file with it. Nothing is written anywhere,
 * so a move file does not count as a backup for the backup reminder: once
 * its code is gone it opens for nobody.
 *
 * With the garden lock on, this is still allowed: the file is sealed like
 * any protected backup, and nothing of the journal is in it in the clear.
 *
 * Making the file and handing it over are two taps, as for a protected
 * backup: the key derivation takes longer than a browser keeps the tap that
 * may open a share sheet or start a download.
 *
 * Escape and Android's back gesture put it away (its cancel event; see
 * lib/backNavigation), except while the file is being made.
 */
export function MoveDialog({
  share = false,
  lockOn = false,
  onExportGarden,
  onClose,
}: {
  /** Offer the share sheet as well as a download (where the browser can). */
  share?: boolean
  /** Whether this garden has a lock, which does not travel with the file. */
  lockOn?: boolean
  /** The plain backup, or undefined while the garden cannot be saved. */
  onExportGarden: () => FileCopy | undefined | Promise<FileCopy | undefined>
  onClose: () => void
}) {
  // Inline, so each build keeps only its own words and save path.
  const android = import.meta.env.VITE_PLATFORM === 'android'
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const start = useRef<HTMLButtonElement>(null)
  const deliver = useRef<HTMLButtonElement>(null)
  const ids = useId()
  const [step, setStep] = useState<Step>('start')
  const [made, setMade] = useState<Made>()
  const [handing, setHanding] = useState(false)
  const [sent, setSent] = useState('')
  const [problem, say] = useProblem()
  const busy = step === 'making' || handing
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const shut = useModal(dialog, heading, () => onClose())
  // Each step's words replace the last; focus goes to its heading, so they
  // are read from the top, or to the button that hands the file over.
  const arrived = useRef(false)
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true
      return
    }
    if (step === 'send') deliver.current?.focus()
    else if (step === 'code') heading.current?.focus()
  }, [step])

  const close = () => {
    if (!busy && shut()) onClose()
  }

  const make = async () => {
    if (busy) return
    say('')
    setStep('making')
    const fail = (message: string) => {
      if (!live.current) return
      setStep('start')
      say(message)
      start.current?.focus()
    }
    try {
      const words = await newMoveCode()
      const plain = await onExportGarden()
      if (plain === undefined) {
        fail('Making a move file is paused while the stored garden cannot be read.')
        return
      }
      const outcome = await sealBackup(plain.text, moveSecret(words), { opensWith: 'move-code' })
      if (!outcome.ok) {
        fail(
          `This garden is too large for a move file that could be opened again. ${android ? 'Save' : 'Download'} the plain backup instead, and keep it somewhere private.`,
        )
        return
      }
      if (!live.current) return
      setMade({ text: outcome.text, words, leftOut: plain.leftOut })
      setStep('send')
    } catch {
      fail('This browser could not make the move file just now. Please try again.')
    }
  }

  const handOver = async (by: 'save' | 'share') => {
    if (!made || busy) return
    say('')
    setHanding(true)
    const fileName = datedFileName('move')
    let note: string | undefined
    try {
      if (by === 'share') {
        const outcome = await shareTextFile(
          fileName,
          'application/json',
          made.text,
          'The Butterfly Garden move file',
        )
        // Closing the share sheet is a choice: the file waits for another try.
        if (outcome === 'shared') note = 'Move file shared.'
      } else {
        const outcome = await saveTextFile(fileName, 'application/json', made.text)
        if (outcome === 'saved') note = 'Move file saved.'
        else if (outcome === 'started') note = 'Move file downloading. Check your downloads.'
        else if (live.current) say('Nothing was saved. Choose Save again to pick a place.')
      }
    } catch {
      if (live.current)
        say(
          by === 'share'
            ? 'This browser would not share the file. Download it instead.'
            : android
              ? 'The move file could not be saved there. Try choosing another place.'
              : 'This browser would not start the download.',
        )
    }
    if (!live.current) return
    setHanding(false)
    if (note) {
      setSent(made.leftOut ? `${note} ${made.leftOut}` : note)
      setStep('code')
    }
  }

  const saveLabel = android ? 'Save the move file' : 'Download the move file'
  const title =
    step === 'code' ? 'Your one-time code' : step === 'send' ? 'Send the move file' : 'Move my garden to another device'

  return (
    <dialog
      ref={dialog}
      className="garden-dialog move-dialog"
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-about`}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <p className="eyebrow">A new home</p>
      <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
        {title}
      </h2>
      {step === 'start' || step === 'making' ? (
        <>
          <p id={`${ids}-about`}>
            This makes a move file: a copy of your whole garden, locked with a
            one-time code. Send the file to your new device any way you like,
            and this screen then shows the code as 12 words to type there.
          </p>
          <p>
            The file can travel through any app, even one you would not trust
            with your journal, because the code never travels with it. Without
            the code, nobody can open the file.
          </p>
          {lockOn && <LockStaysNote />}
          <p className="move-progress" role="status">
            {step === 'making' ? 'Making the move file. This can take a few seconds…' : ''}
          </p>
          <p key={problem.said} className="settings-note error move-problem" role="alert">
            {problem.text}
          </p>
          <div className="form-actions">
            <button
              ref={start}
              className="primary-button"
              type="button"
              aria-disabled={busy}
              onClick={() => void make()}
            >
              Make the move file
            </button>
            <button className="secondary-button" type="button" aria-disabled={busy} onClick={close}>
              Cancel
            </button>
          </div>
        </>
      ) : step === 'send' ? (
        <>
          <p id={`${ids}-about`}>
            {share
              ? 'Your move file is ready. Share it to your new device, by AirDrop, a message, email or a cloud drive, or download it and send it from there.'
              : android
                ? 'Your move file is ready. Save it somewhere your new device can reach, such as a cloud drive, then open it there.'
                : 'Your move file is ready. Download it, then send it to your new device by email, a message, a cloud drive or a USB stick.'}{' '}
            The code comes next, on this screen.
          </p>
          <p className="move-progress" role="status">
            {handing ? 'Handing over the file…' : ''}
          </p>
          <p key={problem.said} className="settings-note error move-problem" role="alert">
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
                Share the move file…
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
            {made && sent && (
              <button
                className="text-button"
                type="button"
                aria-disabled={busy}
                onClick={() => setStep('code')}
              >
                Back to the code
              </button>
            )}
            <button className="secondary-button" type="button" aria-disabled={busy} onClick={close}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        made && (
          <>
            <p className="move-progress" role="status">
              {sent}
            </p>
            <p id={`${ids}-about`}>
              On your new device, open the garden and choose Arrive from another
              device: on the welcome screen, or in Settings under Restore. Choose
              the move file, then type the 12 words in order.
            </p>
            <div className="move-code">
              <ol className="move-words" aria-label="The one-time code, 12 words">
                {made.words.map((word, index) => (
                  <li key={index}>{word}</li>
                ))}
              </ol>
            </div>
            <p className="move-note">
              This code is shown once, only on this screen, and is kept nowhere.
              Send it apart from the file, or not at all: whoever has both can
              open your garden. If this screen closes before your new device has
              opened the file, make a new move file.
            </p>
            {lockOn && <LockStaysNote />}
            <div className="form-actions">
              <button className="primary-button" type="button" onClick={close}>
                Done
              </button>
              <button className="text-button" type="button" onClick={() => setStep('send')}>
                Send the file another way
              </button>
            </div>
          </>
        )
      )}
    </dialog>
  )
}
