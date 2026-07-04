import { useMemo, useState } from 'react'
import {
  isGoalPlannedOn,
  isGoalSkipped,
  localDateToNoon,
  monthDates,
  toLocalDate,
} from '../lib/date'
import { sunlightForDate } from '../lib/progression'
import type { AppState } from '../types'
import { Icon } from './Icons'

const weekdayHeadings = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const moodGlyphs = ['', '🌧', '🌦', '☁️', '🌤', '☀️']

/**
 * A month at a glance: see which goals land on each day, how past days
 * went (sunlight, mood, completions), and plan one-time goals onto any
 * future day.
 */
export function MonthPlanner({
  state,
  onPlanGoal,
}: {
  state: AppState
  onPlanGoal: (title: string, scheduledDate: string) => void
}) {
  const today = toLocalDate()
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [planTitle, setPlanTitle] = useState('')

  const dates = useMemo(
    () => monthDates(yearMonth.year, yearMonth.month),
    [yearMonth],
  )
  const leadingBlanks = localDateToNoon(dates[0]).getDay()
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(localDateToNoon(dates[0]))

  const shiftMonth = (delta: number) => {
    setYearMonth(({ year, month }) => {
      const shifted = new Date(year, month + delta, 1)
      return { year: shifted.getFullYear(), month: shifted.getMonth() }
    })
  }

  const dayInfo = (date: string) => {
    const planned = state.goals.filter((goal) => isGoalPlannedOn(goal, date))
    const completions = state.completions.filter(
      (completion) => completion.localDate === date,
    )
    const mood = state.moods.find((entry) => entry.localDate === date)
    return {
      planned,
      completions,
      mood,
      sunlight: sunlightForDate(state, date),
    }
  }

  const selected = dayInfo(selectedDate)
  const selectedLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(localDateToNoon(selectedDate))
  const isFutureOrToday = selectedDate >= today

  return (
    <section className="card month-planner" aria-labelledby="planner-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Plan the month</p>
          <h2 id="planner-title">Calendar</h2>
        </div>
        <div className="month-switch">
          <button
            className="secondary-button compact"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            ←
          </button>
          <strong>{monthLabel}</strong>
          <button
            className="secondary-button compact"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>
      <p className="section-explainer">
        Dots show goals landing on each day; suns and skies show how past
        days went. Pick any upcoming day to plan a one-time goal for it.
      </p>

      <div className="calendar-grid" role="grid" aria-label={monthLabel}>
        {weekdayHeadings.map((day) => (
          <span className="calendar-heading" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {dates.map((date) => {
          const info = dayInfo(date)
          const dayNumber = Number(date.slice(-2))
          const done = info.completions.length
          const isPast = date < today
          return (
            <button
              key={date}
              className={[
                'calendar-day',
                date === today ? 'today' : '',
                date === selectedDate ? 'selected' : '',
                isPast ? 'past' : '',
              ].join(' ')}
              aria-pressed={date === selectedDate}
              aria-label={`${date}: ${info.planned.length} goals, ${done} completed`}
              onClick={() => setSelectedDate(date)}
            >
              <span className="calendar-day-number">{dayNumber}</span>
              <span className="calendar-day-marks" aria-hidden="true">
                {info.mood && (
                  <span className="calendar-mood">{moodGlyphs[info.mood.level]}</span>
                )}
                {info.sunlight > 0 && <span className="calendar-sun" />}
              </span>
              {info.planned.length > 0 && (
                <span className="calendar-goal-dots" aria-hidden="true">
                  {info.planned.slice(0, 4).map((goal) => (
                    <span
                      key={goal.id}
                      className={
                        state.completions.some(
                          (completion) =>
                            completion.goalId === goal.id &&
                            completion.localDate === date,
                        )
                          ? 'done'
                          : isGoalSkipped(goal, date)
                            ? 'skipped'
                            : ''
                      }
                    />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="calendar-day-detail">
        <h3>{selectedLabel}</h3>
        {selected.planned.length === 0 ? (
          <p className="empty-copy">Nothing planned for this day yet.</p>
        ) : (
          <ul className="calendar-goal-list">
            {selected.planned.map((goal) => {
              const done = state.completions.some(
                (completion) =>
                  completion.goalId === goal.id &&
                  completion.localDate === selectedDate,
              )
              const skipped = isGoalSkipped(goal, selectedDate)
              return (
                <li key={goal.id} className={done ? 'done' : skipped ? 'skipped' : ''}>
                  <span>{goal.title}</span>
                  <small>
                    {done
                      ? 'Completed'
                      : skipped
                        ? 'Skipped'
                        : goal.schedule === 'once'
                          ? 'Planned'
                          : 'Routine'}
                  </small>
                </li>
              )
            })}
          </ul>
        )}
        {selected.sunlight > 0 && (
          <p className="calendar-sunlight-note">
            <Icon name="sun" size={16} /> {selected.sunlight} Sunlight gathered.
          </p>
        )}
        {isFutureOrToday ? (
          <form
            className="calendar-plan-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!planTitle.trim()) return
              onPlanGoal(planTitle, selectedDate)
              setPlanTitle('')
            }}
          >
            <label>
              Plan a goal for this day
              <input
                value={planTitle}
                onChange={(event) => setPlanTitle(event.target.value)}
                placeholder="e.g. Water the balcony plants"
                maxLength={80}
              />
            </label>
            <button className="secondary-button compact" type="submit">
              Add to {selectedLabel.split(',')[0]}
            </button>
          </form>
        ) : (
          <p className="empty-copy">Past days are for remembering, not planning.</p>
        )}
      </div>
    </section>
  )
}
