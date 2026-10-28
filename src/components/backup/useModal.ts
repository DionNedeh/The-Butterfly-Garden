import { useEffect, useRef, type RefObject } from 'react'

/**
 * A modal dialog's comings and goings, for the protected backup's two.
 *
 * On arrival it opens as a modal with focus on its heading, so its words
 * are read before its fields. On leaving, focus goes back to whatever had
 * it before (the button or file field that opened it), or to `returnFocus`
 * when nothing had it (a file chosen without focusing its field). Without
 * that, a dialog taken out of the page would leave focus on nothing. A
 * screen that moves focus somewhere better as the dialog goes (Settings, to
 * the restore preview) does so after this, and wins.
 *
 * Returns how to close it: true the first time, and false once it is
 * already closed, so whatever follows a close happens once. A close the
 * dialog did not ask for, which a browser may make anyway (Chrome closes a
 * modal on a second Escape whatever its cancel event says), is reported
 * through `onDismissed`, so the screen never keeps a dialog it can no longer
 * show, and nothing after it is acted on.
 */
export function useModal(
  dialog: RefObject<HTMLDialogElement | null>,
  heading: RefObject<HTMLElement | null>,
  onDismissed: () => void,
  returnFocus?: () => HTMLElement | null | undefined,
): () => boolean {
  const settled = useRef(false)
  const latest = useRef({ onDismissed, returnFocus })
  useEffect(() => {
    latest.current = { onDismissed, returnFocus }
  })

  useEffect(() => {
    const before = document.activeElement
    const opener = before instanceof HTMLElement && before !== document.body ? before : undefined
    const element = dialog.current
    const closed = () => {
      if (settled.current) return
      settled.current = true
      latest.current.onDismissed()
    }
    element?.addEventListener('close', closed)
    if (element && !element.open) element.showModal()
    heading.current?.focus()
    return () => {
      element?.removeEventListener('close', closed)
      const lost = !document.activeElement || document.activeElement === document.body
      if (!lost) return
      const target = opener?.isConnected ? opener : latest.current.returnFocus?.()
      target?.focus()
    }
  }, [dialog, heading])

  return () => {
    if (settled.current) return false
    settled.current = true
    dialog.current?.close()
    return true
  }
}
