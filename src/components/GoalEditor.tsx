import { useEffect, useRef, useState } from 'react'
import { isLocalDate, LATEST_LOCAL_DATE } from '../lib/date'
import { GOAL_TITLE_LENGTH } from '../lib/gardenActions'
import type { Goal, GoalSchedule } from '../types'
import './goals/goals.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The days of the week a goal repeats on, as checkboxes. */
export function WeekdayPicker({
  weekdays,
  onChange,
}: {
  weekdays: readonly number[]
  onChange: (weekdays: number[]) => void
}) {
  return (
    <fieldset className="weekday-picker">
      <legend>Days</legend>
      {WEEKDAYS.map((day, index) => (
        <label key={day}>
          <input
            type="checkbox"
            checked={weekdays.includes(index)}
            onChange={() =>
              onChange(
                weekdays.includes(index)
                  ? weekdays.filter((item) => item !== index)
                  : [...weekdays, index].sort((a, b) => a - b),
              )
            }
          />
          {day}
        </label>
      ))}
    </fieldset>
  )
}

/** Said when "Selected days" has none: such a goal would never be due. */
export const NO_DAYS_CHOSEN = 'Choose at least one day, or the goal would never come round.'

/** What the editor changes; everything else about the goal is left as it is. */
export type GoalEdit = Pick<
  Goal,
  'title' | 'schedule' | 'weekdays' | 'scheduledDate' | 'tinyTitle'
>

/** The label of a goal's two-minute version, wherever it is written. */
export const TINY_TITLE_LABEL = 'A two-minute version (optional)'

/**
 * Edit everything about a goal, not only its title: how often it repeats,
 * on which days, and the day a one-time goal is planned for.
 *
 * A one-time goal retires once a day it was completed on has passed, so two
 * changes would make a goal vanish: turning a goal completed on an earlier
 * day into a one-time goal, and planning a goal completed today for a later
 * day. Both are refused, with a way forward.
 *
 * Only the edited fields are handed back. The row stays live while the editor
 * is open, so a skip or a snooze made meanwhile must survive the save.
 */
export function GoalEditor({
  goal,
  today,
  completedBefore,
  completedToday,
  focusRequest = 0,
  onSave,
  onArchive,
  onDelete,
  onCancel,
}: {
  goal: Goal
  today: string
  completedBefore: boolean
  completedToday: boolean
  /** Changed by the page to take focus to the editor again. */
  focusRequest?: number
  onSave: (edit: GoalEdit) => void
  onArchive: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(goal.title)
  const [tinyTitle, setTinyTitle] = useState(goal.tinyTitle ?? '')
  const [schedule, setSchedule] = useState<GoalSchedule>(goal.schedule)
  const [weekdays, setWeekdays] = useState<number[]>(
    goal.weekdays.length ? goal.weekdays : [1, 2, 3, 4, 5],
  )
  const [plannedFor, setPlannedFor] = useState(goal.scheduledDate ?? '')
  // The date as the editor opened with it: unchanged here, the goal's own
  // date is saved, so a snooze made from its row meanwhile is kept.
  const [openedWith] = useState(goal.scheduledDate ?? '')
  // The editor opens below the list, away from the row that asked for it,
  // so focus (and a screen reader) is taken to it.
  const titleField = useRef<HTMLInputElement>(null)
  useEffect(() => {
    titleField.current?.focus()
  }, [focusRequest])
  const noDays = schedule === 'weekdays' && weekdays.length === 0
  const onceRefused = schedule === 'once' && goal.schedule !== 'once' && completedBefore
  const laterRefused =
    schedule === 'once' && !onceRefused && completedToday && plannedFor > today
  const badDate = schedule === 'once' && plannedFor !== '' && !isLocalDate(plannedFor)
  const refused = noDays || onceRefused || laterRefused || badDate
  // A goal planned for a day already past stays on Today until it is done,
  // and keeps its date unless the gardener chooses another.
  const earliest =
    goal.scheduledDate && goal.scheduledDate < today ? goal.scheduledDate : today

  return (
    <form
      className="goal-form edit-form"
      // Android's back gesture, like Escape, puts the editor away unsaved.
      data-dismiss-on-back=""
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim() || refused) return
        onSave({
          title: title.trim(),
          tinyTitle: tinyTitle.trim() || undefined,
          schedule,
          weekdays: schedule === 'weekdays' ? weekdays : [],
          scheduledDate:
            schedule !== 'once'
              ? undefined
              : plannedFor === openedWith && goal.schedule === 'once'
                ? goal.scheduledDate
                : plannedFor || undefined,
        })
      }}
    >
      <label className="goal-title-field">
        Edit goal
        <input
          ref={titleField}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={GOAL_TITLE_LENGTH}
          required
        />
      </label>
      <label>
        {TINY_TITLE_LABEL}
        <input
          value={tinyTitle}
          onChange={(event) => setTinyTitle(event.target.value)}
          placeholder="For days that ask for less"
          maxLength={GOAL_TITLE_LENGTH}
        />
      </label>
      <label>
        Repeat
        <select value={schedule} onChange={(event) => setSchedule(event.target.value as GoalSchedule)}>
          <option value="once">Just once</option>
          <option value="daily">Every day</option>
          <option value="weekdays">Selected days</option>
        </select>
      </label>
      {schedule === 'weekdays' && <WeekdayPicker weekdays={weekdays} onChange={setWeekdays} />}
      {schedule === 'once' && !onceRefused && (
        <label>
          Planned for
          <input
            type="date"
            value={plannedFor}
            min={earliest}
            max={LATEST_LOCAL_DATE}
            onChange={(event) => setPlannedFor(event.target.value)}
          />
        </label>
      )}
      {noDays && (
        <p className="form-hint" role="alert">
          {NO_DAYS_CHOSEN}
        </p>
      )}
      {onceRefused && (
        <p className="form-hint" role="alert">
          This goal has been completed before, so it keeps repeating. Archive it
          and add a one-time goal instead.
        </p>
      )}
      {laterRefused && (
        <p className="form-hint" role="alert">
          This goal is already done today, and planning it for a later day would
          retire it. Plan a new one-time goal for that day instead.
        </p>
      )}
      {badDate && (
        <p className="form-hint" role="alert">
          Choose a date with a four-digit year.
        </p>
      )}
      <div className="form-actions">
        <button className="secondary-button" type="submit" disabled={refused}>
          Save
        </button>
        <button
          className="text-button"
          type="button"
          onClick={onArchive}
          title="Stop showing this goal without losing the days you completed it"
        >
          Archive
        </button>
        <button
          className="text-button danger-text"
          type="button"
          onClick={onDelete}
          title="Remove the goal and every record of completing it"
        >
          Delete
        </button>
        <button className="text-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
