import { useEffect, useMemo, useRef, useState } from 'react'
import { freeWritingPrompt, moodLevels, plants, suggestedGoals } from '../data/content'
import {
  completionKey,
  formatJournalDate,
  formatWeekday,
  isGoalDue,
  isGoalSkipped,
  recapHoursOf,
  recapOpensAt,
  retiredOnceGoalIds,
  type RecapWindow,
} from '../lib/date'
import {
  DAILY_SEED_REWARD,
  DAILY_SUNLIGHT_CAP,
  MAX_PLANT_GROWTH,
  nextPlantToTend,
  sunlightForDate,
} from '../lib/progression'
import { useSyncedDraft } from '../hooks/useSyncedDraft'
import { clearDraft, useDraft } from '../lib/drafts'
import { moodChoiceOf } from '../lib/mood'
import { counted } from '../lib/plural'
import { promptAfter, promptById, promptForDay } from '../lib/prompts'
import type { AppState, Goal, GoalSchedule, MoodChoice, PlantInstance } from '../types'
import { Icon } from './Icons'
import { GoalEditor, NO_DAYS_CHOSEN, WeekdayPicker, type GoalEdit } from './GoalEditor'
import { GoalRow } from './GoalRow'
import { MonthPlanner } from './MonthPlanner'
import { UndoToast, type UndoOffer } from './UndoToast'

const plantNames = new Map(plants.map((plant) => [plant.id, plant.name]))

/** "Milkweed 2": a plant as the garden's own list names it. */
function plantName(plant: PlantInstance, index: number): string {
  return `${plantNames.get(plant.plantId) ?? 'Plant'} ${index + 1}`
}

/** How many goals a gentle day shows before "show the others". */
const GENTLE_DAY_GOALS = 3

export function TodayView({
  state,
  today,
  onSaveMood,
  onSaveReflection,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onCompleteGoal,
  onSkipGoal,
  onSnoozeGoal,
  onWakeGoal,
  onPlanGoal,
  onSetGoalArchived,
  onUncompleteGoal,
  onRestoreGoal,
  onOpenSupport,
  onSetGentleDay,
  onOpenCare,
  onChooseNextPlant,
  recap,
  moonlightCollected,
  onOpenRecap,
}: {
  state: AppState
  /** Current local date, refreshed across midnight by the app shell. */
  today: string
  onSaveMood: (choice: MoodChoice, note: string) => void
  onSaveReflection: (promptId: string, body: string) => void
  onAddGoal: (title: string, schedule: GoalSchedule, weekdays?: number[]) => void
  onUpdateGoal: (goal: Goal) => void
  onDeleteGoal: (goalId: string) => void
  onCompleteGoal: (goalId: string) => void
  onSkipGoal: (goalId: string) => void
  onSnoozeGoal: (goalId: string, days: number) => void
  onWakeGoal: (goalId: string) => void
  onPlanGoal: (title: string, scheduledDate: string) => void
  onSetGoalArchived: (goalId: string, archived: boolean) => void
  /** Take back a completion made today; its Sunlight stays. */
  onUncompleteGoal: (goalId: string, localDate: string) => void
  /** Put back a goal just deleted, where it was, with its completions. */
  onRestoreGoal: (goal: Goal, index: number, completions: AppState['completions']) => void
  onOpenSupport?: () => void
  /** Make today a gentle day, or an ordinary one again. */
  onSetGentleDay?: (gentle: boolean) => void
  onOpenCare?: () => void
  /** Choose which growing plant the next Sunlight tends. */
  onChooseNextPlant?: (plantId: string) => void
  /** Undefined when the recap is not on offer at all, as in a read-only garden. */
  recap?: RecapWindow
  moonlightCollected: boolean
  onOpenRecap: () => void
}) {
  const existingMood = state.moods.find((entry) => entry.localDate === today)
  const existingReflection = state.reflections.find(
    (entry) => entry.localDate === today,
  )
  // Seeded from the stored entry, and kept in step with edits made in the
  // journal or another tab -- but never at the cost of something half-typed.
  // Nothing is chosen until the gardener chooses: a preselected weather,
  // with Sunlight for saving, made "Overcast" days nobody actually had.
  const [mood, setMood] = useSyncedDraft<MoodChoice | undefined>(
    existingMood ? moodChoiceOf(existingMood) : undefined,
  )
  // Unsaved words are kept as drafts across page changes and reloads, keyed
  // by the day they belong to (lib/drafts.ts).
  const moodNoteKey = `mood-note:${today}`
  const reflectionKey = `reflection:${today}`
  const [moodNote, setMoodNote] = useDraft(moodNoteKey, existingMood?.note ?? '')
  const [goalTitle, setGoalTitle] = useState('')
  const [schedule, setSchedule] = useState<GoalSchedule>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [reflection, setReflection] = useDraft(
    reflectionKey,
    existingReflection?.body ?? '',
  )
  const [editingId, setEditingId] = useState<string>()
  const [undoOffer, setUndoOffer] = useState<UndoOffer>()
  // UndoToast keeps the latest callback itself, so this need not be stable.
  const dismissUndo = () => setUndoOffer(undefined)
  // The prompt the gardener chose ("Another prompt", "Write freely") is a
  // draft beside the words, so the two survive a reload together and a
  // reflection is always kept under the prompt it answered. Otherwise it is
  // the prompt of one already written today, or the day's own.
  const reflectionPromptKey = `reflection-prompt:${today}`
  const [chosenPromptId, setChosenPromptId] = useDraft(reflectionPromptKey, '')
  const answered = existingReflection ? promptById(existingReflection.promptId) : undefined
  const prompt = promptById(chosenPromptId) ?? answered ?? promptForDay(today)
  const writingFreely = prompt.id === freeWritingPrompt.id
  // Where focus goes once the page has redrawn: a goal's ⋯ button by its id,
  // or '' for the Goals heading when the goal it was on has gone. Only set by
  // handlers whose change always redraws the page, so it never lingers.
  const pendingFocus = useRef<string | undefined>(undefined)
  // The first goal "Show the other goals" revealed, to take focus.
  const revealFrom = useRef<number | undefined>(undefined)
  const goalsHeading = useRef<HTMLHeadingElement>(null)
  const goalList = useRef<HTMLDivElement>(null)
  const gentleToggle = useRef<HTMLInputElement>(null)
  // One pass over completions instead of a scan per goal per render.
  const completed = useMemo(
    () =>
      new Set(
        state.completions.map((completion) =>
          completionKey(completion.goalId, completion.localDate),
        ),
      ),
    [state.completions],
  )
  const retired = useMemo(
    () => retiredOnceGoalIds(state.completions, today),
    [state.completions, today],
  )
  const dueGoals = useMemo(
    () =>
      state.goals.filter(
        (goal) =>
          isGoalDue(goal, today) &&
          !(goal.schedule === 'once' && retired.has(goal.id)),
      ),
    [state.goals, today, retired],
  )
  const snoozedGoals = useMemo(
    () =>
      state.goals.filter(
        (goal) =>
          !goal.archived && goal.snoozedUntil && goal.snoozedUntil > today,
      ),
    [state.goals, today],
  )
  const archivedGoals = useMemo(
    () => state.goals.filter((goal) => goal.archived),
    [state.goals],
  )
  const sunlight = sunlightForDate(state, today)
  const nextPlant = nextPlantToTend(state)
  const isComplete = (goalId: string) => completed.has(completionKey(goalId, today))
  // A gentle day shows a few goals still to do and no counts, until midnight.
  const gentle = state.profile?.gentleDay === today
  // Asked for once, the full list stays for the rest of that day.
  const [showAllOn, setShowAllOn] = useState<string>()
  const showAllGoals = showAllOn === today
  // The first few due goals, done or not: completing one does not slide
  // another into its place, so a gentle day's list never refills itself.
  const shownGoals =
    gentle && !showAllGoals ? dueGoals.slice(0, GENTLE_DAY_GOALS) : dueGoals
  const hiddenGoalCount = dueGoals.length - shownGoals.length
  const completedBefore = (goalId: string) =>
    state.completions.some((item) => item.goalId === goalId && item.localDate < today)
  const setGentle = (on: boolean) => {
    setShowAllOn(undefined)
    onSetGentleDay?.(on)
  }
  // The goal open in the editor as it is now: a skip or snooze made from its
  // row meanwhile is kept, and an archived or deleted goal is not edited.
  const editing = editingId
    ? state.goals.find((goal) => goal.id === editingId && !goal.archived)
    : undefined
  const focusAfterRedraw = (goalId = '') => {
    pendingFocus.current = goalId
  }
  const archive = (goal: Goal) => {
    focusAfterRedraw()
    onSetGoalArchived(goal.id, true)
    setUndoOffer({
      message: `${goal.title} archived.`,
      undo: () => onSetGoalArchived(goal.id, false),
    })
  }

  // Focus that had to wait for the page to redraw: a control that removed
  // itself or its row would otherwise leave focus on the page's body.
  useEffect(() => {
    const rows = () =>
      Array.from(goalList.current?.querySelectorAll<HTMLElement>('.goal-row') ?? [])
    if (revealFrom.current !== undefined) {
      const first = rows()[revealFrom.current]
      revealFrom.current = undefined
      first?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
    }
    const pending = pendingFocus.current
    pendingFocus.current = undefined
    if (pending === undefined) return
    const row = pending ? rows().find((item) => item.dataset.goalId === pending) : undefined
    ;(row?.querySelector<HTMLElement>('.goal-menu-button') ?? goalsHeading.current)?.focus()
  })

  return (
    <div className="view today-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">A gentle rhythm</p>
          <h1>Today</h1>
          <p>Small acts of care are enough. Choose what fits this day.</p>
        </div>
        <div
          className="sunlight-meter"
          aria-label={gentle ? 'Sunlight' : `${sunlight} of ${DAILY_SUNLIGHT_CAP} Sunlight earned`}
        >
          <Icon name="sun" size={28} />
          <div>
            <strong>{gentle ? 'Rest counts too' : `${sunlight} / ${DAILY_SUNLIGHT_CAP}`}</strong>
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
      {nextPlant !== -1 && onChooseNextPlant && (
        <div className="next-tend">
          <label>
            Your next Sunlight tends
            <select
              value={state.plants[nextPlant].id}
              onChange={(event) => onChooseNextPlant(event.target.value)}
            >
              {state.plants.map((plant, index) =>
                plant.growth < MAX_PLANT_GROWTH ? (
                  <option key={plant.id} value={plant.id}>
                    {plantName(plant, index)}
                  </option>
                ) : null,
              )}
            </select>
          </label>
        </div>
      )}

      {recap && (
        <section
          className={`card moonlight-card ${recap.open ? 'open' : 'waiting'}`}
          aria-labelledby="moonlight-title"
        >
          <div>
            <p className="eyebrow">
              <Icon name="moon" size={18} />
              Moonlight
            </p>
            <h2 id="moonlight-title">
              {moonlightCollected
                ? 'The day is rounded out.'
                : !recap.open
                  ? 'Moonlight opens this evening.'
                  : recap.state === 'grace' && recap.targetDate
                    ? `Round out ${formatWeekday(recap.targetDate)}`
                    : 'Round out your day'}
            </h2>
            <p>
              {moonlightCollected
                ? 'Your recap is kept in the journal.'
                : !recap.open
                  ? `From ${recapOpensAt(recapHoursOf(state.profile).opensHour)}, you can look back on the day and collect a Moonlight bonus.`
                  : 'A few questions, all of them skippable, and a Moonlight bonus for closing the day.'}
            </p>
          </div>
          {recap.open && !moonlightCollected && (
            <button className="primary-button" onClick={onOpenRecap}>
              Begin
            </button>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="mood-title">
        <p className="eyebrow">No right answer</p>
        <h2 id="mood-title">What is your inner weather?</h2>
        <div className="mood-grid">
          {moodLevels.map((item) => (
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
        <button
          className={`text-button unsure-choice ${mood === 'unsure' ? 'selected' : ''}`}
          aria-pressed={mood === 'unsure'}
          onClick={() => setMood('unsure')}
        >
          Not sure today
        </button>
        <label>
          A note, if you want
          <input
            value={moodNote}
            onChange={(event) => setMoodNote(event.target.value)}
            placeholder="A few words are plenty"
            maxLength={280}
          />
        </label>
        <button
          className="primary-button"
          disabled={mood === undefined}
          aria-describedby={mood === undefined ? 'mood-choose-hint' : undefined}
          onClick={() => {
            if (mood === undefined) return
            onSaveMood(mood, moodNote)
            clearDraft(moodNoteKey)
          }}
        >
          {existingMood ? 'Update check-in' : 'Save check-in'}
        </button>
        {mood === undefined && (
          <p className="subtle-copy" id="mood-choose-hint">
            Choose a weather, or Not sure today. Every answer is welcome.
          </p>
        )}
        {existingMood && existingMood.level <= 2 && !existingMood.unsure && !gentle && onSetGentleDay && (
          <p className="support-link-note">
            Heavy weather can make everything harder.{' '}
            <button
              className="text-button"
              onClick={() => {
                // This line goes once the day is gentle; the switch it set does not.
                gentleToggle.current?.focus()
                setGentle(true)
              }}
            >
              Make today a gentle day
            </button>
          </p>
        )}
        {existingMood?.level === 1 && !existingMood.unsure && onOpenSupport && (
          <p className="support-link-note">
            A stormy day can be a lot to hold.{' '}
            <button className="text-button" onClick={onOpenSupport}>
              If you need support now
            </button>
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="goals-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Care at your pace</p>
            <h2 id="goals-title" ref={goalsHeading} tabIndex={-1}>
              Goals
            </h2>
          </div>
          {!gentle && (
            <span className="count-badge">
              {dueGoals.filter((goal) => isComplete(goal.id)).length} / {dueGoals.length}
            </span>
          )}
        </div>
        {onSetGentleDay && (
          <label className="toggle-row gentle-toggle">
            <span>
              <strong>Gentle day</strong>
              <small>A few small things, no counts. It ends by itself at midnight.</small>
            </span>
            <input
              ref={gentleToggle}
              type="checkbox"
              checked={gentle}
              onChange={(event) => setGentle(event.target.checked)}
            />
          </label>
        )}
        {gentle && (
          <p className="gentle-note">
            Rest counts too. Today asks for very little.
            {onOpenCare && (
              <>
                {' '}
                <button className="text-button" onClick={onOpenCare}>
                  Your companions' care is free
                </button>
              </>
            )}
          </p>
        )}
        <div className="goal-list" ref={goalList}>
          {dueGoals.length === 0 && (
            <p className="empty-copy">Add one small thing you would like to care for.</p>
          )}
          {shownGoals.map((goal) => {
            const skipped = isGoalSkipped(goal, today)
            const complete = isComplete(goal.id)
            return (
              <GoalRow
                key={goal.id}
                goal={goal}
                today={today}
                complete={complete}
                skipped={skipped}
                onComplete={() => {
                  onCompleteGoal(goal.id)
                  setUndoOffer({
                    message: `${goal.title} marked done.`,
                    undo: () => onUncompleteGoal(goal.id, today),
                  })
                }}
                onSkip={() => {
                  onSkipGoal(goal.id)
                  // Skipping toggles, so skipping again is the undo.
                  setUndoOffer(
                    skipped
                      ? undefined
                      : {
                          message: `${goal.title} set aside for today.`,
                          undo: () => onSkipGoal(goal.id),
                        },
                  )
                }}
                onSnooze={(days) => {
                  focusAfterRedraw()
                  onSnoozeGoal(goal.id, days)
                }}
                onEdit={() => setEditingId(goal.id)}
                onArchive={() => archive(goal)}
              />
            )
          })}
          {hiddenGoalCount > 0 && (
            <button
              className="text-button goal-list-more"
              onClick={() => {
                revealFrom.current = shownGoals.length
                setShowAllOn(today)
              }}
            >
              Show the other {counted(hiddenGoalCount, 'goal', 'goals')}
            </button>
          )}
        </div>
        {snoozedGoals.length > 0 && (
          <details className="snoozed-goals">
            <summary>Snoozed ({snoozedGoals.length})</summary>
            <ul>
              {snoozedGoals.map((goal) => (
                <li key={goal.id}>
                  <span>
                    <strong>{goal.title}</strong>
                    <small>
                      Resting until {formatJournalDate(goal.snoozedUntil ?? today)}
                    </small>
                  </span>
                  <button className="text-button" onClick={() => onWakeGoal(goal.id)}>
                    Wake now
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        {archivedGoals.length > 0 && (
          <details className="snoozed-goals">
            <summary>Archived ({archivedGoals.length})</summary>
            <ul>
              {archivedGoals.map((goal) => (
                <li key={goal.id}>
                  <span>
                    <strong>{goal.title}</strong>
                    <small>Kept for your records, hidden from Today</small>
                  </span>
                  <button
                    className="text-button"
                    onClick={() => onSetGoalArchived(goal.id, false)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {editing ? (
          <GoalEditor
            key={editing.id}
            goal={editing}
            today={today}
            completedBefore={retired.has(editing.id) || completedBefore(editing.id)}
            completedToday={isComplete(editing.id)}
            onSave={(edit: GoalEdit) => {
              onUpdateGoal({ ...editing, ...edit })
              focusAfterRedraw(editing.id)
              setEditingId(undefined)
            }}
            onArchive={() => {
              archive(editing)
              setEditingId(undefined)
            }}
            onDelete={() => {
              // Kept here, so the undo can put back the goal and every
              // day it was completed, exactly where they were.
              const index = state.goals.findIndex((goal) => goal.id === editing.id)
              const completions = state.completions.filter(
                (completion) => completion.goalId === editing.id,
              )
              focusAfterRedraw()
              onDeleteGoal(editing.id)
              setEditingId(undefined)
              setUndoOffer({
                message: `${editing.title} deleted.`,
                undo: () => onRestoreGoal(editing, index, completions),
              })
            }}
            onCancel={() => {
              focusAfterRedraw(editing.id)
              setEditingId(undefined)
            }}
          />
        ) : (
          <form
            className="goal-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!goalTitle.trim() || (schedule === 'weekdays' && weekdays.length === 0)) return
              onAddGoal(goalTitle, schedule, schedule === 'weekdays' ? weekdays : [])
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
                maxLength={120}
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
            {schedule === 'weekdays' && <WeekdayPicker weekdays={weekdays} onChange={setWeekdays} />}
            {schedule === 'weekdays' && weekdays.length === 0 && (
              <p className="form-hint" role="alert">
                {NO_DAYS_CHOSEN}
              </p>
            )}
            <button
              className="secondary-button"
              type="submit"
              disabled={schedule === 'weekdays' && weekdays.length === 0}
            >
              Add goal
            </button>
          </form>
        )}
      </section>

      <MonthPlanner state={state} today={today} onPlanGoal={onPlanGoal} />

      <section className="card reflection-card" aria-labelledby="reflection-title">
        <p className="eyebrow">Optional reflection</p>
        {/* Polite, so a new prompt is heard without leaving the button that asked. */}
        <h2 id="reflection-title" aria-live="polite">
          {prompt.text}
        </h2>
        <div className="prompt-choices">
          <button
            className="text-button"
            onClick={() => setChosenPromptId(promptAfter(prompt, today).id)}
          >
            Another prompt
          </button>
          <button
            className="text-button"
            aria-pressed={writingFreely}
            onClick={() =>
              setChosenPromptId(writingFreely ? promptForDay(today).id : freeWritingPrompt.id)
            }
          >
            Write freely
          </button>
        </div>
        <label className="sr-only" htmlFor="daily-reflection">Your reflection</label>
        <textarea
          aria-describedby="reflection-title"
          id="daily-reflection"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          placeholder="Write as much or as little as you like..."
          maxLength={4000}
          rows={5}
        />
        <button
          className="primary-button"
          disabled={!reflection.trim()}
          onClick={() => {
            onSaveReflection(prompt.id, reflection)
            clearDraft(reflectionKey, reflectionPromptKey)
          }}
        >
          {existingReflection ? 'Update reflection' : 'Keep this reflection'}
        </button>
      </section>
      <UndoToast offer={undoOffer} onDone={dismissUndo} />
    </div>
  )
}
