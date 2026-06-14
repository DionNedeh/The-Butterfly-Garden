import { useMemo, useState } from 'react'
import { reflectionPrompts, suggestedGoals } from '../data/content'
import { getDailyPromptIndex, isGoalDue, toLocalDate } from '../lib/date'
import {
  DAILY_SEED_REWARD,
  DAILY_SUNLIGHT_CAP,
  sunlightForDate,
} from '../lib/progression'
import type { AppState, Goal, GoalSchedule, MoodEntry } from '../types'
import { Icon } from './Icons'

const moods: Array<{ level: MoodEntry['level']; name: string; weather: string }> = [
  { level: 1, name: 'Stormy', weather: 'Heavy clouds' },
  { level: 2, name: 'Rainy', weather: 'Gentle rain' },
  { level: 3, name: 'Overcast', weather: 'Soft gray sky' },
  { level: 4, name: 'Bright', weather: 'Sun through leaves' },
  { level: 5, name: 'Radiant', weather: 'Clear warm light' },
]

export function TodayView({
  state,
  onSaveMood,
  onSaveReflection,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onCompleteGoal,
}: {
  state: AppState
  onSaveMood: (level: MoodEntry['level'], note: string) => void
  onSaveReflection: (promptId: string, body: string) => void
  onAddGoal: (title: string, schedule: GoalSchedule, weekdays?: number[]) => void
  onUpdateGoal: (goal: Goal) => void
  onDeleteGoal: (goalId: string) => void
  onCompleteGoal: (goalId: string) => void
}) {
  const today = toLocalDate()
  const existingMood = state.moods.find((entry) => entry.localDate === today)
  const existingReflection = state.reflections.find(
    (entry) => entry.localDate === today,
  )
  const [mood, setMood] = useState<MoodEntry['level']>(
    existingMood?.level ?? 3,
  )
  const [moodNote, setMoodNote] = useState(existingMood?.note ?? '')
  const [goalTitle, setGoalTitle] = useState('')
  const [schedule, setSchedule] = useState<GoalSchedule>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [reflection, setReflection] = useState(existingReflection?.body ?? '')
  const [editingGoal, setEditingGoal] = useState<Goal>()
  const prompt = reflectionPrompts[getDailyPromptIndex(today, reflectionPrompts.length)]
  const dueGoals = useMemo(
    () => state.goals.filter((goal) => isGoalDue(goal, today)),
    [state.goals, today],
  )
  const sunlight = sunlightForDate(state, today)
  const isComplete = (goalId: string) =>
    state.completions.some(
      (completion) =>
        completion.goalId === goalId && completion.localDate === today,
    )

  return (
    <div className="view today-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">A gentle rhythm</p>
          <h1>Today</h1>
          <p>Small acts of care are enough. Choose what fits this day.</p>
        </div>
        <div className="sunlight-meter" aria-label={`${sunlight} of ${DAILY_SUNLIGHT_CAP} Sunlight earned`}>
          <Icon name="sun" size={28} />
          <div>
            <strong>{sunlight} / {DAILY_SUNLIGHT_CAP}</strong>
            <span>Sunlight</span>
          </div>
        </div>
      </header>
      <p className="daily-seed-note">
        <Icon name="seed" size={18} />
        {sunlight > 0
          ? `Today’s ${DAILY_SEED_REWARD} bonus seed is safely in your tray.`
          : `Your first Sunlight today also adds ${DAILY_SEED_REWARD} seed to your tray.`}
      </p>

      <section className="card" aria-labelledby="mood-title">
        <p className="eyebrow">No right answer</p>
        <h2 id="mood-title">What is your inner weather?</h2>
        <div className="mood-grid">
          {moods.map((item) => (
            <button
              key={item.level}
              className={`mood-button ${mood === item.level ? 'selected' : ''}`}
              aria-pressed={mood === item.level}
              onClick={() => setMood(item.level)}
            >
              <span className={`weather weather-${item.level}`} aria-hidden="true" />
              <strong>{item.name}</strong>
              <small>{item.weather}</small>
            </button>
          ))}
        </div>
        <label>
          A note, if you want
          <input
            value={moodNote}
            onChange={(event) => setMoodNote(event.target.value)}
            placeholder="A few words are plenty"
          />
        </label>
        <button
          className="primary-button"
          onClick={() => onSaveMood(mood, moodNote)}
        >
          {existingMood ? 'Update check-in' : 'Save check-in'}
        </button>
      </section>

      <section className="card" aria-labelledby="goals-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Care at your pace</p>
            <h2 id="goals-title">Goals</h2>
          </div>
          <span className="count-badge">
            {dueGoals.filter((goal) => isComplete(goal.id)).length} / {dueGoals.length}
          </span>
        </div>
        <div className="goal-list">
          {dueGoals.length === 0 && (
            <p className="empty-copy">Add one small thing you would like to care for.</p>
          )}
          {dueGoals.map((goal) => (
            <article className={`goal-row ${isComplete(goal.id) ? 'complete' : ''}`} key={goal.id}>
              <button
                className="goal-check"
                onClick={() => onCompleteGoal(goal.id)}
                disabled={isComplete(goal.id)}
                aria-label={
                  isComplete(goal.id)
                    ? `${goal.title} completed`
                    : `Complete ${goal.title}`
                }
              >
                {isComplete(goal.id) ? 'Done' : 'Care'}
              </button>
              <div>
                <strong>{goal.title}</strong>
                <small>
                  {goal.schedule === 'once'
                    ? 'One time'
                    : goal.schedule === 'daily'
                      ? 'Every day'
                      : 'Selected days'}
                </small>
              </div>
              <button className="text-button" onClick={() => setEditingGoal(goal)}>
                Edit
              </button>
            </article>
          ))}
        </div>

        {editingGoal ? (
          <form
            className="goal-form edit-form"
            onSubmit={(event) => {
              event.preventDefault()
              onUpdateGoal(editingGoal)
              setEditingGoal(undefined)
            }}
          >
            <label>
              Edit goal
              <input
                value={editingGoal.title}
                onChange={(event) =>
                  setEditingGoal({ ...editingGoal, title: event.target.value })
                }
                required
              />
            </label>
            <div className="form-actions">
              <button className="secondary-button" type="submit">Save</button>
              <button
                className="text-button danger-text"
                type="button"
                onClick={() => {
                  onDeleteGoal(editingGoal.id)
                  setEditingGoal(undefined)
                }}
              >
                Delete
              </button>
              <button className="text-button" type="button" onClick={() => setEditingGoal(undefined)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form
            className="goal-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!goalTitle.trim()) return
              onAddGoal(goalTitle, schedule, weekdays)
              setGoalTitle('')
            }}
          >
            <label>
              Add a goal
              <input
                list="suggested-goals"
                value={goalTitle}
                onChange={(event) => setGoalTitle(event.target.value)}
                placeholder="One small act of care"
                required
              />
              <datalist id="suggested-goals">
                {suggestedGoals.map((goal) => <option key={goal} value={goal} />)}
              </datalist>
            </label>
            <label>
              Repeat
              <select
                value={schedule}
                onChange={(event) => setSchedule(event.target.value as GoalSchedule)}
              >
                <option value="once">Just once</option>
                <option value="daily">Every day</option>
                <option value="weekdays">Selected days</option>
              </select>
            </label>
            {schedule === 'weekdays' && (
              <fieldset className="weekday-picker">
                <legend>Days</legend>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={weekdays.includes(index)}
                      onChange={() =>
                        setWeekdays((current) =>
                          current.includes(index)
                            ? current.filter((item) => item !== index)
                            : [...current, index],
                        )
                      }
                    />
                    {day}
                  </label>
                ))}
              </fieldset>
            )}
            <button className="secondary-button" type="submit">Add goal</button>
          </form>
        )}
      </section>

      <section className="card reflection-card" aria-labelledby="reflection-title">
        <p className="eyebrow">Optional reflection</p>
        <h2 id="reflection-title">{prompt.text}</h2>
        <label className="sr-only" htmlFor="daily-reflection">Your reflection</label>
        <textarea
          id="daily-reflection"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          placeholder="Write as much or as little as you like..."
          rows={5}
        />
        <button
          className="primary-button"
          disabled={!reflection.trim()}
          onClick={() => onSaveReflection(prompt.id, reflection)}
        >
          {existingReflection ? 'Update reflection' : 'Keep this reflection'}
        </button>
      </section>
    </div>
  )
}
