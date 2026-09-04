import { useCallback, useEffect, useState } from 'react'
import { addDaysToLocalDate, toLocalDate } from '../lib/date'
import {
  awardSunlight,
  createInitialState,
  plantSeed,
  progressGarden,
} from '../lib/progression'
import {
  purchaseFlightPattern,
  selectFlightPattern,
} from '../lib/flightPatterns'
import {
  placeJar,
  purchaseJar,
  removeJarPlacement,
} from '../lib/jars'
import { performCare } from '../lib/lifecycle'
import {
  equipOutfitItem,
  purchaseShopItem,
  unequipOutfitSlot,
} from '../lib/wardrobe'
import { removePlant } from '../lib/plantManagement'
import { gardenRepository } from '../repository/gardenRepository'
import type {
  AmbientTrackId,
  AppState,
  FlightPatternId,
  GardenBackdropId,
  Goal,
  GoalSchedule,
  JarColorId,
  MoodEntry,
  OutfitSlot,
  ReflectionEntry,
} from '../types'

export function useGardenState() {
  const [state, setState] = useState<AppState>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gardenRepository.load().then((loaded) => {
      setState(progressGarden(loaded))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading && state) void gardenRepository.save(state)
  }, [loading, state])

  useEffect(() => {
    const progress = () => {
      setState((current) => (current ? progressGarden(current) : current))
    }
    const progressWhenVisible = () => {
      if (document.visibilityState === 'visible') progress()
    }

    const interval = window.setInterval(progress, 60_000)
    window.addEventListener('focus', progress)
    document.addEventListener('visibilitychange', progressWhenVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', progress)
      document.removeEventListener('visibilitychange', progressWhenVisible)
    }
  }, [])

  const update = useCallback((recipe: (current: AppState) => AppState) => {
    setState((current) => (current ? recipe(current) : current))
  }, [])

  return {
    state,
    loading,
    onboard(name: string, gardenName: string) {
      setState(createInitialState(name, gardenName))
    },
    addGoal(
      title: string,
      schedule: GoalSchedule,
      weekdays: number[] = [],
    ) {
      update((current) => ({
        ...current,
        goals: [
          ...current.goals,
          {
            id: crypto.randomUUID(),
            title: title.trim(),
            schedule,
            weekdays,
            createdDate: toLocalDate(),
            archived: false,
          },
        ],
      }))
    },
    updateGoal(goal: Goal) {
      update((current) => ({
        ...current,
        goals: current.goals.map((item) => (item.id === goal.id ? goal : item)),
      }))
    },
    planGoal(title: string, scheduledDate: string) {
      const trimmed = title.trim()
      if (!trimmed) return
      update((current) => ({
        ...current,
        goals: [
          ...current.goals,
          {
            id: crypto.randomUUID(),
            title: trimmed,
            schedule: 'once' as const,
            weekdays: [],
            createdDate: toLocalDate(),
            archived: false,
            scheduledDate,
          },
        ],
      }))
    },
    skipGoal(goalId: string) {
      const localDate = toLocalDate()
      update((current) => ({
        ...current,
        goals: current.goals.map((goal) => {
          if (goal.id !== goalId) return goal
          const skipped = goal.skippedDates ?? []
          return {
            ...goal,
            skippedDates: skipped.includes(localDate)
              ? skipped.filter((date) => date !== localDate)
              : [...skipped, localDate],
          }
        }),
      }))
    },
    snoozeGoal(goalId: string, days: number) {
      const until = addDaysToLocalDate(toLocalDate(), Math.max(1, days))
      update((current) => ({
        ...current,
        goals: current.goals.map((goal) => {
          if (goal.id !== goalId) return goal
          return {
            ...goal,
            snoozedUntil: until,
            // A snoozed planned goal moves to its new day.
            scheduledDate:
              goal.schedule === 'once' && goal.scheduledDate
                ? until
                : goal.scheduledDate,
          }
        }),
      }))
    },
    wakeGoal(goalId: string) {
      update((current) => ({
        ...current,
        goals: current.goals.map((goal) =>
          goal.id === goalId ? { ...goal, snoozedUntil: undefined } : goal,
        ),
      }))
    },
    deleteGoal(goalId: string) {
      update((current) => ({
        ...current,
        goals: current.goals.filter((goal) => goal.id !== goalId),
        completions: current.completions.filter(
          (completion) => completion.goalId !== goalId,
        ),
      }))
    },
    completeGoal(goalId: string) {
      const now = new Date()
      const localDate = toLocalDate(now)
      update((current) => {
        const id = `${goalId}:${localDate}`
        if (current.completions.some((item) => item.id === id)) return current
        const completed = {
          ...current,
          completions: [
            ...current.completions,
            { id, goalId, localDate, completedAt: now.toISOString() },
          ],
        }
        return awardSunlight(completed, `goal:${id}`, now)
      })
    },
    saveMood(level: MoodEntry['level'], note: string) {
      const now = new Date()
      const localDate = toLocalDate(now)
      update((current) => {
        const existing = current.moods.find((item) => item.localDate === localDate)
        const entry: MoodEntry = {
          id: existing?.id ?? crypto.randomUUID(),
          localDate,
          level,
          note: note.trim(),
          createdAt: existing?.createdAt ?? now.toISOString(),
          updatedAt: now.toISOString(),
        }
        const moods = existing
          ? current.moods.map((item) => (item.id === existing.id ? entry : item))
          : [...current.moods, entry]
        return awardSunlight(
          { ...current, moods },
          `mood:${localDate}`,
          now,
        )
      })
    },
    deleteMood(id: string) {
      update((current) => ({
        ...current,
        moods: current.moods.filter((item) => item.id !== id),
      }))
    },
    updateMood(entry: MoodEntry) {
      update((current) => ({
        ...current,
        moods: current.moods.map((item) =>
          item.id === entry.id
            ? { ...entry, updatedAt: new Date().toISOString() }
            : item,
        ),
      }))
    },
    saveReflection(promptId: string, body: string) {
      const now = new Date()
      const localDate = toLocalDate(now)
      update((current) => {
        const existing = current.reflections.find(
          (item) => item.localDate === localDate,
        )
        const entry: ReflectionEntry = {
          id: existing?.id ?? crypto.randomUUID(),
          localDate,
          promptId,
          body: body.trim(),
          createdAt: existing?.createdAt ?? now.toISOString(),
          updatedAt: now.toISOString(),
        }
        const reflections = existing
          ? current.reflections.map((item) =>
              item.id === existing.id ? entry : item,
            )
          : [...current.reflections, entry]
        return awardSunlight(
          { ...current, reflections },
          `reflection:${localDate}`,
          now,
        )
      })
    },
    updateReflection(entry: ReflectionEntry) {
      update((current) => ({
        ...current,
        reflections: current.reflections.map((item) =>
          item.id === entry.id
            ? { ...entry, updatedAt: new Date().toISOString() }
            : item,
        ),
      }))
    },
    deleteReflection(id: string) {
      update((current) => ({
        ...current,
        reflections: current.reflections.filter((item) => item.id !== id),
      }))
    },
    plant(plantId: string) {
      update((current) => plantSeed(current, plantId))
    },
    careForCreature(creatureId: string, actionId: string) {
      update((current) => performCare(current, creatureId, actionId).state)
    },
    purchaseItem(itemId: string) {
      update((current) => purchaseShopItem(current, itemId))
    },
    equipItem(creatureId: string, itemId: string) {
      update((current) => equipOutfitItem(current, creatureId, itemId))
    },
    unequipSlot(creatureId: string, slot: OutfitSlot) {
      update((current) => unequipOutfitSlot(current, creatureId, slot))
    },
    removePlant(plantId: string) {
      update((current) => removePlant(current, plantId))
    },
    purchaseFlightPattern(patternId: FlightPatternId) {
      update((current) => purchaseFlightPattern(current, patternId))
    },
    selectFlightPattern(patternId: FlightPatternId) {
      update((current) => selectFlightPattern(current, patternId))
    },
    purchaseJar(character: string, colorId: JarColorId) {
      update((current) => purchaseJar(current, character, colorId))
    },
    placeJar(jarId: string, plantId: string) {
      update((current) => placeJar(current, jarId, plantId))
    },
    removeJarPlacement(plantId: string) {
      update((current) => removeJarPlacement(current, plantId))
    },
    selectCompanion(creatureId: string) {
      update((current) => ({
        ...current,
        profile: current.profile
          ? { ...current.profile, activeCompanionId: creatureId }
          : undefined,
      }))
    },
    renameCreature(creatureId: string, name: string) {
      const trimmed = name.trim()
      if (!trimmed) return
      update((current) => ({
        ...current,
        creatures: current.creatures.map((creature) =>
          creature.id === creatureId ? { ...creature, name: trimmed } : creature,
        ),
      }))
    },
    selectBackdrop(backdropId: GardenBackdropId) {
      update((current) => {
        const progressed = progressGarden(current)
        const profile = progressed.profile
        if (!profile?.unlockedBackdropIds?.includes(backdropId)) return progressed
        return {
          ...progressed,
          profile: { ...profile, selectedBackdropId: backdropId },
        }
      })
    },
    toggleAmbientSound() {
      update((current) => ({
        ...current,
        profile: current.profile
          ? { ...current.profile, ambientSound: !current.profile.ambientSound }
          : undefined,
      }))
    },
    selectAmbientTrack(ambientTrack: AmbientTrackId) {
      update((current) => ({
        ...current,
        profile: current.profile
          ? { ...current.profile, ambientTrack }
          : undefined,
      }))
    },
    toggleTheme() {
      update((current) => ({
        ...current,
        profile: current.profile
          ? {
              ...current.profile,
              theme: current.profile.theme === 'night' ? 'sunlight' : 'night',
            }
          : undefined,
      }))
    },
    updateProfile(name: string, gardenName: string, reducedMotion: boolean) {
      update((current) => ({
        ...current,
        profile: current.profile
          ? {
              ...current.profile,
              name: name.trim() || current.profile.name,
              gardenName: gardenName.trim() || current.profile.gardenName,
              reducedMotion,
            }
          : undefined,
      }))
    },
    async deleteAll() {
      await gardenRepository.clear()
      setState(undefined)
      setLoading(false)
    },
  }
}
