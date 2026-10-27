import { memo, useId, useMemo, useState } from 'react'
import {
  isGoalPlannedOn,
  isGoalSkipped,
  localDateToNoon,
  monthDates,
} from '../lib/date'
import { counted } from '../lib/plural'
import type { AppState, Goal, MoodEntry } from '../types'
import { Icon } from './Icons'

const weekdayHeadings = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Built once at module load. The day formatter used to be constructed inside
 * the calendar loop, so a month of cells rebuilt it thirty-one times on every
 * render -- including on every keystroke in the plan-a-goal field below, since
 * that input re-renders this component. Measured at ~7.7ms per render against
 * ~0.05ms for a shared instance.
 */
const monthLabelFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
})
const dayLabelFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
const moodGlyphs = ['', '🌧', '🌦', '☁️', '🌤', '☀️']
/** "Not sure today": a quiet mark that says a check-in happened, nothing more. */
const UNSURE_GLYPH = '◌'

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

/** Whether the screen is phone-sized, where the month starts folded. */
function phoneSized(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(max-width: 620px)').matches
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
  // Opens on the month of the day it is given, never the device clock's: the
  // two disagree in tests, and briefly around midnight at a month's end.
  const [yearMonth, setYearMonth] = useState(() => {
    const opening = localDateToNoon(today)
    return { year: opening.getFullYear(), month: opening.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [planTitle, setPlanTitle] = useState('')
  // Folded on a phone, where the month under a dozen goals is a long scroll;
  // open wherever there is room for it beside everything else.
  const [open, setOpen] = useState(() => !phoneSized())
  const bodyId = useId()
  const [showRoutines, setShowRoutines] = useState(false)

  const dates = useMemo(
    () => monthDates(yearMonth.year, yearMonth.month),
    [yearMonth],
  )
  const leadingBlanks = localDateToNoon(dates[0]).getDay()
  const monthLabel = monthLabelFormat.format(localDateToNoon(dates[0]))

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
  // One-time goals are what planning is for; routines come round anyway, so
  // a day lists them only when asked.
  const plannedOnce = selected.planned.filter((goal) => goal.schedule === 'once')
  const routines = selected.planned.filter((goal) => goal.schedule !== 'once')
  const listed = showRoutines ? selected.planned : plannedOnce
  const selectedLabel = dayLabelFormat.format(localDateToNoon(selectedDate))
  const isFutureOrToday = selectedDate >= today

  return (
    <section className="card month-planner" aria-labelledby="planner-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Plan the month</p>
          <h2 id="planner-title">Calendar</h2>
        </div>
        <div className="month-planner-actions">
          {open && (
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
          )}
          {/* Stays put either way, so focus is never left behind. */}
          <button
            className="secondary-button compact"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Hide the month' : 'Show the month'}
          </button>
        </div>
      </div>
      <div id={bodyId}>
        {open && (
          <>
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
                    aria-label={`${dayLabelFormat.format(
                      localDateToNoon(date),
                    )}: ${info.planned.length} goals, ${done} completed`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <span className="calendar-day-number">{dayNumber}</span>
                    <span className="calendar-day-marks" aria-hidden="true">
                      {info.mood && (
                        <span className="calendar-mood">
                          {info.mood.unsure ? UNSURE_GLYPH : moodGlyphs[info.mood.level]}
                        </span>
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
              {listed.length === 0 && routines.length === 0 ? (
                <p className="empty-copy">Nothing planned for this day yet.</p>
              ) : (
                <ul className="calendar-goal-list">
                  {listed.map((goal) => {
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
              {routines.length > 0 && (
                <button
                  className="text-button"
                  aria-expanded={showRoutines}
                  onClick={() => setShowRoutines((value) => !value)}
                >
                  {showRoutines
                    ? 'Hide routine goals'
                    : `+ ${counted(routines.length, 'routine goal', 'routine goals')}`}
                </button>
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
          </>
        )}
      </div>
    </section>
  )
})
