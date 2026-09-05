import { memo, useMemo, useState } from 'react'
import {
  isGoalPlannedOn,
  isGoalSkipped,
  localDateToNoon,
  monthDates,
} from '../lib/date'
import type { AppState, Goal, MoodEntry } from '../types'
import { Icon } from './Icons'

const weekdayHeadings = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const moodGlyphs = ['', '🌧', '🌦', '☁️', '🌤', '☀️']

/**
 * A month at a glance: see which goals land on each day, how past days
 * went (sunlight, mood, completions), and plan one-time goals onto any
 * future day.
 */
interface DayInfo {
  planned: Goal[]
  completedGoalIds: Set<string>
  completions: number
  mood?: MoodEntry
  sunlight: number
}

const EMPTY_DAY: DayInfo = {
  planned: [],
  completedGoalIds: new Set(),
  completions: 0,
  mood: undefined,
  sunlight: 0,
}

export const MonthPlanner = memo(function MonthPlanner({
  state,
  today,
  onPlanGoal,
}: {
  state: AppState
  /** Current local date, refreshed across midnight by the app shell. */
  today: string
  onPlanGoal: (title: string, scheduledDate: string) => void
}) {
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

  /**
   * One indexed pass over the whole history per data change, instead of
   * re-scanning goals, completions, moods and sunlight for every day drawn.
   * With a few years of entries the old shape cost several milliseconds on
   * every keystroke in the surrounding Today form.
   */
  const byDate = useMemo(() => {
    const index = new Map<string, DayInfo>()
    const dayFor = (date: string): DayInfo => {
      let day = index.get(date)
      if (!day) {
        day = {
          planned: [],
          completedGoalIds: new Set(),
          completions: 0,
          mood: undefined,
          sunlight: 0,
        }
        index.set(date, day)
      }
      return day
    }
    for (const completion of state.completions) {
      const day = dayFor(completion.localDate)
      day.completions += 1
      day.completedGoalIds.add(completion.goalId)
    }
    for (const entry of state.moods) dayFor(entry.localDate).mood = entry
    for (const award of state.sunlight) dayFor(award.localDate).sunlight += 1
    return index
  }, [state.completions, state.moods, state.sunlight])

  /** Goal scheduling still depends on the month on screen, so index that too. */
  const plannedByDate = useMemo(() => {
    const index = new Map<string, Goal[]>()
    for (const date of dates) {
      const planned = state.goals.filter((goal) => isGoalPlannedOn(goal, date))
      if (planned.length) index.set(date, planned)
    }
    return index
  }, [state.goals, dates])

  const dayInfo = (date: string): DayInfo => {
    const base = byDate.get(date) ?? EMPTY_DAY
    const planned = plannedByDate.get(date)
    if (!planned) return base
    return { ...base, planned }
  }

  const selectedPlanned = useMemo(
    () => state.goals.filter((goal) => isGoalPlannedOn(goal, selectedDate)),
    [state.goals, selectedDate],
  )
  const selected: DayInfo = {
    ...(byDate.get(selectedDate) ?? EMPTY_DAY),
    planned: selectedPlanned,
  }
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

      {/* Not role="grid": that promises row/gridcell structure this flat CSS
          grid does not have, which axe flags as critical. Each day is a button
          that announces its own date and counts, so a labelled group is both
          honest and easier to navigate. */}
      <div className="calendar-grid" role="group" aria-label={monthLabel}>
        {weekdayHeadings.map((day) => (
          <span className="calendar-heading" key={day} aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {dates.map((date) => {
          const info = dayInfo(date)
          const dayNumber = Number(date.slice(-2))
          const done = info.completions
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
              aria-label={`${new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).format(localDateToNoon(date))}: ${info.planned.length} goals, ${done} completed`}
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
                        info.completedGoalIds.has(goal.id)
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
              const done = selected.completedGoalIds.has(goal.id)
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
})
