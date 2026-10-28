import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * A modal for one of the lock's changes, in the garden's own dialog style.
 *
 * It opens with focus on its heading, and closes on Escape or Android's back
 * gesture (lib/backNavigation sends the same cancel) -- unless a key is being
 * derived or the garden is being sealed, which nothing should cut short.
 *
 * A close it did not ask for, which a browser may make anyway (Chrome closes
 * a modal on a second Escape whatever its cancel event says), is followed
 * too: through `onClose` when nothing is under way, so the screen never keeps
 * a dialog it no longer shows; and while something is, by showing the dialog
 * again, so what came of it is still seen, and still in a modal.
 *
 * Focus is not handed back from here. While this is open, everything else on
 * the page is inert and refuses it; whatever opened the dialog moves focus
 * once the dialog has gone (LockSettings).
 */
export function LockDialog({
  eyebrow,
  title,
  busy,
  onClose,
  children,
}: {
  eyebrow: string
  title: string
  busy: boolean
  onClose: () => void
  children: ReactNode
}) {
  const ids = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const latest = useRef({ busy, onClose })
  useEffect(() => {
    latest.current = { busy, onClose }
  })

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const closed = () => {
      if (!latest.current.busy) {
        latest.current.onClose()
        return
      }
      if (!element.isConnected) return
      element.showModal()
      heading.current?.focus()
    }
    element.addEventListener('close', closed)
    if (!element.open) element.showModal()
    heading.current?.focus()
    return () => element.removeEventListener('close', closed)
  }, [])

  // A new step has a new heading: the gardener is taken to it.
  useEffect(() => {
    heading.current?.focus()
  }, [title])

  return (
    <dialog
      ref={dialog}
      className="garden-dialog lock-dialog"
      aria-labelledby={`${ids}-title`}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
            {title}
          </h2>
        </div>
      </div>
      {children}
    </dialog>
  )
}
