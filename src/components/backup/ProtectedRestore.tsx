import { useEffect, useRef, useState, type ComponentType } from 'react'

/** What every screen that restores hands the passphrase prompt. */
export interface ProtectedRestoreProps {
  /** The chosen file's text: a protected backup (lib/backupFile). */
  text: string
  /** Its passphrase opened it: carry on with the plain backup inside. */
  onOpened: (plainText: string) => void
  /** Put away without opening; `note` says why, when there is a reason. */
  onClose: (note?: string) => void
  /** Where focus goes as the prompt closes, if nothing had it before (the file field). */
  returnFocus?: () => HTMLElement | null | undefined
}

/**
 * Ask for a protected backup's passphrase, then hand back the backup inside,
 * wherever a backup can be restored: Settings, the recovery screen, safe mode
 * and onboarding.
 *
 * The prompt and the code that opens the file load only now, when a
 * protected backup has been chosen, so a garden that never sees one never
 * downloads them. Safe mode carries this much in the first load, and no
 * more. Fetched by hand rather than with React.lazy, so a failed fetch says
 * so and the next choice of file tries again, instead of an error taking
 * down a screen that is itself the last resort.
 */
export function ProtectedRestore(props: ProtectedRestoreProps) {
  const [Prompt, setPrompt] = useState<ComponentType<ProtectedRestoreProps>>()
  const close = useRef(props.onClose)
  useEffect(() => {
    close.current = props.onClose
  })

  useEffect(() => {
    let live = true
    import('./SealedBackupPrompt').then(
      (module) => {
        if (live) setPrompt(() => module.SealedBackupPrompt)
      },
      () => {
        if (live) close.current('This protected backup could not be opened just now. Please try again.')
      },
    )
    return () => {
      live = false
    }
  }, [])

  return Prompt ? <Prompt {...props} /> : null
}
