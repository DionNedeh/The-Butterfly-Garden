import { useEffect, useMemo, useRef, useState } from 'react'
import { freeWritingPrompt, moodLevels, plants } from '../data/content'
import { goalSuggestions, type GoalSuggestion } from '../data/goalSuggestions'
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
import { GOAL_TITLE_LENGTH } from '../lib/gardenActions'
import { companionsByGoal } from '../lib/growAlongside'
import {
  checkInDetails,
  feelingsFromDraft,
  feelingsToDraft,
  isEnergyLevel,
} from '../lib/feelings'
import { moodChoiceOf } from '../lib/mood'
import { isBreathingGoal, pacerFor } from '../lib/breathing'
import { nextStepsAfter, type NextStep } from '../lib/nextStep'
import { counted } from '../lib/plural'
import { promptAfter, promptById, promptForDay } from '../lib/prompts'
import type { BreatheWay } from '../lib/routes'
import type {
  AppState,
  CheckInDetails,
  Goal,
  GoalSchedule,
  MoodChoice,
  PlantInstance,
} from '../types'
import { CheckInExtras } from './checkin/CheckInExtras'
import { NextStepOffer } from './checkin/NextStepOffer'
import { Icon } from './Icons'
import {
  GoalEditor,
  NO_DAYS_CHOSEN,
  TINY_TITLE_LABEL,
  WeekdayPicker,
  type GoalEdit,
} from './GoalEditor'
import { GoalIdeas } from './GoalIdeas'
import { ComfortLink } from './ComfortLink'
import { GuideLink } from './GuideLink'
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

/**
 * The goals a gentle day shows: the few chosen when the day turned gentle
 * (a list of ids, kept as a draft), or the first few due when the day was
 * made gentle elsewhere, in another tab.
 */
function gentleGoals(dueGoals: readonly Goal[], chosen: string): Goal[] {
  let ids: unknown
  try {
    ids = chosen ? JSON.parse(chosen) : undefined
  } catch {
    ids = undefined
  }
  if (!Array.isArray(ids)) return dueGoals.slice(0, GENTLE_DAY_GOALS)
  return dueGoals.filter((goal) => ids.includes(goal.id))
}

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
  onOpenComfort,
  onSetGentleDay,
  onOpenCare,
  onChooseNextPlant,
  recap,
  moonlightCollected,
  onOpenRecap,
  openAtCheckIn = false,
  onOpenGuide,
  onOpenBreathe,
  onAdoptGoal,
}: {
  state: AppState
  /** Current local date, refreshed across midnight by the app shell. */
  today: string
  onSaveMood: (choice: MoodChoice, note: string, details?: CheckInDetails) => void
  onSaveReflection: (promptId: string, body: string) => void
  onAddGoal: (
    title: string,
    schedule: GoalSchedule,
    weekdays?: number[],
    tinyTitle?: string,
  ) => void
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
  /** The comfort plan: one quiet link while the day is gentle, and only then. */
  onOpenComfort?: () => void
  /** Make today a gentle day, or an ordinary one again. */
  onSetGentleDay?: (gentle: boolean) => void
  onOpenCare?: () => void
  /** Choose which growing plant the next Sunlight tends. */
  onChooseNextPlant?: (plantId: string) => void
  /** Undefined when the recap is not on offer at all, as in a read-only garden. */
  recap?: RecapWindow
  moonlightCollected: boolean
  onOpenRecap: () => void
  /** Opened by the "Check in" shortcut: start at the weather question. */
  openAtCheckIn?: boolean
  /** Open the Guide at a section, from a "What does this do?" link. */
  onOpenGuide?: (section: string) => void
  /**
   * Breathe with a butterfly: from the next step, and a breathing goal's row,
   * named by its goal so that coming back finds the link again.
   */
  onOpenBreathe?: (way: Extract<BreatheWay, 'goal' | 'next-step'>, goalId?: string) => void
  /**
   * Grow a companion alongside a goal again: how Undo gives back the
   * companions that archiving or deleting the goal let go.
   */
  onAdoptGoal?: (creatureId: string, goalId: string) => void
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
  // Feelings and energy are drafted beside the note, so a reload keeps the
  // whole unsaved answer; until changed, they follow the saved check-in.
  const feelingsKey = `mood-feelings:${today}`
  const energyKey = `mood-energy:${today}`
  const [feelingsDraft, setFeelingsDraft] = useDraft(
    feelingsKey,
    feelingsToDraft(existingMood?.feelings ?? []),
  )
  const chosenFeelings = useMemo(() => feelingsFromDraft(feelingsDraft), [feelingsDraft])
  const [energyDraft, setEnergyDraft] = useDraft(energyKey, existingMood?.energy ?? '')
  const energy = isEnergyLevel(energyDraft) ? energyDraft : undefined
  // Said once a check-in has been saved on this visit, never on arrival.
  // Counted, so each save puts the line back and an update is heard too.
  const [saves, setSaves] = useState(0)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalTinyTitle, setGoalTinyTitle] = useState('')
  const goalTitleField = useRef<HTMLInputElement>(null)
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
  const checkInHeading = useRef<HTMLHeadingElement>(null)
  const goalList = useRef<HTMLDivElement>(null)
  const gentleToggle = useRef<HTMLInputElement>(null)
  const saveCheckIn = useRef<HTMLButtonElement>(null)
  const reflectionField = useRef<HTMLTextAreaElement>(null)
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
  // The companions each goal is growing, named quietly on its row.
  const growing = useMemo(() => companionsByGoal(state.creatures), [state.creatures])
  // Archiving or deleting a goal lets its companions go; Undo brings them
  // back together, so these are kept with the offer.
  const growingWith = (goalId: string) =>
    state.creatures
      .filter((creature) => creature.adoptedGoalId === goalId)
      .map((creature) => creature.id)
  const regrow = (creatureIds: readonly string[], goalId: string) => {
    for (const creatureId of creatureIds) onAdoptGoal?.(creatureId, goalId)
  }
  // Snoozed goals count: an idea already among them is not new to anyone.
  const activeGoalTitles = useMemo(
    () => state.goals.filter((goal) => !goal.archived).map((goal) => goal.title),
    [state.goals],
  )
  /** An idea fills the form; the gardener still chooses how often, and adds it. */
  const chooseIdea = (idea: GoalSuggestion) => {
    setGoalTitle(idea.title)
    setGoalTinyTitle(idea.tinyTitle ?? '')
    goalTitleField.current?.focus()
  }
  const sunlight = sunlightForDate(state, today)
  const nextPlant = nextPlantToTend(state)
  const isComplete = (goalId: string) => completed.has(completionKey(goalId, today))
  // A gentle day shows a few goals and no counts, until midnight.
  const gentle = state.profile?.gentleDay === today
  // Both kept as drafts for the day, so leaving Today and coming back (or a
  // reload) does not change them: asked for once, the full list stays; and
  // the few goals chosen when the day turned gentle stay the few, done,
  // snoozed or set aside, so the list never refills itself.
  const [showAll, setShowAll] = useDraft(`gentle-show-all:${today}`, '')
  const showAllGoals = showAll !== ''
  const [gentleGoalIds, setGentleGoalIds] = useDraft(`gentle-goals:${today}`, '')
  const shownGoals =
    gentle && !showAllGoals ? gentleGoals(dueGoals, gentleGoalIds) : dueGoals
  const hiddenGoalCount = dueGoals.length - shownGoals.length
  const completedBefore = (goalId: string) =>
    state.completions.some((item) => item.goalId === goalId && item.localDate < today)
  const setGentle = (on: boolean) => {
    setShowAll('')
    setGentleGoalIds(
      on ? JSON.stringify(dueGoals.slice(0, GENTLE_DAY_GOALS).map((goal) => goal.id)) : '',
    )
    onSetGentleDay?.(on)
  }
  // The goal open in the editor as it is now: a skip or snooze made from its
  // row meanwhile is kept, and an archived or deleted goal is not edited.
  const editing = editingId
    ? state.goals.find((goal) => goal.id === editingId && !goal.archived)
    : undefined
  // One archived or deleted from its row, or in another tab, closes the
  // editor for good, so restoring the goal later does not reopen it.
  if (editingId && !editing) setEditingId(undefined)
  // Bumped by every Edit, so choosing Edit again for the goal already open
  // still takes focus to the editor.
  const [editRequest, setEditRequest] = useState(0)
  // The prompt showing before "Write freely", to return to when it is turned off.
  const [beforeFreeWriting, setBeforeFreeWriting] = useState<string>()
  // One gentle next step under the saved check-in. It belongs to that check-in
  // as it was saved: put away, it stays away for the day (a draft, so a reload
  // agrees), and a rewritten check-in brings an offer of its own.
  const [nextStepSeenFor, setNextStepSeenFor] = useDraft(`next-step:${today}`, '')
  const checkInMark = existingMood ? `${existingMood.id}@${existingMood.updatedAt}` : ''
  const nextSteps =
    existingMood && nextStepSeenFor !== checkInMark
      ? nextStepsAfter(existingMood, {
          canMakeGentle: !gentle && onSetGentleDay !== undefined,
          canReflect: !existingReflection,
          canVisitCompanion: onOpenCare !== undefined,
          canBreathe: onOpenBreathe !== undefined,
        })
      : []
  const putNextStepAway = () => setNextStepSeenFor(checkInMark)
  const takeNextStep = (step: NextStep) => {
    putNextStepAway()
    if (step === 'gentle-day') {
      // The offer goes once the day is gentle; the switch it set does not.
      gentleToggle.current?.focus()
      setGentle(true)
    } else if (step === 'visit-companion') {
      onOpenCare?.()
    } else if (step === 'breathe') {
      onOpenBreathe?.('next-step')
    } else {
      // "Write one line" and "Try today's reflection" both start writing;
      // the field is described by the day's prompt.
      reflectionField.current?.focus()
    }
  }
  const focusAfterRedraw = (goalId = '') => {
    pendingFocus.current = goalId
  }
  const archive = (goal: Goal) => {
    const companions = growingWith(goal.id)
    focusAfterRedraw()
    onSetGoalArchived(goal.id, true)
    setUndoOffer({
      message: `${goal.title} archived.`,
      undo: () => {
        onSetGoalArchived(goal.id, false)
        regrow(companions, goal.id)
      },
    })
  }

  // The "Check in" shortcut skips past everything else on the page, the way
  // a skip link would: the question is read out, and the weathers are next.
  useEffect(() => {
    if (openAtCheckIn) checkInHeading.current?.focus()
  }, [openAtCheckIn])

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
        {onOpenGuide && <GuideLink section="sunlight" topic="Sunlight" onOpen={onOpenGuide} />}
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
        <h2 id="mood-title" ref={checkInHeading} tabIndex={-1}>
          What is your inner weather?
        </h2>
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
        {mood !== undefined && (
          <CheckInExtras
            feelings={chosenFeelings}
            energy={energy}
            onFeelingsChange={(feelings) => setFeelingsDraft(feelingsToDraft(feelings))}
            onEnergyChange={(next) => setEnergyDraft(next ?? '')}
          />
        )}
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
          ref={saveCheckIn}
          className="primary-button check-in-save"
          disabled={mood === undefined}
          aria-describedby={mood === undefined ? 'mood-choose-hint' : undefined}
          onClick={() => {
            if (mood === undefined) return
            onSaveMood(mood, moodNote, checkInDetails({ feelings: chosenFeelings, energy }))
            clearDraft(moodNoteKey, feelingsKey, energyKey)
            setSaves((count) => count + 1)
          }}
        >
          {existingMood ? 'Update check-in' : 'Save check-in'}
        </button>
        {mood === undefined && (
          <p className="subtle-copy" id="mood-choose-hint">
            Choose a weather, or Not sure today. Every answer is welcome.
          </p>
        )}
        {/* Polite, so the confirmation and the offer under it are heard as
            they appear, while focus stays on the button that saved. */}
        <div aria-live="polite">
          {saves > 0 && existingMood && (
            <p key={saves} className="check-in-saved">
              Kept in your journal.
            </p>
          )}
          {existingMood && nextSteps.length > 0 && (
            <NextStepOffer
              checkIn={existingMood}
              steps={nextSteps}
              breatheWith={pacerFor(state).name}
              onChoose={takeNextStep}
              onDismiss={() => {
                // The offer goes; focus waits on the check-in it followed.
                saveCheckIn.current?.focus()
                putNextStepAway()
              }}
            />
          )}
        </div>
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
        {gentle && onOpenComfort && (
          <p className="gentle-note">
            <ComfortLink onOpen={onOpenComfort}>Your comfort plan</ComfortLink> is here if you
            want it.
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
                gentle={gentle}
                companions={growing.get(goal.id)}
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
                onEdit={() => {
                  setEditingId(goal.id)
                  setEditRequest((count) => count + 1)
                }}
                onArchive={() => archive(goal)}
                onBreathe={
                  onOpenBreathe && isBreathingGoal(goal)
                    ? () => onOpenBreathe('goal', goal.id)
                    : undefined
                }
              />
            )
          })}
          {hiddenGoalCount > 0 && (
            <button
              className="text-button goal-list-more"
              onClick={() => {
                revealFrom.current = shownGoals.length
                setShowAll('shown')
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
            focusRequest={editRequest}
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
              const companions = growingWith(editing.id)
              focusAfterRedraw()
              onDeleteGoal(editing.id)
              setEditingId(undefined)
              setUndoOffer({
                message: `${editing.title} deleted.`,
                undo: () => {
                  onRestoreGoal(editing, index, completions)
                  regrow(companions, editing.id)
                },
              })
            }}
            onCancel={() => {
              focusAfterRedraw(editing.id)
              setEditingId(undefined)
            }}
          />
        ) : (
          <form
            className="goal-form add-goal-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!goalTitle.trim() || (schedule === 'weekdays' && weekdays.length === 0)) return
              onAddGoal(
                goalTitle,
                schedule,
                schedule === 'weekdays' ? weekdays : [],
                goalTinyTitle.trim() || undefined,
              )
              setGoalTitle('')
              setGoalTinyTitle('')
            }}
          >
            <GoalIdeas activeGoalTitles={activeGoalTitles} onChoose={chooseIdea} />
            <label className="goal-title-field">
              Add a goal
              <input
                ref={goalTitleField}
                list="suggested-goals"
                value={goalTitle}
                onChange={(event) => setGoalTitle(event.target.value)}
                placeholder="One small act of care"
                maxLength={GOAL_TITLE_LENGTH}
                required
              />
              <datalist id="suggested-goals">
                {goalSuggestions.map((idea) => (
                  <option key={idea.title} value={idea.title} />
                ))}
              </datalist>
            </label>
            <label>
              {TINY_TITLE_LABEL}
              <input
                value={goalTinyTitle}
                onChange={(event) => setGoalTinyTitle(event.target.value)}
                placeholder="For days that ask for less"
                maxLength={GOAL_TITLE_LENGTH}
              />
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
            onClick={() => {
              if (!writingFreely) {
                setBeforeFreeWriting(prompt.id)
                setChosenPromptId(freeWritingPrompt.id)
                return
              }
              // Back to the prompt that was showing, so a reflection is never
              // kept under a question it does not answer.
              const back =
                beforeFreeWriting ??
                (answered && answered.id !== freeWritingPrompt.id ? answered.id : undefined)
              setChosenPromptId(back ?? promptForDay(today).id)
            }}
          >
            Write freely
          </button>
        </div>
        <label className="sr-only" htmlFor="daily-reflection">Your reflection</label>
        <textarea
          ref={reflectionField}
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
