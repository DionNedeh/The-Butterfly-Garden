import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { moodLevels } from '../data/content'
import { monthDates } from '../lib/date'
import { UNSURE_MOOD_NAME } from '../lib/mood'
import {
  clampMonth,
  compareMonths,
  dayWeatherLabel,
  earliestMonth,
  firstDayOfWeek,
  monthLabel,
  monthOf,
  monthShortLabel,
  monthWeeks,
  shiftMonth,
  weatherClassOf,
  weekdayLabels,
  yearLabel,
  type CalendarMonth,
} from '../lib/weatherCalendar'
import type { MoodEntry } from '../types'
import './weatherCalendar.css'

export interface WeatherCalendarProps {
  /** Check-ins by local date, the index JournalView already keeps. */
  moodByDate: ReadonlyMap<string, MoodEntry>
  /**
   * Whether anything was written on a day: a check-in, a reflection or a
   * recap. Keep it stable between renders (useCallback over the journal's
   * indexes), because the grid is memoised on it.
   */
  hasEntry: (localDate: string) => boolean
  /** The current local date, kept fresh across midnight by the caller. */
  today: string
  /**
   * The oldest day with anything written, so a reflection kept before the
   * first check-in can still be reached. Without it, the first check-in.
   */
  firstDate?: string
  /** Bring that day's entries into view. */
  onOpenDay: (localDate: string) => void
}

type CalendarView = 'month' | 'year'

/** What one day of the grid shows. */
interface CalendarDay {
  date: string
  day: number
  /** Only a day with something written has a name, and only it is a button. */
  label?: string
  /** A weather class, the outline of a day with words but no check-in, or neither. */
  tileClass: string
  isToday: boolean
  isFuture: boolean
}

function describeDay(
  date: string,
  moodByDate: ReadonlyMap<string, MoodEntry>,
  hasEntry: (localDate: string) => boolean,
  today: string,
): CalendarDay {
  const entry = moodByDate.get(date)
  const written = entry !== undefined || hasEntry(date)
  return {
    date,
    day: Number(date.slice(8)),
    label: written ? dayWeatherLabel(date, entry) : undefined,
    tileClass: entry ? weatherClassOf(entry) : written ? 'cal-no-check-in' : 'cal-plain',
    isToday: date === today,
    isFuture: date > today,
  }
}

/** The key, drawn the way the days are, so it reads without colour too. */
const LEGEND = [
  ...moodLevels.map((item) => ({ name: item.name, tileClass: weatherClassOf(item) })),
  { name: UNSURE_MOOD_NAME, tileClass: weatherClassOf({ level: 3, unsure: true }) },
  { name: 'No check-in', tileClass: 'cal-no-check-in' },
]

/**
 * A month, or a year in pixels, coloured by inner weather. Each day with an
 * entry opens it.
 *
 * Descriptive only: nothing here averages, scores, counts or predicts. It
 * shows which weather a day was given, the way the timeline does, laid out so
 * a season can be seen at once.
 */
export const WeatherCalendar = memo(function WeatherCalendar({
  moodByDate,
  hasEntry,
  today,
  firstDate,
  onOpenDay,
}: WeatherCalendarProps) {
  const titleId = useId()
  const yearTitleId = useId()
  const [view, setView] = useState<CalendarView>('month')
  // Opens on the month of the day it is given, never the device clock's: the
  // two disagree in tests, and briefly around midnight at a month's end.
  const [shown, setShown] = useState<CalendarMonth>(() => monthOf(today))
  const [announcement, setAnnouncement] = useState('')
  // Read once: the locale cannot change without a reload.
  const [weekStartsOn] = useState(() => firstDayOfWeek())
  const monthTable = useRef<HTMLTableElement>(null)
  const focusMonthTable = useRef(false)

  const latest = useMemo(() => monthOf(today), [today])
  // Back as far as the first day with anything written (or the first
  // check-in), or no further than this month for an empty garden. Never later
  // than this month, should the device's clock have been turned back.
  const earliest = useMemo(() => {
    const first = earliestMonth(firstDate ? [firstDate] : moodByDate.keys())
    return first && compareMonths(first, latest) < 0 ? first : latest
  }, [firstDate, moodByDate, latest])
  // Held in range as it is drawn rather than when it is set, so deleting the
  // earliest check-in cannot strand the calendar on a month it cannot leave.
  const { year, monthIndex } = clampMonth(shown, earliest, latest)

  const weekdays = useMemo(() => weekdayLabels(weekStartsOn), [weekStartsOn])
  // Only the view on screen is built: a month is at most 31 lookups, a year
  // 366, whatever the size of the journal behind them.
  const monthGrid = useMemo(
    () =>
      view === 'month'
        ? monthWeeks(year, monthIndex, weekStartsOn).map((week) =>
            week.map((date) =>
              date === undefined ? undefined : describeDay(date, moodByDate, hasEntry, today),
            ),
          )
        : [],
    [view, year, monthIndex, weekStartsOn, moodByDate, hasEntry, today],
  )
  const yearGrid = useMemo(
    () =>
      view === 'year'
        ? Array.from({ length: 12 }, (_, index) => ({
            monthIndex: index,
            days: monthDates(year, index).map((date) =>
              describeDay(date, moodByDate, hasEntry, today),
            ),
          }))
        : [],
    [view, year, moodByDate, hasEntry, today],
  )

  // A month chosen from the year view replaces the button that chose it, so
  // focus moves to the month rather than falling back to the page.
  useEffect(() => {
    if (view === 'month' && focusMonthTable.current) {
      focusMonthTable.current = false
      monthTable.current?.focus()
    }
  }, [view])

  const canGoBack =
    view === 'month'
      ? compareMonths({ year, monthIndex }, earliest) > 0
      : year > earliest.year
  const canGoForward =
    view === 'month' ? compareMonths({ year, monthIndex }, latest) < 0 : year < latest.year

  const show = (target: CalendarMonth, nextView: CalendarView) => {
    const next = clampMonth(target, earliest, latest)
    setShown(next)
    setView(nextView)
    setAnnouncement(
      nextView === 'month' ? monthLabel(next.year, next.monthIndex) : yearLabel(next.year),
    )
  }

  // Limits are aria-disabled rather than disabled, so the button keeps focus
  // when it reaches one and a keyboard user is not dropped onto the page.
  const step = (delta: number) => {
    if (delta < 0 ? !canGoBack : !canGoForward) return
    show(
      view === 'month'
        ? shiftMonth({ year, monthIndex }, delta)
        : { year: year + delta, monthIndex },
      view,
    )
  }

  const unit = view === 'month' ? 'month' : 'year'

  return (
    <section className="card weather-calendar" aria-labelledby={titleId}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inner weather</p>
          <h2 id={titleId}>Weather calendar</h2>
        </div>
      </div>
      <p className="section-explainer">
        Each day takes the colour of the weather you gave it. Choose a day to
        read what you wrote.
      </p>

      <div className="cal-toolbar">
        <div className="cal-views" role="group" aria-label="Calendar view">
          <button
            type="button"
            aria-pressed={view === 'month'}
            onClick={() => {
              if (view !== 'month') show({ year, monthIndex }, 'month')
            }}
          >
            Month
          </button>
          <button
            type="button"
            aria-pressed={view === 'year'}
            onClick={() => {
              if (view !== 'year') show({ year, monthIndex }, 'year')
            }}
          >
            Year
          </button>
        </div>
        <div className="cal-steps">
          <button
            type="button"
            className="secondary-button cal-step"
            aria-label={`Previous ${unit}`}
            aria-disabled={!canGoBack}
            onClick={() => step(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="secondary-button cal-step"
            aria-label={`Next ${unit}`}
            aria-disabled={!canGoForward}
            onClick={() => step(1)}
          >
            →
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {view === 'month' ? (
        <table className="cal-month" ref={monthTable} tabIndex={-1}>
          <caption className="cal-period">{monthLabel(year, monthIndex)}</caption>
          <thead>
            <tr>
              {weekdays.map((weekday) => (
                <th scope="col" key={weekday.long}>
                  <span aria-hidden="true">{weekday.short}</span>
                  <span className="sr-only">{weekday.long}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid.map((week, row) => (
              <tr key={row}>
                {week.map((day, column) => (
                  <td key={day?.date ?? `pad-${column}`}>
                    {day && <MonthDay day={day} onOpenDay={onOpenDay} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="cal-year" role="group" aria-labelledby={yearTitleId}>
          <p className="cal-period" id={yearTitleId}>
            {yearLabel(year)}
          </p>
          {yearGrid.map(({ monthIndex: index, days }) => {
            const name = monthLabel(year, index)
            const written = days.some((day) => day.label !== undefined)
            const month = { year, monthIndex: index }
            const future = compareMonths(month, latest) > 0
            const reachable = !future && compareMonths(month, earliest) >= 0
            return (
              <div className="cal-year-row" key={index}>
                {/* The pixels are small by design. The month they belong to
                    is a full-size target that opens it at a size a finger
                    can use. */}
                {reachable ? (
                  <button
                    type="button"
                    className="cal-year-month"
                    aria-label={`${name}, month view`}
                    onClick={() => {
                      focusMonthTable.current = true
                      show(month, 'month')
                    }}
                  >
                    {monthShortLabel(index)}
                  </button>
                ) : (
                  <span className="cal-year-month" aria-hidden="true">
                    {monthShortLabel(index)}
                  </span>
                )}
                <ol
                  className="cal-year-days"
                  aria-label={written ? name : undefined}
                  aria-hidden={written ? undefined : true}
                >
                  {days.map((day) => (
                    <YearDay day={day} onOpenDay={onOpenDay} key={day.date} />
                  ))}
                </ol>
                {/* Months still to come are drawn to complete the year, and
                    say nothing: there is nothing in them yet. */}
                {!written && !future && (
                  <span className="sr-only">{name}: no entries</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <WeatherKey />
    </section>
  )
})

/** The key under a calendar, drawn the way the days are. */
function WeatherKey() {
  return (
    <ul className="cal-legend" aria-label="Key">
      {LEGEND.map((item) => (
        <li key={item.name}>
          <span className={`cal-swatch ${item.tileClass}`} aria-hidden="true" />
          {item.name}
        </li>
      ))}
    </ul>
  )
}

export interface YearCalendarProps {
  year: number
  /** Check-ins by local date. */
  moodByDate: ReadonlyMap<string, MoodEntry>
  /** Whether anything was written on a day. Keep it stable between renders. */
  hasEntry: (localDate: string) => boolean
  /** The current local date, so days still to come are drawn as such. */
  today: string
}

/**
 * One year in pixels, to look at rather than to move through: the page
 * that looks back on a year ("Your garden's year") shows it whole. The same
 * days, colours and key as the Journal's calendar, and as descriptive: each
 * day says only the weather it was given. Nothing here is a button; the
 * Journal's own calendar is where a day is opened.
 */
export const YearCalendar = memo(function YearCalendar({
  year,
  moodByDate,
  hasEntry,
  today,
}: YearCalendarProps) {
  const titleId = useId()
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        monthIndex: index,
        days: monthDates(year, index).map((date) => describeDay(date, moodByDate, hasEntry, today)),
      })),
    [year, moodByDate, hasEntry, today],
  )
  const latest = monthOf(today)
  return (
    <section className="card weather-calendar year-calendar" aria-labelledby={titleId}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inner weather</p>
          <h2 id={titleId}>The year’s weather</h2>
        </div>
      </div>
      <p className="section-explainer">Each day takes the colour of the weather you gave it.</p>
      <div className="cal-year">
        {months.map(({ monthIndex, days }) => {
          const name = monthLabel(year, monthIndex)
          const written = days.some((day) => day.label !== undefined)
          const future = compareMonths({ year, monthIndex }, latest) > 0
          return (
            <div className="cal-year-row" key={monthIndex}>
              <span className="cal-year-month" aria-hidden="true">
                {monthShortLabel(monthIndex)}
              </span>
              <ol
                className="cal-year-days"
                aria-label={written ? name : undefined}
                aria-hidden={written ? undefined : true}
              >
                {days.map((day) => (
                  <li key={day.date} aria-hidden={day.label === undefined ? true : undefined}>
                    <span
                      className={[
                        'cal-pixel',
                        day.tileClass,
                        day.isToday ? 'cal-today' : '',
                        day.isFuture ? 'cal-future' : '',
                      ].join(' ')}
                      role={day.label === undefined ? undefined : 'img'}
                      aria-label={day.label}
                    />
                  </li>
                ))}
              </ol>
              {/* Months still to come complete the year, and say nothing. */}
              {!written && !future && <span className="sr-only">{name}: no entries</span>}
            </div>
          )
        })}
      </div>
      <WeatherKey />
    </section>
  )
})

function MonthDay({
  day,
  onOpenDay,
}: {
  day: CalendarDay
  onOpenDay: (localDate: string) => void
}) {
  const tile = (
    <span
      className={[
        'cal-tile',
        day.tileClass,
        day.isToday ? 'cal-today' : '',
        day.isFuture ? 'cal-future' : '',
      ].join(' ')}
    >
      {day.day}
    </span>
  )
  if (day.label === undefined) {
    return (
      <span className="cal-day" aria-current={day.isToday ? 'date' : undefined}>
        {tile}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="cal-day"
      aria-label={day.label}
      aria-current={day.isToday ? 'date' : undefined}
      onClick={() => onOpenDay(day.date)}
    >
      {tile}
    </button>
  )
}

function YearDay({
  day,
  onOpenDay,
}: {
  day: CalendarDay
  onOpenDay: (localDate: string) => void
}) {
  const className = [
    'cal-pixel',
    day.tileClass,
    day.isToday ? 'cal-today' : '',
    day.isFuture ? 'cal-future' : '',
  ].join(' ')
  // A day with nothing written is left out of what a screen reader hears,
  // so each month's list is only the days that can be opened.
  if (day.label === undefined) {
    return (
      <li aria-hidden="true">
        <span className={className} />
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        className={className}
        aria-label={day.label}
        aria-current={day.isToday ? 'date' : undefined}
        // Not a tab stop: a year of days would be hundreds of them. Each
        // month's name is the keyboard's way in, to a full-size month; a
        // pointer or a screen reader's own cursor still opens a day here.
        tabIndex={-1}
        onClick={() => onOpenDay(day.date)}
      />
    </li>
  )
}
