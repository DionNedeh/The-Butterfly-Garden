/** The part of a box that matters here: where it starts and ends, down the screen. */
export interface Span {
  top: number
  bottom: number
}

/**
 * How far to scroll, as a session starts, for Stop to be clear of the dock and
 * the count clear of the header, both within `view` (the screen between the
 * two). Measured rather than left to the page's scroll-padding, which Safari
 * does not apply when bringing an element into view.
 *
 * Stop is placed first and the count last, so where a screen cannot hold both
 * it is the count, the only pacer with the wings still, that stays in view.
 * Nothing moves that is already in view.
 */
export function startScroll(stop: Span, count: Span, view: Span): number {
  let shift = 0
  if (stop.bottom > view.bottom) shift = stop.bottom - view.bottom
  else if (stop.top < view.top) shift = stop.top - view.top
  if (count.top - shift < view.top) shift = count.top - view.top
  else if (count.bottom - shift > view.bottom) shift = count.bottom - view.bottom
  return shift
}

/** A gap kept between what is brought into view and the header or the dock. */
const CLEARANCE = 8

/**
 * The screen between the header and the dock, as they are now: the header
 * grows with the text size and, in the Android app, with the status bar; the
 * dock shows on phones and narrow windows only.
 */
export function openView(root: ParentNode = document, height = window.innerHeight): Span {
  const header = root.querySelector('.app-header')?.getBoundingClientRect()
  const dock = root.querySelector('.bottom-nav')?.getBoundingClientRect()
  const top = header && header.bottom > 0 ? header.bottom : 0
  const bottom = dock && dock.height > 0 && dock.top < height ? dock.top : height
  return { top: top + CLEARANCE, bottom: bottom - CLEARANCE }
}
