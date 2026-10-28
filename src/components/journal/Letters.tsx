import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLatestLetter } from '../../hooks/useLatestLetter'
import { formatWeekday } from '../../lib/date'
import { gardenStartDate } from '../../lib/earlierDay'
import { letterQuotesOf } from '../../lib/letters'
import { isLetterWaiting, letterSundays } from '../../lib/letterTiming'
import { formatWeek, weekEndingOn, weeklyLetter } from '../../lib/summaries'
import type { AppState } from '../../types'

/**
 * Marigold's letters, at the top of the Journal: the newest, and the few
 * weeks before it, each worked out from the garden as it is read
 * (lib/summaries). Folded until asked for, or opened on the newest when the
 * gardener comes from the garden's card. A letter on screen has been read,
 * so the garden stops saying one is waiting.
 */
export function Letters({
  state,
  openOnArrival = false,
  onRead,
}: {
  state: AppState
  /** Opened from the garden's card: unfolded, with focus on the letter. */
  openOnArrival?: boolean
  /** The letter for the week ending on this Sunday has been read. */
  onRead: (sunday: string) => void
}) {
  const latest = useLatestLetter(state.profile)
  const start = gardenStartDate(state.profile)
  const sundays = useMemo(() => (latest ? letterSundays(latest, start) : []), [latest, start])
  const [open, setOpen] = useState(openOnArrival)
  const [chosen, setChosen] = useState<string>()
  // A week chosen earlier may have passed out of reach since; the newest then.
  const shown = chosen !== undefined && sundays.includes(chosen) ? chosen : sundays.at(0)
  const letter = useMemo(() => (shown ? weeklyLetter(state, shown) : undefined), [state, shown])
  const waiting = isLetterWaiting(state.profile, latest)
  const quotes = letterQuotesOf(state.profile)
  const titleId = useId()
  const letterTitleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (open && shown) onRead(shown)
  }, [open, shown, onRead])
  useEffect(() => {
    if (openOnArrival) heading.current?.focus()
  }, [openOnArrival])

  if (!letter) return null
  return (
    <section className="card letters" aria-labelledby={titleId}>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <span className="letters-summary">
            <span className="eyebrow">From the garden</span>
            <strong id={titleId}>Letters from Marigold</strong>
            <small className="letters-status">
              {waiting ? 'A new letter is waiting' : 'A letter each Sunday evening'}
            </small>
          </span>
        </summary>
        {open && (
          <div className="letters-body">
            {sundays.length > 1 && (
              <div className="letters-weeks" role="group" aria-label="Letters by week">
                {sundays.map((sunday) => (
                  <button
                    key={sunday}
                    type="button"
                    className="letters-week"
                    aria-pressed={sunday === shown}
                    onClick={() => setChosen(sunday)}
                  >
                    {formatWeek(weekEndingOn(sunday))}
                  </button>
                ))}
              </div>
            )}
            <article className="letter" aria-labelledby={letterTitleId}>
              {/* Focusable from code alone, for a letter opened from the garden. */}
              <h2 id={letterTitleId} ref={heading} tabIndex={-1}>
                The week of {formatWeek(letter.week)}
              </h2>
              <p>{letter.greeting}</p>
              {letter.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {letter.quote && (
                <figure className="letter-quote">
                  <figcaption>You wrote, on {formatWeekday(letter.quote.localDate)}:</figcaption>
                  <blockquote>
                    <p>{letter.quote.text}</p>
                  </blockquote>
                </figure>
              )}
              <p className="letter-signature">
                With love,
                <br />
                Marigold
              </p>
            </article>
            <p className="letters-note">
              {quotes === 'never'
                ? 'Letters never quote your words, as you chose in Settings.'
                : 'A letter quotes your words only where you star a line in your journal.'}
            </p>
          </div>
        )}
      </details>
    </section>
  )
}
