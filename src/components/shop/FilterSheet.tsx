import { useEffect, useRef, type ReactNode } from 'react'
import { counted } from '../../lib/plural'

/**
 * The shop's filters on a phone: a sheet over the collection rather than a
 * panel above it, which on a small screen filled the whole first screen
 * before a single piece appeared. A modal <dialog>, so Escape and Android's
 * back gesture (through its cancel event; see lib/backNavigation) put it
 * away like any other.
 */
export function FilterSheet({
  results,
  onClose,
  children,
}: {
  /** How many pieces the filters leave, so the way out says what it shows. */
  results: number
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  // Closed before onClose runs: until then everything behind the sheet is
  // inert, and focus could not go back to the button that opened it.
  const close = () => {
    dialog.current?.close()
    onClose()
  }
  return (
    <dialog
      ref={dialog}
      className="garden-dialog shop-filter-sheet"
      aria-labelledby="shop-filter-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <h2 id="shop-filter-title">Filter the collection</h2>
        <button className="secondary-button" onClick={close}>
          Close
        </button>
      </div>
      {children}
      {/* Everything behind a modal sheet is out of reach, the count above the
          collection included, so the sheet says how many pieces are left. */}
      <p className="subtle-copy" role="status">
        {counted(results, 'piece', 'pieces')} to explore
      </p>
      <button className="primary-button shop-filter-done" onClick={close}>
        Show {counted(results, 'piece', 'pieces')}
      </button>
    </dialog>
  )
}
