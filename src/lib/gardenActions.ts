import type {
  AmbientTrackId,
  AppearanceTheme,
  AppState,
  CheckInDetails,
  GardenBackdropId,
  GardenPace,
  Goal,
  GoalSchedule,
  MoodChoice,
  MoodEntry,
  RecapEntry,
  ReflectionEntry,
  RegionId,
  TextSize,
} from '../types'
import { freeWritingPrompt } from '../data/content'
import { availableBackdropIds } from './appearance'
import {
  addDaysToLocalDate,
  RECAP_GRACE_CHOICES,
  RECAP_OPENS_CHOICES,
  recapHoursOf,
  toLocalDate,
  type RecapHours,
} from './date'
import { checkInDetails } from './feelings'
import { earlierDayProblem } from './earlierDay'
import { createId } from './id'
import { moodFields } from './mood'
import type { MotionPreference } from './motion'
import type { ThemeChoice } from './theme'
import {
  awardMoonlight,
  awardSunlight,
  MAX_PLANT_GROWTH,
  moonlightForDate,
  progressGarden,
  type RecapDraft,
} from './progression'

/**
 * What each everyday action does to a garden, as plain functions of the
 * garden and their inputs. The hook (useGardenState) only decides when, and
 * reads the clock; everything here can be tested without React or storage.
 *
 * Each returns the garden it was given, untouched, when there is nothing to
 * do, so the save effect sees no change and writes nothing.
 */

/** The longest a goal's title is, and so its two-minute version too. */
export const GOAL_TITLE_LENGTH = 120

/**
 * A goal's two-minute version as it is kept: trimmed, no longer than a
 * title, and left out altogether when there is none, so a goal without one
 * looks exactly as it did before there were any.
 */
function tinyTitleField(tinyTitle: string | undefined): Pick<Goal, 'tinyTitle'> {
  const tiny = tinyTitle?.trim().slice(0, GOAL_TITLE_LENGTH).trim()
  return tiny ? { tinyTitle: tiny } : {}
}

export function addGoal(
  state: AppState,
  title: string,
  schedule: GoalSchedule,
  weekdays: number[],
  today: string,
  tinyTitle?: string,
): AppState {
  return {
    ...state,
    goals: [
      ...state.goals,
      {
        id: createId(),
        title: title.trim(),
        schedule,
        weekdays,
        createdDate: today,
        archived: false,
        ...tinyTitleField(tinyTitle),
      },
    ],
  }
}

export function updateGoal(state: AppState, goal: Goal): AppState {
  const { tinyTitle, ...rest } = goal
  const saved: Goal = { ...rest, ...tinyTitleField(tinyTitle) }
  return {
    ...state,
    goals: state.goals.map((item) => (item.id === goal.id ? saved : item)),
  }
}

/** Retire a goal without discarding the days it was completed. */
export function setGoalArchived(
  state: AppState,
  goalId: string,
  archived: boolean,
): AppState {
  return {
    ...state,
    goals: state.goals.map((goal) =>
      goal.id === goalId ? { ...goal, archived } : goal,
    ),
  }
}

export function planGoal(
  state: AppState,
  title: string,
  scheduledDate: string,
  today: string,
): AppState {
  const trimmed = title.trim()
  if (!trimmed) return state
  return {
    ...state,
    goals: [
      ...state.goals,
      {
        id: createId(),
        title: trimmed,
        schedule: 'once',
        weekdays: [],
        createdDate: today,
        archived: false,
        scheduledDate,
      },
    ],
  }
}

/** Skip a goal for the day, or take the skip back. */
export function skipGoal(state: AppState, goalId: string, localDate: string): AppState {
  return {
    ...state,
    goals: state.goals.map((goal) => {
      if (goal.id !== goalId) return goal
      const skipped = goal.skippedDates ?? []
      return {
        ...goal,
        skippedDates: skipped.includes(localDate)
          ? skipped.filter((date) => date !== localDate)
          : [...skipped, localDate],
      }
    }),
  }
}

export function snoozeGoal(
  state: AppState,
  goalId: string,
  days: number,
  today: string,
): AppState {
  const until = addDaysToLocalDate(today, Math.max(1, days))
  return {
    ...state,
    goals: state.goals.map((goal) => {
      if (goal.id !== goalId) return goal
      return {
        ...goal,
        snoozedUntil: until,
        // A snoozed planned goal moves to its new day.
        scheduledDate:
          goal.schedule === 'once' && goal.scheduledDate ? until : goal.scheduledDate,
      }
    }),
  }
}

export function wakeGoal(state: AppState, goalId: string): AppState {
  return {
    ...state,
    goals: state.goals.map((goal) =>
      goal.id === goalId ? { ...goal, snoozedUntil: undefined } : goal,
    ),
  }
}

/** A goal and every day it was completed. */
export function deleteGoal(state: AppState, goalId: string): AppState {
  return {
    ...state,
    goals: state.goals.filter((goal) => goal.id !== goalId),
    completions: state.completions.filter((completion) => completion.goalId !== goalId),
  }
}

/**
 * Put back a goal that was just deleted, where it was, with its completions.
 *
 * What makes Delete undoable. A goal that is somehow already back is left
 * alone rather than doubled.
 */
export function restoreGoal(
  state: AppState,
  goal: Goal,
  index: number,
  completions: AppState['completions'],
): AppState {
  if (state.goals.some((item) => item.id === goal.id)) return state
  const goals = [...state.goals]
  goals.splice(Math.max(0, Math.min(index, goals.length)), 0, goal)
  const known = new Set(state.completions.map((completion) => completion.id))
  return {
    ...state,
    goals,
    completions: [
      ...state.completions,
      ...completions.filter((completion) => !known.has(completion.id)),
    ],
  }
}

/**
 * Take back a goal marked done by mistake.
 *
 * The completion goes; any Sunlight it earned stays, the way deleting a
 * check-in never takes its Sunlight back. Completing it again earns nothing
 * more, because each completion's Sunlight is awarded once.
 */
export function uncompleteGoal(
  state: AppState,
  goalId: string,
  localDate: string,
): AppState {
  const id = `${goalId}:${localDate}`
  if (!state.completions.some((item) => item.id === id)) return state
  return {
    ...state,
    completions: state.completions.filter((item) => item.id !== id),
  }
}

/** Mark a goal done for the day, once, and earn its Sunlight. */
export function completeGoal(state: AppState, goalId: string, now: Date): AppState {
  const localDate = toLocalDate(now)
  const id = `${goalId}:${localDate}`
  if (state.completions.some((item) => item.id === id)) return state
  const completed = {
    ...state,
    completions: [
      ...state.completions,
      { id, goalId, localDate, completedAt: now.toISOString() },
    ],
  }
  return awardSunlight(completed, `goal:${id}`, now)
}

/**
 * Today's check-in, written or rewritten, and its Sunlight.
 *
 * The Sunlight is the same whatever the answer, "not sure" included: it is
 * for checking in, never for the weather chosen, and never for the feelings
 * or energy beside it. Those are stored only when answered, so a rewrite
 * that unchooses them leaves none behind.
 */
export function saveMood(
  state: AppState,
  choice: MoodChoice,
  note: string,
  now: Date,
  details: CheckInDetails = {},
): AppState {
  const localDate = toLocalDate(now)
  const existing = state.moods.find((item) => item.localDate === localDate)
  const entry: MoodEntry = {
    id: existing?.id ?? createId(),
    localDate,
    ...moodFields(choice),
    note: note.trim(),
    ...checkInDetails(details),
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }
  const moods = existing
    ? state.moods.map((item) => (item.id === existing.id ? entry : item))
    : [...state.moods, entry]
  return awardSunlight({ ...state, moods }, `mood:${localDate}`, now)
}

export function updateMood(state: AppState, entry: MoodEntry, now: Date): AppState {
  return {
    ...state,
    moods: state.moods.map((item) =>
      item.id === entry.id ? { ...entry, updatedAt: now.toISOString() } : item,
    ),
  }
}

export function deleteMood(state: AppState, id: string): AppState {
  return { ...state, moods: state.moods.filter((item) => item.id !== id) }
}

/** Today's reflection, written or rewritten, and its Sunlight. */
export function saveReflection(
  state: AppState,
  promptId: string,
  body: string,
  now: Date,
): AppState {
  const localDate = toLocalDate(now)
  const existing = state.reflections.find((item) => item.localDate === localDate)
  const entry: ReflectionEntry = {
    id: existing?.id ?? createId(),
    localDate,
    promptId,
    body: body.trim(),
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }
  const reflections = existing
    ? state.reflections.map((item) => (item.id === existing.id ? entry : item))
    : [...state.reflections, entry]
  return awardSunlight({ ...state, reflections }, `reflection:${localDate}`, now)
}

export function updateReflection(
  state: AppState,
  entry: ReflectionEntry,
  now: Date,
): AppState {
  return {
    ...state,
    reflections: state.reflections.map((item) =>
      item.id === entry.id ? { ...entry, updatedAt: now.toISOString() } : item,
    ),
  }
}

export function deleteReflection(state: AppState, id: string): AppState {
  return { ...state, reflections: state.reflections.filter((item) => item.id !== id) }
}

/** Whether an answer is one the check-in offers. */
function isMoodChoice(choice: unknown): choice is MoodChoice {
  return choice === 'unsure' || (typeof choice === 'number' && [1, 2, 3, 4, 5].includes(choice))
}

/**
 * A check-in for an earlier day, written now, marked as written later.
 *
 * It earns no Sunlight and tends no plant, and it never touches the Sunlight
 * ledger, so it cannot make that day a cared-for one in the rhythm: the care
 * happened today, not then. Refused (the garden handed back as it was) for
 * today or later, before the garden began, or a day that has a check-in.
 */
export function addEarlierMood(
  state: AppState,
  localDate: string,
  choice: MoodChoice,
  note: string,
  now: Date,
): AppState {
  if (!isMoodChoice(choice)) return state
  if (earlierDayProblem(state, localDate, 'check-in', toLocalDate(now))) return state
  const written = now.toISOString()
  const entry: MoodEntry = {
    id: createId(),
    localDate,
    ...moodFields(choice),
    note: note.trim(),
    writtenLater: true,
    createdAt: written,
    updatedAt: written,
  }
  return { ...state, moods: [...state.moods, entry] }
}

/**
 * A reflection for an earlier day, written freely now, marked as written
 * later. Like a check-in written later, it earns nothing. Refused for words
 * that are only spaces, and for the same days as `addEarlierMood`.
 */
export function addEarlierReflection(
  state: AppState,
  localDate: string,
  body: string,
  now: Date,
): AppState {
  const trimmed = body.trim()
  if (!trimmed) return state
  if (earlierDayProblem(state, localDate, 'reflection', toLocalDate(now))) return state
  const written = now.toISOString()
  const entry: ReflectionEntry = {
    id: createId(),
    localDate,
    promptId: freeWritingPrompt.id,
    body: trimmed,
    writtenLater: true,
    createdAt: written,
    updatedAt: written,
  }
  return { ...state, reflections: [...state.reflections, entry] }
}

/**
 * Round out a day and collect its Moonlight.
 *
 * `localDate` is the day being closed, which is not always today: inside the
 * after-midnight grace window it is yesterday, and the goal planned from the
 * tomorrow note is relative to that day rather than to the clock. Closing
 * Tuesday at 1:15am plans for Wednesday -- the day the gardener is standing
 * in -- not Thursday.
 */
export function collectMoonlight(
  state: AppState,
  localDate: string,
  draft: RecapDraft & { tomorrow?: readonly TomorrowNote[]; planForTomorrow?: boolean },
  now: Date,
): AppState {
  if (moonlightForDate(state, localDate)) return state

  // A specific list for tomorrow, written at bedtime, is the version that
  // helped people fall asleep (Scullin et al. 2018), so up to three notes,
  // each of which can become one of tomorrow's goals.
  const notes = (
    draft.tomorrow ??
    (draft.forTomorrow ? [{ text: draft.forTomorrow, plan: draft.planForTomorrow === true }] : [])
  )
    .map((note) => ({ text: note.text.trim(), plan: note.plan }))
    .filter((note) => note.text)
    .slice(0, TOMORROW_NOTES)
  const plannedGoals: Goal[] = notes
    .filter((note) => note.plan)
    .map((note) => ({
      id: createId(),
      // A draft restored from an older build is not held to the field's
      // limit; the note is kept whole, and its goal fits a goal's title.
      title: note.text.slice(0, TOMORROW_NOTE_LENGTH).trim(),
      schedule: 'once',
      weekdays: [],
      createdDate: toLocalDate(now),
      archived: false,
      scheduledDate: addDaysToLocalDate(localDate, 1),
    }))

  const collected = awardMoonlight(
    state,
    localDate,
    {
      level: draft.level,
      wentWell: draft.wentWell,
      settingDown: draft.settingDown,
      forTomorrow: notes.map((note) => note.text).join('\n'),
      plannedGoalId: plannedGoals[0]?.id,
      plannedGoalIds: plannedGoals.map((goal) => goal.id),
    },
    now,
  )
  return plannedGoals.length
    ? { ...collected, goals: [...collected.goals, ...plannedGoals] }
    : collected
}

/** How many notes "Anything for tomorrow?" takes. */
export const TOMORROW_NOTES = 3

/** The longest a note for tomorrow is: a goal's title, since it can become one. */
export const TOMORROW_NOTE_LENGTH = 120

/** Every note for tomorrow, a line each, as the journal edits them together. */
export const TOMORROW_TEXT_LENGTH = TOMORROW_NOTES * (TOMORROW_NOTE_LENGTH + 1) - 1

/** One note for tomorrow, and whether to plan it as a goal. */
export interface TomorrowNote {
  text: string
  plan: boolean
}

export function updateRecap(state: AppState, entry: RecapEntry, now: Date): AppState {
  return {
    ...state,
    recaps: state.recaps.map((item) =>
      item.id === entry.id ? { ...entry, updatedAt: now.toISOString() } : item,
    ),
  }
}

/**
 * Delete a recap. The `moonlight` ledger is deliberately untouched: the night
 * has been collected, and rewriting what was said about it must not pay out
 * again.
 */
export function deleteRecap(state: AppState, id: string): AppState {
  return { ...state, recaps: state.recaps.filter((item) => item.id !== id) }
}

export function selectCompanion(state: AppState, creatureId: string): AppState {
  if (!state.profile) return state
  return { ...state, profile: { ...state.profile, activeCompanionId: creatureId } }
}

/**
 * Name a companion. Naming also answers the offer a new egg arrives with,
 * even when the name chosen is the one it already had: keeping the default
 * is an answer too, and the offer should not be made again.
 */
export function renameCreature(state: AppState, creatureId: string, name: string): AppState {
  const trimmed = name.trim()
  const index = state.creatures.findIndex((creature) => creature.id === creatureId)
  const creature = index === -1 ? undefined : state.creatures[index]
  if (!trimmed || !creature || (creature.name === trimmed && !creature.awaitingName)) {
    return state
  }
  const named = { ...creature, name: trimmed }
  delete named.awaitingName
  const creatures = [...state.creatures]
  creatures[index] = named
  return { ...state, creatures }
}

export function selectBackdrop(
  state: AppState,
  backdropId: GardenBackdropId,
  now: Date,
): AppState {
  const progressed = progressGarden(state, now)
  const profile = progressed.profile
  // Availability, not stored unlocks: a pass scene is choosable while access
  // holds without ever being written into the permanent list.
  if (!profile || !availableBackdropIds(profile).includes(backdropId)) {
    return progressed
  }
  return {
    ...progressed,
    profile: {
      ...profile,
      selectedBackdropId: backdropId,
      // Choosing a built-in scene is a choice to stop showing the gardener's
      // own image. The image itself is kept.
      selectedCustomBackdropId: undefined,
    },
  }
}

/** Remember which release notes have been read. */
export function markReleaseSeen(state: AppState, releaseId: string): AppState {
  if (!state.profile || state.profile.lastSeenReleaseId === releaseId) return state
  return { ...state, profile: { ...state.profile, lastSeenReleaseId: releaseId } }
}

/** Ask the next Sunlight to tend this plant, or the first one growing again. */
export function chooseNextPlant(state: AppState, plantId: string | undefined): AppState {
  if (!state.profile || state.profile.tendFirstPlantId === plantId) return state
  // Only a plant that is here and still growing can be tended next.
  if (
    plantId !== undefined &&
    !state.plants.some((plant) => plant.id === plantId && plant.growth < MAX_PLANT_GROWTH)
  ) {
    return state
  }
  return { ...state, profile: { ...state.profile, tendFirstPlantId: plantId } }
}

/** Make a day gentle, or not; a gentle day ends by itself at midnight. */
export function setGentleDay(state: AppState, localDate: string | undefined): AppState {
  if (!state.profile || state.profile.gentleDay === localDate) return state
  return { ...state, profile: { ...state.profile, gentleDay: localDate } }
}

/**
 * Move the gardener's evening: when the recap opens, and when a late night
 * stops offering the day before. Hours outside the offered choices are ignored.
 */
export function setRecapHours(state: AppState, hours: RecapHours): AppState {
  if (!state.profile) return state
  if (
    !RECAP_OPENS_CHOICES.includes(hours.opensHour) ||
    !RECAP_GRACE_CHOICES.includes(hours.graceEndsHour)
  ) {
    return state
  }
  const current = recapHoursOf(state.profile)
  if (
    current.opensHour === hours.opensHour &&
    current.graceEndsHour === hours.graceEndsHour
  ) {
    return state
  }
  return {
    ...state,
    profile: {
      ...state.profile,
      recapOpensHour: hours.opensHour,
      recapGraceEndsHour: hours.graceEndsHour,
    },
  }
}

/** Show or hide day counts in the journal. Nothing counted is lost either way. */
export function setDayCountsHidden(state: AppState, hidden: boolean): AppState {
  if (!state.profile || (state.profile.hideDayCounts === true) === hidden) return state
  return { ...state, profile: { ...state.profile, hideDayCounts: hidden } }
}

/** Sound on or off; the fade-out timer (hooks/useFadeOut) turns it off too. */
export function setAmbientSound(state: AppState, on: boolean): AppState {
  if (!state.profile || Boolean(state.profile.ambientSound) === on) return state
  return { ...state, profile: { ...state.profile, ambientSound: on } }
}

export function toggleAmbientSound(state: AppState): AppState {
  if (!state.profile) return state
  return {
    ...state,
    profile: { ...state.profile, ambientSound: !state.profile.ambientSound },
  }
}

export function selectAmbientTrack(state: AppState, ambientTrack: AmbientTrackId): AppState {
  if (!state.profile) return state
  return { ...state, profile: { ...state.profile, ambientTrack } }
}

/**
 * The theme Settings offers: Sunlight or Night by hand, or follow the device
 * or the evening (lib/theme).
 *
 * Choosing by hand stops following. Following leaves the hand-chosen theme
 * where it was, so an older build, which knows nothing of following, still
 * opens on the gardener's last choice rather than on a guess.
 */
export function chooseTheme(state: AppState, choice: ThemeChoice): AppState {
  const profile = state.profile
  if (!profile) return state
  if (choice === 'device' || choice === 'evening') {
    if (profile.themeFollows === choice) return state
    return { ...state, profile: { ...profile, themeFollows: choice } }
  }
  if (profile.theme === choice && profile.themeFollows === undefined) return state
  return { ...state, profile: { ...profile, theme: choice, themeFollows: undefined } }
}

/**
 * The header's quick switch: the opposite of what is `showing`, chosen by
 * hand. What is showing may come from following rather than from `theme`, so
 * the shell says which; pressing it stops following, since a switch the next
 * evening quietly undid would feel broken.
 */
export function toggleTheme(state: AppState, showing?: AppearanceTheme): AppState {
  if (!state.profile) return state
  const current = showing ?? state.profile.theme
  return chooseTheme(state, current === 'night' ? 'sunlight' : 'night')
}

/**
 * Keep giving, or Classic again (undefined). Classic stores nothing, so a
 * garden that goes back to it is exactly as it was before there was a
 * choice. Each blooming plant's count is kept either way: Classic only
 * pauses it, so coming back to Keep giving loses no days of care.
 */
export function setGardenPace(state: AppState, pace: GardenPace | undefined): AppState {
  if (!state.profile || state.profile.gardenPace === pace) return state
  const profile = { ...state.profile }
  if (pace === 'keep-giving') profile.gardenPace = pace
  else delete profile.gardenPace
  return { ...state, profile }
}

/**
 * The region the gardener gardens in, or none again (undefined), which is how
 * every garden began: the Guide then marks nothing.
 */
export function setRegion(state: AppState, region: RegionId | undefined): AppState {
  if (!state.profile || state.profile.region === region) return state
  const profile = { ...state.profile }
  if (region === undefined) delete profile.region
  else profile.region = region
  return { ...state, profile }
}

/** Text larger than usual, or the usual size again (undefined). */
export function setTextSize(state: AppState, size: TextSize | undefined): AppState {
  if (!state.profile || state.profile.textSize === size) return state
  return { ...state, profile: { ...state.profile, textSize: size } }
}

export function updateProfile(
  state: AppState,
  name: string,
  gardenName: string,
  motion: MotionPreference,
): AppState {
  if (!state.profile) return state
  return {
    ...state,
    profile: {
      ...state.profile,
      name: name.trim() || state.profile.name,
      gardenName: gardenName.trim() || state.profile.gardenName,
      reducedMotion: motion === 'reduce',
      calmMotion: motion === 'calm',
    },
  }
}

/**
 * Remember that the gardener kept a copy of the garden as it was at `madeAt`:
 * a backup saved, downloaded or shared, or a restore (see Profile.lastBackupAt).
 */
export function recordBackup(state: AppState, madeAt: Date): AppState {
  if (!state.profile || Number.isNaN(madeAt.getTime())) return state
  const lastBackupAt = madeAt.toISOString()
  if (state.profile.lastBackupAt === lastBackupAt) return state
  return { ...state, profile: { ...state.profile, lastBackupAt } }
}
