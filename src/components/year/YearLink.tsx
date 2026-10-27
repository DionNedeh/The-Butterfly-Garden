import { useEffect, useMemo, useRef, type MouseEvent } from 'react'
import { turningYear, yearsToLookBack } from '../../lib/gardenYear'
import { hashForRoute } from '../../lib/routes'
import type { AppState } from '../../types'
import './yearLink.css'

/**
 * The Journal's way to "Your garden's year": a quiet link at any time, and,
 * from 1 December to 31 January, one gentle line offering the year that is
 * turning (lib/gardenYear). Never a card, a badge or a reminder.
 *
 * A real link to the page, like GuideLink, but an ordinary click goes
 * through `onOpen`, so the page knows it came from the Journal and returns
 * there. Back from it, focus comes back to this link rather than falling to
 * the page.
 */
export function YearLink({
  state,
  today,
  onOpen,
  focusOnArrival = false,
}: {
  state: AppState
  today: string
  onOpen: (year?: number) => void
  /** Returned from the year's page: the link takes focus. */
  focusOnArrival?: boolean
}) {
  const link = useRef<HTMLAnchorElement>(null)
  const turning = turningYear(today)
  // Only the turning year, and only one with something in it: a garden
  // begun this January has no last year to look back on.
  const offered = useMemo(
    () =>
      turning !== undefined && yearsToLookBack(state, today).includes(turning)
        ? turning
        : undefined,
    [turning, state, today],
  )
  const thisYear = Number(today.slice(0, 4))
  const year = offered === undefined || offered === thisYear ? undefined : offered

  useEffect(() => {
    if (focusOnArrival) link.current?.focus()
  }, [focusOnArrival])

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window, asked for with a modifier key, keeps the link's
    // own behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    onOpen(year)
  }
  const anchor = (words: string) => (
    <a
      ref={link}
      className="year-link"
      href={hashForRoute({ view: 'year', year })}
      onClick={open}
    >
      {words}
    </a>
  )
  // A line of its own inside the header's paragraph, so the header keeps
  // the look its last paragraph has.
  return (
    <span className="year-link-line">
      {offered === undefined ? (
        anchor('Your garden’s year')
      ) : (
        <>As the year turns, {anchor(`look back on your garden’s ${offered}`)}.</>
      )}
    </span>
  )
}
