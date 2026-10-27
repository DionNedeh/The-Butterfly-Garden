import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * A modal for one of the lock's changes, in the garden's own dialog style.
 *
 * It opens with focus on its heading, and closes on Escape or Android's back
 * gesture (lib/backNavigation sends the same cancel) -- unless a key is being
 * derived or the garden is being sealed, which nothing should cut short.
 * Whatever opened it gets focus back through `onClose`.
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

  useEffect(() => {
    dialog.current?.showModal()
    heading.current?.focus()
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
