import { useEffect, useRef } from 'react'
import { Spoken } from '../Spoken'

/** How long a purchase's outcome stays on screen. */
export const PURCHASE_TOAST_MS = 6000

export interface PurchaseNote {
  text: string
  /** The same words as a screen reader should say them, where they differ: a jar's mark. */
  spoken?: string
  /** New for every purchase, so the same words twice are still heard twice. */
  key: number
}

/**
 * What the last purchase came to, near where the gardener's thumb is rather
 * than at the top of a long grid they have scrolled down. It wears the undo
 * toast's look (App.css) so the app has one kind of toast. The polite live
 * region is always present, so a screen reader hears each outcome.
 */
export function PurchaseToast({ note, onDone }: { note?: PurchaseNote; onDone: () => void }) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!note) return
    const timer = window.setTimeout(() => done.current(), PURCHASE_TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [note])

  return (
    <div className="undo-region purchase-toast-region" role="status" aria-live="polite">
      {note && (
        <p className="undo-toast purchase-toast" key={note.key}>
          <Spoken text={note.text} spoken={note.spoken} />
        </p>
      )}
    </div>
  )
}
