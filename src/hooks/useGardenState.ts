import { useCallback, useEffect, useMemo, useRef } from 'react'
import { announce } from '../lib/announcer'
import {
  canAddCustomBackdrop,
  checkCustomBackdropRecord,
  putCustomBackdrop,
  removeCustomBackdrop,
  selectCustomBackdrop as selectCustomBackdropIn,
} from '../lib/customBackdrops'
import { toLocalDate, type RecapHours } from '../lib/date'
import { buyFlightPattern, selectFlightPattern } from '../lib/flightPatterns'
import * as act from '../lib/gardenActions'
import { gardenEvents } from '../lib/gardenEvents'
import { hasGardenPassFeature } from '../lib/gardenPass'
import { buyJar, placeJar, removeJarPlacement } from '../lib/jars'
import { performCare } from '../lib/lifecycle'
import type { MotionPreference } from '../lib/motion'
import type { ThemeChoice } from '../lib/theme'
import * as looks from '../lib/outfitPresets'
import { removePlant } from '../lib/plantManagement'
import { isAndroidApp } from '../lib/platform'
import { createInitialState, plantSeed, type RecapDraft } from '../lib/progression'
import type { PurchaseOutcome, PurchaseResult } from '../lib/purchase'
import { requestPersistentStorage } from '../lib/storage'
import {
  buyShopItem,
  equipOutfitItem,
  unequipOutfitSlot,
  wearOutfitPreset,
  type WearLookResult,
} from '../lib/wardrobe'
import { gardenRepository } from '../repository/gardenRepository'
import type {
  AmbientTrackId,
  AppearanceTheme,
  AppState,
  CheckInDetails,
  CustomBackdrop,
  FlightPatternId,
  GardenBackdropId,
  Goal,
  GoalSchedule,
  JarColorId,
  MoodChoice,
  MoodEntry,
  OutfitPreset,
  OutfitSlot,
  RecapEntry,
  ReflectionEntry,
  TextSize,
} from '../types'
import { useMediaSaves, type MediaResult } from './useMediaSaves'
import { usePersistence } from './usePersistence'

export type { PersistenceStatus } from './usePersistence'

/** A goal chosen while the garden is made: a title, and perhaps its two-minute version. */
export type StarterGoal = Pick<Goal, 'title' | 'tinyTitle'>

/**
 * The garden and everything that can be done to it.
 *
 * Composed from three parts, each with one job:
 * - usePersistence: reading and writing the garden, other tabs, restores;
 * - useMediaSaves: image saves that answer once their write lands;
 * - lib/gardenActions and the other lib modules: what each action does,
 *   as plain functions of the garden.
 *
 * What is left here is the wiring: reading the clock, routing each action
 * through `update`, and marking the moments the gardener brought about.
 */
export function useGardenState() {
  const media = useMediaSaves()
  const { state, setState, loading, persistence, setPersistence, readOnlyRef, lifecycle } =
    usePersistence(gardenRepository, media)

  /** Set by update(): the next state change is the gardener's own doing. */
  const localChange = useRef(false)
  const update = useCallback(
    (recipe: (current: AppState) => AppState) => {
      setState((current) => {
        if (!current) return current
        const next = recipe(current)
        // Only a real change: a no-op left flagged would let the next sync
        // from another tab be announced as this gardener's doing.
        if (next !== current) localChange.current = true
        return next
      })
    },
    [setState],
  )

  // Mark what the gardener's own actions brought about. Only those: a sync
  // from another tab, a load or a restore is not a moment to celebrate here.
  const announcedFrom = useRef<AppState | undefined>(undefined)
  useEffect(() => {
    const previous = announcedFrom.current
    announcedFrom.current = state
    if (!localChange.current) return
    localChange.current = false
    if (previous && state) announce(gardenEvents(previous, state))
  }, [state])

  // Read-through to the newest state for actions that need to inspect it,
  // without giving those actions a new identity on every render.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  /**
   * Every action keeps a stable identity so memoized views (the month
   * planner in particular) are not re-rendered by the app shell.
   */
  const actions = useMemo(() => {
    /**
     * Make a purchase and say how it went.
     *
     * The outcome is worked out on the newest garden, and that same result
     * is what the update applies. The read-through moves on with it, so a
     * second purchase made before React has drawn the first is told about
     * the garden after the first, not the one before. Only if another tab's
     * change lands in between does the purchase run again on the newer
     * garden, which still refuses anything it cannot pay for.
     */
    const purchase = (buy: (current: AppState) => PurchaseResult): PurchaseOutcome => {
      const newest = stateRef.current
      if (!newest) return { kind: 'unavailable', reason: 'unknown' }
      const result = buy(newest)
      if (result.state !== newest) stateRef.current = result.state
      update((current) => (current === newest ? result.state : buy(current).state))
      return result.outcome
    }
    return {
      /**
       * Make the garden, with any starter goals chosen on the way in. They
       * are added by the same reducer as a goal added on Today, as daily
       * goals, in the one write that makes the garden.
       */
      onboard: (name: string, gardenName: string, starterGoals: readonly StarterGoal[] = []) => {
        const today = toLocalDate()
        setState(
          starterGoals.reduce(
            (garden, goal) =>
              act.addGoal(garden, goal.title, 'daily', [], today, goal.tinyTitle),
            createInitialState(name, gardenName),
          ),
        )
        setPersistence((current) =>
          current.notice ? { ...current, notice: undefined } : current,
        )
        // A new garden is the moment to ask the browser to keep it.
        void requestPersistentStorage()
      },
      addGoal: (
        title: string,
        schedule: GoalSchedule,
        weekdays: number[] = [],
        tinyTitle?: string,
      ) => {
        const today = toLocalDate()
        update((current) => act.addGoal(current, title, schedule, weekdays, today, tinyTitle))
      },
      updateGoal: (goal: Goal) => update((current) => act.updateGoal(current, goal)),
      setGoalArchived: (goalId: string, archived: boolean) =>
        update((current) => act.setGoalArchived(current, goalId, archived)),
      planGoal: (title: string, scheduledDate: string) => {
        if (!title.trim()) return
        const today = toLocalDate()
        update((current) => act.planGoal(current, title, scheduledDate, today))
      },
      skipGoal: (goalId: string) => {
        const today = toLocalDate()
        update((current) => act.skipGoal(current, goalId, today))
      },
      snoozeGoal: (goalId: string, days: number) => {
        const today = toLocalDate()
        update((current) => act.snoozeGoal(current, goalId, days, today))
      },
      wakeGoal: (goalId: string) => update((current) => act.wakeGoal(current, goalId)),
      deleteGoal: (goalId: string) => update((current) => act.deleteGoal(current, goalId)),
      completeGoal: (goalId: string) => {
        const now = new Date()
        update((current) => act.completeGoal(current, goalId, now))
      },
      uncompleteGoal: (goalId: string, localDate: string) =>
        update((current) => act.uncompleteGoal(current, goalId, localDate)),
      restoreGoal: (goal: Goal, index: number, completions: AppState['completions']) =>
        update((current) => act.restoreGoal(current, goal, index, completions)),
      saveMood: (choice: MoodChoice, note: string, details?: CheckInDetails) => {
        const now = new Date()
        update((current) => act.saveMood(current, choice, note, now, details))
        // The first thing written in the journal is the other moment to ask.
        void requestPersistentStorage()
      },
      deleteMood: (id: string) => update((current) => act.deleteMood(current, id)),
      updateMood: (entry: MoodEntry) => {
        const now = new Date()
        update((current) => act.updateMood(current, entry, now))
      },
      saveReflection: (promptId: string, body: string) => {
        const now = new Date()
        update((current) => act.saveReflection(current, promptId, body, now))
        void requestPersistentStorage()
      },
      updateReflection: (entry: ReflectionEntry) => {
        const now = new Date()
        update((current) => act.updateReflection(current, entry, now))
      },
      deleteReflection: (id: string) =>
        update((current) => act.deleteReflection(current, id)),
      /** A check-in for a day that has passed, marked as written later; it earns nothing. */
      addEarlierMood: (localDate: string, choice: MoodChoice, note: string) => {
        const now = new Date()
        update((current) => act.addEarlierMood(current, localDate, choice, note, now))
        void requestPersistentStorage()
      },
      /** A reflection for a day that has passed, marked as written later; it earns nothing. */
      addEarlierReflection: (localDate: string, body: string) => {
        const now = new Date()
        update((current) => act.addEarlierReflection(current, localDate, body, now))
        void requestPersistentStorage()
      },
      collectMoonlight: (
        localDate: string,
        draft: RecapDraft & { tomorrow?: readonly act.TomorrowNote[] } = {},
      ) => {
        const now = new Date()
        update((current) => act.collectMoonlight(current, localDate, draft, now))
      },
      updateRecap: (entry: RecapEntry) => {
        const now = new Date()
        update((current) => act.updateRecap(current, entry, now))
      },
      deleteRecap: (id: string) => update((current) => act.deleteRecap(current, id)),
      plant: (plantId: string) => update((current) => plantSeed(current, plantId)),
      careForCreature: (creatureId: string, actionId: string) =>
        update((current) => performCare(current, creatureId, actionId).state),
      purchaseItem: (itemId: string, quantity = 1) =>
        purchase((current) => buyShopItem(current, itemId, quantity)),
      equipItem: (creatureId: string, itemId: string) => {
        const now = new Date()
        update((current) => equipOutfitItem(current, creatureId, itemId, undefined, now))
      },
      unequipSlot: (creatureId: string, slot: OutfitSlot) =>
        update((current) => unequipOutfitSlot(current, creatureId, slot)),
      /** Save a companion's outfit as a look; an empty name takes the one suggested. */
      savePreset: (creatureId: string, name: string) =>
        update((current) => looks.saveOutfitPreset(current, creatureId, name)),
      /**
       * Put a saved look on a companion, and say which pieces were left off.
       * Worked out on the newest garden, as a purchase is, so what Care says
       * is what the update applies.
       */
      wearPreset: (creatureId: string, presetId: string): Omit<WearLookResult, 'state'> => {
        const now = new Date()
        const newest = stateRef.current
        if (!newest) return { worn: [], skipped: [] }
        const { state: next, ...outcome } = wearOutfitPreset(newest, creatureId, presetId, undefined, now)
        if (next !== newest) stateRef.current = next
        update((current) =>
          current === newest
            ? next
            : wearOutfitPreset(current, creatureId, presetId, undefined, now).state,
        )
        return outcome
      },
      renamePreset: (presetId: string, name: string) =>
        update((current) => looks.renameOutfitPreset(current, presetId, name)),
      deletePreset: (presetId: string) =>
        update((current) => looks.deleteOutfitPreset(current, presetId)),
      /** Put back a look just deleted, where it was: Undo. */
      restorePreset: (preset: OutfitPreset, index: number) =>
        update((current) => looks.restoreOutfitPreset(current, preset, index)),
      removePlant: (plantId: string) => update((current) => removePlant(current, plantId)),
      purchaseFlightPattern: (patternId: FlightPatternId) =>
        purchase((current) => buyFlightPattern(current, patternId)),
      selectFlightPattern: (patternId: FlightPatternId) =>
        update((current) => selectFlightPattern(current, patternId)),
      purchaseJar: (character: string, colorId: JarColorId) => {
        const now = new Date()
        return purchase((current) => buyJar(current, character, colorId, now))
      },
      placeJar: (jarId: string, plantId: string) =>
        update((current) => placeJar(current, jarId, plantId)),
      removeJarPlacement: (plantId: string) =>
        update((current) => removeJarPlacement(current, plantId)),
      selectCompanion: (creatureId: string) =>
        update((current) => act.selectCompanion(current, creatureId)),
      renameCreature: (creatureId: string, name: string) =>
        update((current) => act.renameCreature(current, creatureId, name)),
      selectBackdrop: (backdropId: GardenBackdropId) => {
        const now = new Date()
        update((current) => act.selectBackdrop(current, backdropId, now))
      },
      /**
       * Save one of the gardener's own images and show it.
       *
       * The record and the reference to it move in a single update, so the
       * garden is never observed pointing at an image that is not there. It
       * goes through the ordinary update path rather than writing to the
       * repository directly, which would race the save effect that owns
       * persistence. The answer comes once that record reaches disk (see
       * useMediaSaves).
       */
      saveCustomBackdrop: async (record: CustomBackdrop): Promise<MediaResult> => {
        if (readOnlyRef.current)
          return {
            ok: false,
            message: 'This garden is read-only. Restore a valid backup first.',
          }
        if (media.waiting())
          return {
            ok: false,
            message: 'Another image is still saving. Please wait a moment.',
          }
        if (!hasGardenPassFeature('custom-backdrops'))
          return {
            ok: false,
            message: isAndroidApp()
              ? 'Your own backdrops come with the Garden Pass.'
              : 'Custom backdrops are not available in this release.',
          }
        const current = stateRef.current
        if (!current) return { ok: false, message: 'Open your garden first.' }
        const check = checkCustomBackdropRecord(record)
        if (!check.ok) return check
        if (!current.customBackdrops.some((entry) => entry.id === record.id)) {
          const capacity = canAddCustomBackdrop(current)
          if (!capacity.ok) return capacity
        }
        return media.waitFor(record, (notCarried) => {
          update((state) => {
            const next = putCustomBackdrop(state, record)
            if (!next.customBackdrops.includes(record)) notCarried()
            return next
          })
        })
      },
      deleteCustomBackdrop: (id: string) =>
        update((current) => removeCustomBackdrop(current, id)),
      selectCustomBackdrop: (id: string | undefined) => {
        if (id === undefined || hasGardenPassFeature('custom-backdrops'))
          update((current) => selectCustomBackdropIn(current, id))
      },
      markReleaseSeen: (releaseId: string) =>
        update((current) => act.markReleaseSeen(current, releaseId)),
      toggleAmbientSound: () => update(act.toggleAmbientSound),
      setAmbientSound: (on: boolean) =>
        update((current) => act.setAmbientSound(current, on)),
      chooseNextPlant: (plantId: string | undefined) =>
        update((current) => act.chooseNextPlant(current, plantId)),
      setGentleDay: (gentle: boolean) => {
        const today = toLocalDate()
        update((current) => act.setGentleDay(current, gentle ? today : undefined))
      },
      setDayCountsHidden: (hidden: boolean) =>
        update((current) => act.setDayCountsHidden(current, hidden)),
      setRecapHours: (hours: RecapHours) =>
        update((current) => act.setRecapHours(current, hours)),
      selectAmbientTrack: (ambientTrack: AmbientTrackId) =>
        update((current) => act.selectAmbientTrack(current, ambientTrack)),
      /** The header's switch, from the theme `showing` (it may be followed). */
      toggleTheme: (showing?: AppearanceTheme) =>
        update((current) => act.toggleTheme(current, showing)),
      chooseTheme: (choice: ThemeChoice) =>
        update((current) => act.chooseTheme(current, choice)),
      setTextSize: (size: TextSize | undefined) =>
        update((current) => act.setTextSize(current, size)),
      updateProfile: (name: string, gardenName: string, motion: MotionPreference) =>
        update((current) => act.updateProfile(current, name, gardenName, motion)),
      /**
       * A portable copy of the whole garden, for the gardener to keep.
       *
       * Refused while the garden is read-only: what is on screen then is a
       * blank stand-in for a garden this build could not read, and a "backup"
       * of it would be an empty file that a later restore trusts. The set-aside
       * copy is what can be downloaded instead (see `quarantinedCopy`).
       */
      exportGarden: (): string | undefined => {
        if (readOnlyRef.current) return undefined
        return JSON.stringify(
          {
            format: 'the-butterfly-garden',
            exportedAt: new Date().toISOString(),
            appVersion: __APP_VERSION__,
            garden: stateRef.current,
          },
          null,
          2,
        )
      },
      /**
       * A copy from `exportGarden` reached the gardener: saved, downloaded or
       * shared. `madeAt` is when it was exported, so anything written while
       * the save screen was open still counts as new.
       */
      recordBackup: (madeAt: Date) =>
        update((current) => act.recordBackup(current, madeAt)),
    }
  }, [update, media, setState, setPersistence, readOnlyRef])

  return { state, loading, persistence, ...lifecycle, ...actions }
}
