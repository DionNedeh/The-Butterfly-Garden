import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { formatDayInWords } from '../lib/fieldNotes'
import { gardenYear, yearInWords, yearsToLookBack } from '../lib/gardenYear'
import { letterQuotesOf } from '../lib/letters'
import { yearLabel } from '../lib/weatherCalendar'
import type { AppState } from '../types'
import { Postcard } from './year/Postcard'
import { YearCalendar } from './WeatherCalendar'
import './year/year.css'

/**
 * "Your garden's year" (plan c.4): a year looked back on, from the Journal,
 * at any time. This year unless another is asked for, and any earlier year
 * with something in it.
 *
 * Everything on it is worked out from the garden as it stands
 * (lib/gardenYear) and said plainly: the year's weather, what was written,
 * days cared for (never a streak, and no numbers at all when Settings hides
 * them), who arrived, and a few lines the gardener starred, only as the
 * letters may quote them. No scores, no comparison with another year, no
 * advice. It ends in a postcard, made only when asked.
 */
export function YearView({
  state,
  today,
  year: asked,
  onChooseYear,
  onBack,
}: {
  state: AppState
  today: string
  /** The year asked for; this year when it is not one the page offers. */
  year?: number
  onChooseYear: (year: number) => void
  /** Back to the Journal, or the page that opened this one. */
  onBack: () => void
}) {
  const years = useMemo(() => yearsToLookBack(state, today), [state, today])
  const year = asked !== undefined && years.includes(asked) ? asked : years[0]
  const facts = useMemo(() => gardenYear(state, year, today), [state, year, today])
  const numbers = state.profile?.hideDayCounts !== true
  const words = useMemo(() => yearInWords(facts, numbers), [facts, numbers])
  const quotes = letterQuotesOf(state.profile)
  const heading = useRef<HTMLHeadingElement>(null)
  const journalId = useId()
  const gardenId = useId()
  const linesId = useId()

  const moodByDate = useMemo(
    () => new Map(state.moods.map((entry) => [entry.localDate, entry])),
    [state.moods],
  )
  const written = useMemo(
    () =>
      new Set([
        ...state.reflections.map((entry) => entry.localDate),
        ...state.recaps.map((entry) => entry.localDate),
      ]),
    [state.reflections, state.recaps],
  )
  const hasEntry = useCallback(
    (localDate: string) => moodByDate.has(localDate) || written.has(localDate),
    [moodByDate, written],
  )
  const yearPrefix = `${String(year).padStart(4, '0')}-`
  const anyDayWritten = useMemo(
    () =>
      [...moodByDate.keys(), ...written].some(
        (date) => date.startsWith(yearPrefix) && date <= today,
      ),
    [moodByDate, written, yearPrefix, today],
  )

  // The page opens at its heading, as breathing does.
  useEffect(() => {
    heading.current?.focus()
  }, [])

  // Escape leaves, as Android's back gesture does, unless a dialog (the
  // phone's More sheet) is open and takes it.
  const backLatest = useRef(onBack)
  useEffect(() => {
    backLatest.current = onBack
  }, [onBack])
  useEffect(() => {
    const leave = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('dialog[open]')) return
      backLatest.current()
    }
    document.addEventListener('keydown', leave)
    return () => document.removeEventListener('keydown', leave)
  }, [])

  return (
    <div className="view year-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">A look back</p>
          <h1 ref={heading} tabIndex={-1}>
            Your garden’s {yearLabel(year)}
          </h1>
          <p>What the year held, as your journal and your garden kept it. Nothing here is a score.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to the Journal
        </button>
      </header>

      {years.length > 1 && (
        <div className="year-choices" role="group" aria-label="Years">
          {years.map((each) => (
            <button
              key={each}
              type="button"
              className="year-choice"
              aria-pressed={each === year}
              onClick={() => {
                if (each !== year) onChooseYear(each)
              }}
            >
              {yearLabel(each)}
            </button>
          ))}
        </div>
      )}

      <section className="card year-summary" aria-labelledby={journalId}>
        <p className="eyebrow">In your journal</p>
        <h2 id={journalId}>What you wrote</h2>
        <p className="year-words">{words.journal}</p>
        {words.care && <p className="year-words">{words.care}</p>}
      </section>

      {anyDayWritten && (
        <YearCalendar year={year} moodByDate={moodByDate} hasEntry={hasEntry} today={today} />
      )}

      <section className="card year-garden" aria-labelledby={gardenId}>
        <p className="eyebrow">In the garden</p>
        <h2 id={gardenId}>Who arrived</h2>
        {words.garden.map((line) => (
          <p className="year-words" key={line}>
            {line}
          </p>
        ))}
      </section>

      <section className="card year-lines" aria-labelledby={linesId}>
        <p className="eyebrow">In your words</p>
        <h2 id={linesId}>Lines you starred</h2>
        {facts.lines.length > 0 ? (
          <ul className="year-quotes">
            {facts.lines.map((line) => (
              <li key={`${line.kind}-${line.localDate}`}>
                <figure className="year-quote">
                  <figcaption>You wrote, on {formatDayInWords(line.localDate)}:</figcaption>
                  <blockquote>
                    <p>{line.text}</p>
                  </blockquote>
                </figure>
              </li>
            ))}
          </ul>
        ) : (
          <p className="year-note">
            {quotes === 'never'
              ? 'Your words are never quoted, as you chose in Settings.'
              : 'A line you star in your journal can be kept here.'}
          </p>
        )}
      </section>

      <Postcard key={year} state={state} year={year} today={today} />
    </div>
  )
}
