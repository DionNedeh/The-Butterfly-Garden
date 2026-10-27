import { useEffect, useRef, useState, type ComponentType } from 'react'

/** What every screen that restores hands the passphrase prompt. */
export interface ProtectedRestoreProps {
  /**
   * The chosen file's text: a protected backup, or safe mode's copy of a
   * locked garden (lib/backupFile's `sealedKind`).
   */
  text: string
  /**
   * What the screen does once the file opens, so the prompt promises that
   * and nothing more:
   * - `preview`  shows what it holds, and replaces nothing until asked (Settings);
   * - `replace`  restores it at once, in place of what is stored (safe mode,
   *              the recovery screen);
   * - `arrive`   restores it at once where nothing is stored yet (onboarding).
   */
  next: 'preview' | 'replace' | 'arrive'
  /**
   * It opened: carry on with the plain backup inside. `openedWith` says how:
   * a protected backup's passphrase, or a locked garden's own lock.
   */
  onOpened: (plainText: string, openedWith: 'passphrase' | 'lock') => void
  /** Put away without opening; `note` says why, when there is a reason. */
  onClose: (note?: string) => void
  /** Where focus goes as the prompt closes, if nothing had it before (the file field). */
  returnFocus?: () => HTMLElement | null | undefined
}

/**
 * Ask for a protected backup's passphrase, or the passcode or recovery code
 * of the garden a locked copy was made from, then hand back the backup
 * inside, wherever a backup can be restored: Settings, the recovery screen,
 * safe mode and onboarding.
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
        if (live) close.current('That file could not be opened just now. Please try again.')
      },
    )
    return () => {
      live = false
    }
  }, [])

  return Prompt ? <Prompt {...props} /> : null
}
