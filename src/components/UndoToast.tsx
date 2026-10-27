import { useEffect, useRef, useState } from 'react'
import { Spoken } from './Spoken'

/** How long an undo stays on offer. */
export const UNDO_MS = 6000

export interface UndoOffer {
  /** What just happened, in a few words: "Water the plants marked done." */
  message: string
  /**
   * The same words as a screen reader should say them, where they differ:
   * "Blue exclamation mark jar recycled" for the "Blue ! jar" shown.
   */
  spoken?: string
  undo: () => void
}

/**
 * "Undo" in place of "Are you sure?": the action happens at once, and can be
 * taken back for a few seconds. The offer waits while the pointer or focus
 * is on it, so nobody loses the chance to a timer while reaching for the
 * button. A newer offer replaces an older one, as only the latest makes sense.
 */
export function UndoToast({ offer, onDone }: { offer?: UndoOffer; onDone: () => void }) {
  // Held for one offer only, so a newer offer always starts its own timer.
  const [heldOffer, setHeldOffer] = useState<UndoOffer>()
  const held = offer !== undefined && heldOffer === offer
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!offer || held) return
    const timer = window.setTimeout(() => done.current(), UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [offer, held])

  return (
    <div className="undo-region" role="status" aria-live="polite">
      {offer && (
        <div
          className="undo-toast"
          onPointerEnter={() => setHeldOffer(offer)}
          onPointerLeave={() => setHeldOffer(undefined)}
          onFocus={() => setHeldOffer(offer)}
          onBlur={() => setHeldOffer(undefined)}
        >
          <span>
            <Spoken text={offer.message} spoken={offer.spoken} />
          </span>
          <button
            className="text-button"
            onClick={() => {
              offer.undo()
              done.current()
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
