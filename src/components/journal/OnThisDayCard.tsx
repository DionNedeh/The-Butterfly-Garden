import { useId } from 'react'
import { formatJournalDate } from '../../lib/date'
import { moodName } from '../../lib/mood'
import type { OnThisDay } from '../../lib/onThisDay'

const TITLES: Record<OnThisDay['span'], string> = {
  year: 'A year ago today',
  month: 'A month ago today',
}

/**
 * A day from a month or a year ago, offered back at the top of the Journal
 * (lib/onThisDay). Quiet on purpose: it shows what was written, says nothing
 * about it, and can be put away for the rest of the day.
 */
export function OnThisDayCard({
  day,
  onOpenDay,
  onPutAway,
}: {
  day: OnThisDay
  /** Show that day in the timeline. */
  onOpenDay: (localDate: string) => void
  /** Hide the card until tomorrow. */
  onPutAway: () => void
}) {
  const titleId = useId()
  return (
    <section className="card on-this-day" aria-labelledby={titleId}>
      <p className="eyebrow">On this day</p>
      <h2 id={titleId}>{TITLES[day.span]}</h2>
      <p className="on-this-day-date">
        <time dateTime={day.localDate}>{formatJournalDate(day.localDate)}</time>
      </p>
      {day.weather !== undefined && (
        <p className="on-this-day-weather">
          <span className={`weather small weather-${day.weather}`} aria-hidden="true" />
          {moodName(day.weather)}
        </p>
      )}
      {day.firstLine && <p className="on-this-day-words">{day.firstLine}</p>}
      <div className="form-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => onOpenDay(day.localDate)}
        >
          Read that day
        </button>
        <button type="button" className="text-button on-this-day-dismiss" onClick={onPutAway}>
          Put away for today
        </button>
      </div>
    </section>
  )
}
