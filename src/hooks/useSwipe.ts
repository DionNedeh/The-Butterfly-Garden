import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'

/** How far a finger has to travel sideways before a swipe counts. */
export const SWIPE_DISTANCE = 72

/** Movement smaller than this does not yet say which way the finger is going. */
const SLOP = 10

/**
 * How long after a swipe a click is taken to be the one that ended it. Long
 * enough for the browser's own click after a touch, short enough that the
 * next deliberate press -- a key, a switch, a voice command -- goes through.
 */
const SWIPE_CLICK_MS = 500

/**
 * Swipe right or left on a row, for touch only.
 *
 * A mouse or pen keeps the buttons, which do the same things; a sideways
 * finger gets a shortcut. Vertical movement is left to the page (the row sets
 * `touch-action: pan-y`), and a drag that sets off more vertical than
 * sideways is never a swipe, so scrolling past a row cannot complete it. The
 * direction is decided once, after a few pixels, so the wobble of a thumb
 * that starts a sideways swipe does not cancel it.
 */
export function useSwipe({
  onRight,
  onLeft,
  disabled = false,
}: {
  onRight?: () => void
  onLeft?: () => void
  disabled?: boolean
}) {
  const start = useRef<{ x: number; y: number; id: number; sideways: boolean } | undefined>(
    undefined,
  )
  // When a swipe last acted, so the click that ends it does not press a button too.
  const swipedAt = useRef(Number.NEGATIVE_INFINITY)
  const [offset, setOffset] = useState(0)

  const reset = () => {
    start.current = undefined
    setOffset(0)
  }

  return {
    offset,
    /** True while a finger is moving the row, when it should follow without easing. */
    dragging: offset !== 0,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (disabled || event.pointerType !== 'touch') return
        start.current = { x: event.clientX, y: event.clientY, id: event.pointerId, sideways: false }
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const origin = start.current
        if (!origin || origin.id !== event.pointerId) return
        const dx = event.clientX - origin.x
        const dy = event.clientY - origin.y
        if (!origin.sideways) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return
          if (Math.abs(dy) > Math.abs(dx)) {
            reset()
            return
          }
          origin.sideways = true
        }
        // Only the directions that do something move the row.
        setOffset((dx > 0 && onRight) || (dx < 0 && onLeft) ? dx : 0)
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const origin = start.current
        reset()
        if (!origin?.sideways || origin.id !== event.pointerId) return
        // Measured where the finger lifted, not where the row last rendered:
        // a quick flick lifts before its last move has been drawn.
        const dx = event.clientX - origin.x
        const action = dx >= SWIPE_DISTANCE ? onRight : dx <= -SWIPE_DISTANCE ? onLeft : undefined
        if (!action) return
        swipedAt.current = event.timeStamp
        action()
      },
      onPointerCancel: reset,
      onClickCapture: (event: MouseEvent<HTMLElement>) => {
        if (event.timeStamp - swipedAt.current > SWIPE_CLICK_MS) return
        swipedAt.current = Number.NEGATIVE_INFINITY
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
}
