import { useEffect, useRef, useState, type ComponentType } from 'react'
import { ProtectedRestore } from '../backup/ProtectedRestore'
import type { ProtectedRestoreProps } from '../backup/ProtectedRestore'
import type { ArriveDialogProps, ArrivedFrom } from './ArriveDialog'
import './move.css'

/** How the garden in a chosen file was opened, for the screen's own words. */
export type OpenedFrom = ArrivedFrom | 'passphrase' | 'lock'

/**
 * Arrive from another device, wherever a garden can be brought in: the
 * welcome, Settings' restore and the recovery screen. (A move file chosen
 * through Restore is sent to the same dialog by SealedBackupPrompt.)
 *
 * The dialog and the code that opens the file (the word list)
 * load only now, when asked for. Fetched by hand rather than with
 * React.lazy, so a failed fetch says so and the next tap tries again,
 * instead of an error taking down a screen that may be the last resort.
 *
 * A protected backup with a passphrase chosen here goes on to the
 * passphrase prompt, as it would from Restore.
 */
export function ArriveRestore({
  next = 'arrive',
  onOpened,
  onClose,
  returnFocus,
}: {
  next?: ProtectedRestoreProps['next']
  /** The plain backup inside, open: carry on with the screen's usual restore. */
  onOpened: (plainText: string, from: OpenedFrom) => void
  /** Put away without opening; `note` says why, when there is a reason. */
  onClose: (note?: string) => void
  returnFocus?: () => HTMLElement | null | undefined
}) {
  const [Dialog, setDialog] = useState<ComponentType<ArriveDialogProps>>()
  const [passphraseFile, setPassphraseFile] = useState<string>()
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    let live = true
    import('./ArriveDialog').then(
      (module) => {
        if (live) setDialog(() => module.ArriveDialog)
      },
      () => {
        if (live) close.current('Arriving from another device could not start just now. Please try again.')
      },
    )
    return () => {
      live = false
    }
  }, [])

  if (passphraseFile !== undefined)
    return (
      <ProtectedRestore
        next={next}
        text={passphraseFile}
        returnFocus={returnFocus}
        onOpened={onOpened}
        onClose={onClose}
      />
    )
  return Dialog ? (
    <Dialog
      next={next}
      onOpened={onOpened}
      onPassphrase={setPassphraseFile}
      onClose={onClose}
      returnFocus={returnFocus}
    />
  ) : null
}
