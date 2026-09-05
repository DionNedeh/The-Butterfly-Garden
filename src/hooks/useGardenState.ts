import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  gardenRepository,
  readImportedState,
  type LoadResult,
} from '../repository/gardenRepository'
import { createId } from '../lib/id'
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

/** Tabs tell each other when the shared garden changed underneath them. */
const SYNC_CHANNEL = 'butterfly-garden-sync'

export interface PersistenceStatus {
  /**
   * True when the stored garden could not be read. Saving stays disabled so
   * this session can never overwrite data it failed to understand.
   */
  readOnly: boolean
  reason?: LoadResult['reason']
  /** Message from the most recent failed write, if any. */
  writeError?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Your garden could not be saved to this device.'
}

export function useGardenState() {
  const [state, setState] = useState<AppState>()
  const [loading, setLoading] = useState(true)
  const [persistence, setPersistence] = useState<PersistenceStatus>({
    readOnly: false,
  })
  /** The exact object last known to be on disk; never re-saved as-is. */
  const persistedRef = useRef<AppState>(undefined)
  const readOnlyRef = useRef(false)
  const channelRef = useRef<BroadcastChannel>(undefined)

  const applyLoadResult = useCallback((result: LoadResult) => {
    persistedRef.current = result.state
    readOnlyRef.current = result.status === 'withheld'
    setPersistence((current) => ({
      ...current,
      readOnly: result.status === 'withheld',
      reason: result.reason,
    }))
    setState(
      result.status === 'loaded' ? progressGarden(result.state) : result.state,
    )
  }, [])

  useEffect(() => {
    let active = true
    void gardenRepository.load().then((result) => {
      if (!active) return
      applyLoadResult(result)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [applyLoadResult])

  // Another tab wrote the shared garden; adopt its version instead of racing it.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type !== 'garden-saved' || readOnlyRef.current) return
      void gardenRepository.load().then((result) => {
        if (result.status === 'loaded') applyLoadResult(result)
      })
    }
    return () => {
      channel.close()
      channelRef.current = undefined
    }
  }, [applyLoadResult])

  const persist = useCallback(async (next: AppState) => {
    try {
      await gardenRepository.save(next)
      persistedRef.current = next
      setPersistence((current) =>
        current.writeError ? { ...current, writeError: undefined } : current,
      )
      channelRef.current?.postMessage({ type: 'garden-saved' })
    } catch (error) {
      setPersistence((current) => ({
        ...current,
        writeError: errorMessage(error),
      }))
    }
  }, [])

  /**
   * Written straight through rather than debounced. Coalescing writes would
   * save a few milliseconds per action, but it also opens a window where a
   * closed tab loses the reflection someone just wrote — a bad trade for a
   * journal. The reference check below already skips redundant writes, so a
   * state object that did not change is never re-serialised.
   */
  useEffect(() => {
    if (loading || !state || persistence.readOnly) return
    if (state === persistedRef.current) return
    void persist(state)
  }, [loading, state, persistence.readOnly, persist])

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

  // Read-through to the newest state for actions that need to inspect it,
  // without giving those actions a new identity on every render.
  const stateRef = useRef(state)
  stateRef.current = state

  /**
   * Every action keeps a stable identity so memoized views (the month
   * planner in particular) are not re-rendered by the app shell.
   */
  const actions = useMemo(() => ({
    onboard: (name: string, gardenName: string) => {
      setState(createInitialState(name, gardenName))
    },
    addGoal: (
      title: string,
      schedule: GoalSchedule,
      weekdays: number[] = [],
    ) => {
      update((current) => ({
        ...current,
        goals: [
          ...current.goals,
          {
            id: createId(),
            title: title.trim(),
            schedule,
            weekdays,
            createdDate: toLocalDate(),
            archived: false,
          },
        ],
      }))
    },
    updateGoal: (goal: Goal) => {
      update((current) => ({
        ...current,
        goals: current.goals.map((item) => (item.id === goal.id ? goal : item)),
      }))
    },
    /** Retire a goal without discarding the days it was completed. */
    setGoalArchived: (goalId: string, archived: boolean) => {
      update((current) => ({
        ...current,
        goals: current.goals.map((goal) =>
          goal.id === goalId ? { ...goal, archived } : goal,
        ),
      }))
    },
    planGoal: (title: string, scheduledDate: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      update((current) => ({
        ...current,
        goals: [
          ...current.goals,
          {
            id: createId(),
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
    skipGoal: (goalId: string) => {
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
    snoozeGoal: (goalId: string, days: number) => {
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
    wakeGoal: (goalId: string) => {
      update((current) => ({
        ...current,
        goals: current.goals.map((goal) =>
          goal.id === goalId ? { ...goal, snoozedUntil: undefined } : goal,
        ),
      }))
    },
    deleteGoal: (goalId: string) => {
      update((current) => ({
        ...current,
        goals: current.goals.filter((goal) => goal.id !== goalId),
        completions: current.completions.filter(
          (completion) => completion.goalId !== goalId,
        ),
      }))
    },
    completeGoal: (goalId: string) => {
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
    saveMood: (level: MoodEntry['level'], note: string) => {
      const now = new Date()
      const localDate = toLocalDate(now)
      update((current) => {
        const existing = current.moods.find((item) => item.localDate === localDate)
        const entry: MoodEntry = {
          id: existing?.id ?? createId(),
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
    deleteMood: (id: string) => {
      update((current) => ({
        ...current,
        moods: current.moods.filter((item) => item.id !== id),
      }))
    },
    updateMood: (entry: MoodEntry) => {
      update((current) => ({
        ...current,
        moods: current.moods.map((item) =>
          item.id === entry.id
            ? { ...entry, updatedAt: new Date().toISOString() }
            : item,
        ),
      }))
    },
    saveReflection: (promptId: string, body: string) => {
      const now = new Date()
      const localDate = toLocalDate(now)
      update((current) => {
        const existing = current.reflections.find(
          (item) => item.localDate === localDate,
        )
        const entry: ReflectionEntry = {
          id: existing?.id ?? createId(),
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
    updateReflection: (entry: ReflectionEntry) => {
      update((current) => ({
        ...current,
        reflections: current.reflections.map((item) =>
          item.id === entry.id
            ? { ...entry, updatedAt: new Date().toISOString() }
            : item,
        ),
      }))
    },
    deleteReflection: (id: string) => {
      update((current) => ({
        ...current,
        reflections: current.reflections.filter((item) => item.id !== id),
      }))
    },
    plant: (plantId: string) => {
      update((current) => plantSeed(current, plantId))
    },
    careForCreature: (creatureId: string, actionId: string) => {
      update((current) => performCare(current, creatureId, actionId).state)
    },
    purchaseItem: (itemId: string) => {
      update((current) => purchaseShopItem(current, itemId))
    },
    equipItem: (creatureId: string, itemId: string) => {
      update((current) => equipOutfitItem(current, creatureId, itemId))
    },
    unequipSlot: (creatureId: string, slot: OutfitSlot) => {
      update((current) => unequipOutfitSlot(current, creatureId, slot))
    },
    removePlant: (plantId: string) => {
      update((current) => removePlant(current, plantId))
    },
    purchaseFlightPattern: (patternId: FlightPatternId) => {
      update((current) => purchaseFlightPattern(current, patternId))
    },
    selectFlightPattern: (patternId: FlightPatternId) => {
      update((current) => selectFlightPattern(current, patternId))
    },
    purchaseJar: (character: string, colorId: JarColorId) => {
      update((current) => purchaseJar(current, character, colorId))
    },
    placeJar: (jarId: string, plantId: string) => {
      update((current) => placeJar(current, jarId, plantId))
    },
    removeJarPlacement: (plantId: string) => {
      update((current) => removeJarPlacement(current, plantId))
    },
    selectCompanion: (creatureId: string) => {
      update((current) => ({
        ...current,
        profile: current.profile
          ? { ...current.profile, activeCompanionId: creatureId }
          : undefined,
      }))
    },
    renameCreature: (creatureId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      update((current) => ({
        ...current,
        creatures: current.creatures.map((creature) =>
          creature.id === creatureId ? { ...creature, name: trimmed } : creature,
        ),
      }))
    },
    selectBackdrop: (backdropId: GardenBackdropId) => {
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
    toggleAmbientSound: () => {
      update((current) => ({
        ...current,
        profile: current.profile
          ? { ...current.profile, ambientSound: !current.profile.ambientSound }
          : undefined,
      }))
    },
    selectAmbientTrack: (ambientTrack: AmbientTrackId) => {
      update((current) => ({
        ...current,
        profile: current.profile
          ? { ...current.profile, ambientTrack }
          : undefined,
      }))
    },
    toggleTheme: () => {
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
    updateProfile: (name: string, gardenName: string, reducedMotion: boolean) => {
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
    /** A portable copy of the whole garden, for the gardener to keep. */
    exportGarden: (): string => {
      return JSON.stringify(
        {
          format: 'the-butterfly-garden',
          exportedAt: new Date().toISOString(),
          garden: stateRef.current,
        },
        null,
        2,
      )
    },
    /** Replace the garden with a previously exported backup. */
    importGarden: async (
      text: string,
    ): Promise<{ ok: boolean; message: string }> => {
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return { ok: false, message: 'That file is not a garden backup.' }
      }
      const imported = readImportedState(parsed)
      if (!imported) {
        return {
          ok: false,
          message:
            'That backup could not be read. It may be from a newer version of the garden.',
        }
      }
      try {
        await gardenRepository.save(imported)
      } catch (error) {
        return { ok: false, message: errorMessage(error) }
      }
      persistedRef.current = imported
      readOnlyRef.current = false
      setPersistence({ readOnly: false })
      setState(progressGarden(imported))
      setLoading(false)
      return { ok: true, message: 'Your garden was restored from the backup.' }
    },
    deleteAll: async (): Promise<{ ok: boolean; message?: string }> => {
      try {
        await gardenRepository.clear()
      } catch (error) {
        return { ok: false, message: errorMessage(error) }
      }
      persistedRef.current = undefined
      readOnlyRef.current = false
      setPersistence({ readOnly: false })
      setState(undefined)
      setLoading(false)
      return { ok: true }
    },
  }), [update])

  return { state, loading, persistence, ...actions }
}
