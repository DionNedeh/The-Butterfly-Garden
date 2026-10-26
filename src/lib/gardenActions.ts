import type {
  AmbientTrackId,
  AppState,
  GardenBackdropId,
  Goal,
  GoalSchedule,
  MoodEntry,
  RecapEntry,
  ReflectionEntry,
} from '../types'
import { availableBackdropIds } from './appearance'
import { addDaysToLocalDate, toLocalDate } from './date'
import { createId } from './id'
import type { MotionPreference } from './motion'
import {
  awardMoonlight,
  awardSunlight,
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

export function addGoal(
  state: AppState,
  title: string,
  schedule: GoalSchedule,
  weekdays: number[],
  today: string,
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
      },
    ],
  }
}

export function updateGoal(state: AppState, goal: Goal): AppState {
  return {
    ...state,
    goals: state.goals.map((item) => (item.id === goal.id ? goal : item)),
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

/** Today's check-in, written or rewritten, and its Sunlight. */
export function saveMood(
  state: AppState,
  level: MoodEntry['level'],
  note: string,
  now: Date,
): AppState {
  const localDate = toLocalDate(now)
  const existing = state.moods.find((item) => item.localDate === localDate)
  const entry: MoodEntry = {
    id: existing?.id ?? createId(),
    localDate,
    level,
    note: note.trim(),
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
  draft: RecapDraft & { planForTomorrow?: boolean },
  now: Date,
): AppState {
  if (moonlightForDate(state, localDate)) return state

  const title = draft.forTomorrow?.trim() ?? ''
  const plannedGoal: Goal | undefined =
    draft.planForTomorrow && title
      ? {
          id: createId(),
          title,
          schedule: 'once',
          weekdays: [],
          createdDate: toLocalDate(now),
          archived: false,
          scheduledDate: addDaysToLocalDate(localDate, 1),
        }
      : undefined

  const collected = awardMoonlight(
    state,
    localDate,
    { ...draft, plannedGoalId: plannedGoal?.id },
    now,
  )
  return plannedGoal
    ? { ...collected, goals: [...collected.goals, plannedGoal] }
    : collected
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

export function renameCreature(state: AppState, creatureId: string, name: string): AppState {
  const trimmed = name.trim()
  if (!trimmed) return state
  return {
    ...state,
    creatures: state.creatures.map((creature) =>
      creature.id === creatureId ? { ...creature, name: trimmed } : creature,
    ),
  }
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

export function toggleTheme(state: AppState): AppState {
  if (!state.profile) return state
  return {
    ...state,
    profile: {
      ...state.profile,
      theme: state.profile.theme === 'night' ? 'sunlight' : 'night',
    },
  }
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
