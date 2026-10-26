import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDaysToLocalDate, toLocalDate } from '../lib/date'
import {
  awardMoonlight,
  awardSunlight,
  createInitialState,
  moonlightForDate,
  plantSeed,
  progressGarden,
  type RecapDraft,
} from '../lib/progression'
import {
  purchaseFlightPattern,
  selectFlightPattern,
} from '../lib/flightPatterns'
import { placeJar, purchaseJar, removeJarPlacement } from '../lib/jars'
import { availableBackdropIds } from '../lib/appearance'
import {
  putCustomBackdrop,
  checkCustomBackdropRecord,
  canAddCustomBackdrop,
  removeCustomBackdrop,
  selectCustomBackdrop as selectCustomBackdropIn,
} from '../lib/customBackdrops'
import { hasGardenPassFeature } from '../lib/gardenPass'
import { isAndroidApp } from '../lib/platform'
import { performCare } from '../lib/lifecycle'
import {
  equipOutfitItem,
  purchaseShopItem,
  unequipOutfitSlot,
} from '../lib/wardrobe'
import { removePlant } from '../lib/plantManagement'
import { requestPersistentStorage } from '../lib/storage'
import { loadDrafts, resetDrafts } from '../lib/drafts'
import {
  GardenConflictError,
  GardenDeletedElsewhereError,
  GardenDeletionPendingError,
  gardenRepository,
  inspectImportedState,
  type GardenPart,
  type LoadResult,
} from '../repository/gardenRepository'
import { createId } from '../lib/id'
import type {
  AmbientTrackId,
  AppState,
  CustomBackdrop,
  FlightPatternId,
  GardenBackdropId,
  Goal,
  GoalSchedule,
  JarColorId,
  MoodEntry,
  OutfitSlot,
  RecapEntry,
  ReflectionEntry,
} from '../types'

/** Tabs tell each other when the shared garden changed underneath them. */
const SYNC_CHANNEL = 'butterfly-garden-sync'

/** What tabs say to each other on the sync channel. */
type SyncMessage =
  | { type: 'garden-saved'; parts?: unknown }
  /** A tab is about to delete the garden: stop writing now. */
  | { type: 'garden-clearing' }
  /** The garden is gone: start again from nothing. */
  | { type: 'garden-cleared' }
  /** The deletion did not happen after all: read the garden again. */
  | { type: 'garden-clear-failed' }

/** How long an image save may wait for its write before giving up. */
const MEDIA_SAVE_TIMEOUT_MS = 30_000

/** Retry delays after storage could not be read, in milliseconds. */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]

export interface PersistenceStatus {
  /**
   * True when the stored garden could not be read. Saving stays disabled so
   * this session can never overwrite data it failed to understand.
   */
  readOnly: boolean
  /** Why saving is paused; 'deleting' while another tab deletes the garden. */
  reason?: LoadResult['reason'] | 'deleting'
  /** Message from the most recent failed write, if any. */
  writeError?: string
  /**
   * Something the gardener should know that is not a failure: another tab
   * changed or deleted the garden. Shown once, dismissible.
   */
  notice?: string
  /** The copy taken before the most recent restore, so it can be undone. */
  lastRestoreSnapshotId?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Your garden could not be saved to this device.'
}

type MediaResult = { ok: boolean; message?: string }

export function useGardenState() {
  const [state, setState] = useState<AppState>()
  const [loading, setLoading] = useState(true)
  const [persistence, setPersistence] = useState<PersistenceStatus>({
    readOnly: false,
  })
  /** The exact object last known to be on disk; never re-saved as-is. */
  const persistedRef = useRef<AppState>(undefined)
  /** Image saves waiting for their write, settled exactly once each. */
  const mediaWaiters = useRef(
    new Map<CustomBackdrop, (result: MediaResult) => void>(),
  )
  const readOnlyRef = useRef(false)
  const channelRef = useRef<BroadcastChannel>(undefined)
  const retryRef = useRef<{ timer?: number; attempt: number }>({ attempt: 0 })

  const settleMedia = useCallback((result: MediaResult) => {
    for (const settle of [...mediaWaiters.current.values()]) settle(result)
    mediaWaiters.current.clear()
  }, [])

  const applyLoadResult = useCallback(
    (result: LoadResult) => {
      settleMedia({
        ok: false,
        message:
          'The garden changed in another tab. Please try saving your image again.',
      })
      persistedRef.current = result.state
      readOnlyRef.current = result.status === 'withheld'
      setPersistence((current) => ({
        ...current,
        readOnly: result.status === 'withheld',
        reason: result.reason,
      }))
      setState(
        result.status === 'loaded'
          ? progressGarden(result.state)
          : result.state,
      )
    },
    [settleMedia],
  )

  /**
   * Stop writing while keeping what is on screen.
   *
   * Used when this tab can no longer trust its baseline -- another tab wrote
   * something this build cannot read, or storage stopped answering. The
   * garden stays visible; only saving pauses.
   */
  const pauseSaving = useCallback(
    (reason: PersistenceStatus['reason']) => {
      settleMedia({ ok: false, message: 'Saving is paused right now.' })
      readOnlyRef.current = true
      setPersistence((current) => ({ ...current, readOnly: true, reason }))
    },
    [settleMedia],
  )

  /**
   * Keep trying to read storage after it stopped answering, backing off.
   * Saving stays paused until a read succeeds.
   */
  const retryLoad = useCallback(() => {
    const retry = retryRef.current
    if (retry.timer !== undefined) return
    const delay =
      RETRY_DELAYS_MS[Math.min(retry.attempt, RETRY_DELAYS_MS.length - 1)]
    retry.timer = window.setTimeout(() => {
      retry.timer = undefined
      retry.attempt += 1
      void gardenRepository.load().then((result) => {
        if (result.status === 'loaded') {
          retry.attempt = 0
          applyLoadResult(result)
          setPersistence((current) => ({ ...current, notice: undefined }))
        } else if (result.reason === 'unavailable') {
          retryLoad()
        } else {
          pauseSaving(result.reason)
        }
      })
    }, delay)
  }, [applyLoadResult, pauseSaving])

  /** Another tab deleted the garden: start again from nothing, saving nothing. */
  const resetAfterDeletion = useCallback(
    (notice = 'This garden was deleted in another tab.') => {
      gardenRepository.forget()
      settleMedia({ ok: false, message: notice })
      resetDrafts()
      persistedRef.current = undefined
      readOnlyRef.current = false
      setPersistence({ readOnly: false, notice })
      setState(undefined)
      setLoading(false)
    },
    [settleMedia],
  )

  useEffect(() => {
    let active = true
    const retry = retryRef.current
    void gardenRepository.load().then((result) => {
      if (!active) return
      applyLoadResult(result)
      setLoading(false)
      if (result.status === 'withheld' && result.reason === 'unavailable') {
        retryLoad()
      }
      if (result.status === 'loaded') {
        void loadDrafts()
        // Returning gardeners who never got the request still deserve it.
        if (result.state.profile) void requestPersistentStorage()
      }
    })
    const waiters = mediaWaiters.current
    return () => {
      active = false
      if (retry.timer !== undefined) window.clearTimeout(retry.timer)
      retry.timer = undefined
      for (const settle of [...waiters.values()])
        settle({ ok: false, message: 'Image saving was interrupted.' })
      waiters.clear()
    }
  }, [applyLoadResult, retryLoad])

  // Another tab wrote the shared garden; adopt its version instead of racing it.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<SyncMessage | undefined>) => {
      const message = event.data
      if (message?.type === 'garden-clearing') {
        pauseSaving('deleting')
        return
      }
      if (message?.type === 'garden-cleared') {
        resetAfterDeletion()
        return
      }
      if (message?.type === 'garden-clear-failed') {
        void gardenRepository.load().then(applyLoadResult)
        return
      }
      if (message?.type !== 'garden-saved' || readOnlyRef.current) return
      // The sender names what it wrote, so only those parts are read back.
      // A message without them -- an older tab -- falls back to a full load.
      void gardenRepository.adopt(message.parts).then((result) => {
        if (result.status === 'loaded') {
          applyLoadResult(result)
          return
        }
        // Anything else means this tab's picture of the stored garden can no
        // longer be trusted. Carrying on would make its next edit write every
        // part of its stale garden over whatever the other tab stored -- the
        // one thing this layer promises never to do. So: stop writing, keep
        // the garden on screen, and say why.
        pauseSaving(result.reason)
        if (result.reason === 'unavailable') retryLoad()
      })
    }
    return () => {
      channel.close()
      channelRef.current = undefined
    }
  }, [applyLoadResult, pauseSaving, resetAfterDeletion, retryLoad])

  const persist = useCallback(
    async (next: AppState) => {
      try {
        const written = await gardenRepository.save(next)
        persistedRef.current = next
        for (const [record, settle] of [...mediaWaiters.current]) {
          if (next.customBackdrops.includes(record)) settle({ ok: true })
        }
        setPersistence((current) =>
          current.writeError ? { ...current, writeError: undefined } : current,
        )
        // Nothing changed on disk means nothing for another tab to pick up;
        // announcing it anyway would make every other tab re-read for no reason.
        if (written.length > 0) {
          channelRef.current?.postMessage({
            type: 'garden-saved',
            parts: written,
          } satisfies SyncMessage)
        }
      } catch (error) {
        if (error instanceof GardenDeletedElsewhereError) {
          resetAfterDeletion()
          return
        }
        if (error instanceof GardenConflictError) {
          // Another tab wrote first. Its garden is the true one: read it back
          // and say plainly that this change was not kept.
          settleMedia({ ok: false, message: error.message })
          const result = await gardenRepository.load()
          if (result.status === 'loaded') applyLoadResult(result)
          else pauseSaving(result.reason)
          setPersistence((current) => ({ ...current, notice: error.message }))
          return
        }
        for (const [record, settle] of [...mediaWaiters.current]) {
          if (next.customBackdrops.includes(record)) {
            const previous = persistedRef.current
            // Keep the old scene active on quota/decode write failure. The
            // editor still owns the unsaved draft; unrelated in-memory edits
            // survive.
            if (previous)
              setState((current) =>
                current?.customBackdrops.includes(record)
                  ? {
                      ...current,
                      customBackdrops: previous.customBackdrops,
                      profile: current.profile
                        ? {
                            ...current.profile,
                            selectedCustomBackdropId:
                              previous.profile?.selectedCustomBackdropId,
                          }
                        : undefined,
                    }
                  : current,
              )
            settle({ ok: false, message: errorMessage(error) })
          }
        }
        setPersistence((current) => ({
          ...current,
          writeError: errorMessage(error),
        }))
      }
    },
    [applyLoadResult, pauseSaving, resetAfterDeletion, settleMedia],
  )

  /**
   * Written straight through rather than debounced. Coalescing writes would
   * save a few milliseconds per action, but it also opens a window where a
   * closed tab loses the reflection someone just wrote — a bad trade for a
   * journal. The reference check below already skips redundant writes, so a
   * state object that did not change is never re-serialised. (Unsaved drafts
   * are another matter: see lib/drafts.ts.)
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
  useEffect(() => {
    stateRef.current = state
  }, [state])

  /** Adopt a garden that just replaced the stored one, and tell other tabs. */
  const adoptReplacement = useCallback(
    (garden: AppState, written: GardenPart[]) => {
      settleMedia({ ok: false, message: 'The garden was replaced.' })
      persistedRef.current = garden
      readOnlyRef.current = false
      setState(progressGarden(garden))
      setLoading(false)
      // Every other tab is holding the garden this one just replaced. Without
      // this they keep it, and the next edit made in one of them writes part
      // of it back over the restored garden.
      channelRef.current?.postMessage({
        type: 'garden-saved',
        parts: written,
      } satisfies SyncMessage)
    },
    [settleMedia],
  )

  /**
   * Every action keeps a stable identity so memoized views (the month
   * planner in particular) are not re-rendered by the app shell.
   */
  const actions = useMemo(
    () => ({
      onboard: (name: string, gardenName: string) => {
        setState(createInitialState(name, gardenName))
        setPersistence((current) =>
          current.notice ? { ...current, notice: undefined } : current,
        )
        // A new garden is the moment to ask the browser to keep it.
        void requestPersistentStorage()
      },
      /** Clear a notice once the gardener has read it. */
      dismissNotice: () => {
        setPersistence((current) => ({ ...current, notice: undefined }))
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
          goals: current.goals.map((item) =>
            item.id === goal.id ? goal : item,
          ),
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
          const existing = current.moods.find(
            (item) => item.localDate === localDate,
          )
          const entry: MoodEntry = {
            id: existing?.id ?? createId(),
            localDate,
            level,
            note: note.trim(),
            createdAt: existing?.createdAt ?? now.toISOString(),
            updatedAt: now.toISOString(),
          }
          const moods = existing
            ? current.moods.map((item) =>
                item.id === existing.id ? entry : item,
              )
            : [...current.moods, entry]
          return awardSunlight({ ...current, moods }, `mood:${localDate}`, now)
        })
        // The first thing written in the journal is the other moment to ask.
        void requestPersistentStorage()
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
        void requestPersistentStorage()
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
      /**
       * Round out a day and collect its Moonlight.
       *
       * `localDate` is the day being closed, which is not always today: inside
       * the after-midnight grace window it is yesterday, and the goal planned
       * from the tomorrow note is relative to that day rather than to the
       * clock. Closing Tuesday at 1:15am plans for Wednesday -- the day the
       * gardener is standing in -- not Thursday.
       */
      collectMoonlight: (
        localDate: string,
        draft: RecapDraft & { planForTomorrow?: boolean } = {},
      ) => {
        const now = new Date()
        update((current) => {
          if (moonlightForDate(current, localDate)) return current

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
            current,
            localDate,
            { ...draft, plannedGoalId: plannedGoal?.id },
            now,
          )
          return plannedGoal
            ? { ...collected, goals: [...collected.goals, plannedGoal] }
            : collected
        })
      },
      updateRecap: (entry: RecapEntry) => {
        update((current) => ({
          ...current,
          recaps: current.recaps.map((item) =>
            item.id === entry.id
              ? { ...entry, updatedAt: new Date().toISOString() }
              : item,
          ),
        }))
      },
      /**
       * Delete a recap. The `moonlight` ledger is deliberately untouched: the
       * night has been collected, and rewriting what was said about it must
       * not pay out again.
       */
      deleteRecap: (id: string) => {
        update((current) => ({
          ...current,
          recaps: current.recaps.filter((item) => item.id !== id),
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
            creature.id === creatureId
              ? { ...creature, name: trimmed }
              : creature,
          ),
        }))
      },
      selectBackdrop: (backdropId: GardenBackdropId) => {
        update((current) => {
          const progressed = progressGarden(current)
          const profile = progressed.profile
          // Availability, not stored unlocks: a pass scene is choosable while
          // access holds without ever being written into the permanent list.
          if (!profile || !availableBackdropIds(profile).includes(backdropId)) {
            return progressed
          }
          return {
            ...progressed,
            profile: {
              ...profile,
              selectedBackdropId: backdropId,
              // Choosing a built-in scene is a choice to stop showing the
              // gardener's own image. The image itself is kept.
              selectedCustomBackdropId: undefined,
            },
          }
        })
      },
      /**
       * Save one of the gardener's own images and show it.
       *
       * The record and the reference to it move in a single update, so the
       * garden is never observed pointing at an image that is not there. It
       * goes through the hook's ordinary update path rather than writing to
       * the repository directly, which would race the save effect that owns
       * persistence.
       *
       * The answer comes exactly once: when that record reaches disk, when the
       * write fails, when the update turns out not to add it (the garden
       * changed underneath, say), or after a timeout -- never left hanging,
       * which used to block every later image save until a reload.
       */
      saveCustomBackdrop: async (
        record: CustomBackdrop,
      ): Promise<MediaResult> => {
        if (readOnlyRef.current)
          return {
            ok: false,
            message: 'This garden is read-only. Restore a valid backup first.',
          }
        if (mediaWaiters.current.size)
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
        // The normal save effect owns the transaction. Resolve only after that
        // exact image reaches disk, keeping quota failures visible in the editor.
        return new Promise<MediaResult>((resolve) => {
          const settle = (result: MediaResult) => {
            if (mediaWaiters.current.get(record) !== settle) return
            mediaWaiters.current.delete(record)
            window.clearTimeout(timer)
            resolve(result)
          }
          const timer = window.setTimeout(
            () =>
              settle({
                ok: false,
                message: 'Saving the image took too long. Please try again.',
              }),
            MEDIA_SAVE_TIMEOUT_MS,
          )
          mediaWaiters.current.set(record, settle)
          update((state) => {
            const next = putCustomBackdrop(state, record)
            if (!next.customBackdrops.includes(record)) {
              queueMicrotask(() =>
                settle({
                  ok: false,
                  message:
                    'The garden changed while the image was saving. Please try again.',
                }),
              )
            }
            return next
          })
        })
      },
      deleteCustomBackdrop: (id: string) => {
        update((current) => removeCustomBackdrop(current, id))
      },
      selectCustomBackdrop: (id: string | undefined) => {
        if (id === undefined || hasGardenPassFeature('custom-backdrops'))
          update((current) => selectCustomBackdropIn(current, id))
      },
      /** Remember which release notes have been read. */
      markReleaseSeen: (releaseId: string) => {
        update((current) => {
          if (!current.profile) return current
          if (current.profile.lastSeenReleaseId === releaseId) return current
          return {
            ...current,
            profile: { ...current.profile, lastSeenReleaseId: releaseId },
          }
        })
      },
      toggleAmbientSound: () => {
        update((current) => ({
          ...current,
          profile: current.profile
            ? {
                ...current.profile,
                ambientSound: !current.profile.ambientSound,
              }
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
      updateProfile: (
        name: string,
        gardenName: string,
        reducedMotion: boolean,
      ) => {
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
       * The newest set-aside copy of a garden this build could not read, as a
       * file the gardener can keep, or undefined when there is none.
       */
      quarantinedCopy: async (): Promise<string | undefined> => {
        const [newest] = await gardenRepository.quarantined()
        if (!newest) return undefined
        return JSON.stringify(
          {
            format: 'the-butterfly-garden-set-aside',
            exportedAt: new Date().toISOString(),
            appVersion: __APP_VERSION__,
            reason: newest.reason,
            storedAt: newest.storedAt,
            garden: newest.raw,
          },
          null,
          2,
        )
      },
      /** How many set-aside copies are kept. */
      countQuarantined: async (): Promise<number> =>
        (await gardenRepository.quarantined()).length,
      /** Discard every set-aside copy, once the gardener has kept what they need. */
      discardQuarantine: async (): Promise<void> => {
        await gardenRepository.clearQuarantine()
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
        const inspection = inspectImportedState(parsed)
        const imported = inspection.state
        if (!imported) {
          return {
            ok: false,
            message: `That backup could not be restored. ${inspection.refused ?? 'It may be from a newer version of the garden.'}`,
          }
        }
        let written: GardenPart[]
        const startedAt = new Date().toISOString()
        try {
          if (imported.customBackdrops.length) {
            const { verifyBackdropImages } = await import('../lib/imageImport')
            await verifyBackdropImages(imported.customBackdrops)
          }
          // Replaced rather than saved: a restore swaps the whole document,
          // and writing only the difference from the garden being replaced can
          // leave a collection's stored record behind. The garden being
          // replaced is copied aside first, so the restore can be undone.
          written = await gardenRepository.replace(imported, { snapshot: true })
        } catch (error) {
          return { ok: false, message: errorMessage(error) }
        }
        const [snapshot] = await gardenRepository.snapshots()
        setPersistence({
          readOnly: false,
          lastRestoreSnapshotId:
            snapshot && snapshot.takenAt >= startedAt ? snapshot.id : undefined,
        })
        adoptReplacement(imported, written)
        const repaired = inspection.repaired
        return {
          ok: true,
          message:
            repaired > 0
              ? `Your garden was restored from the backup. ${repaired} damaged ${repaired === 1 ? 'entry was' : 'entries were'} repaired along the way.`
              : 'Your garden was restored from the backup.',
        }
      },
      /** Put back the garden a restore replaced. */
      undoRestore: async (
        snapshotId: string,
      ): Promise<{ ok: boolean; message: string }> => {
        let previous: AppState | undefined
        let written: GardenPart[]
        try {
          previous = await gardenRepository.snapshot(snapshotId)
          if (!previous) {
            return {
              ok: false,
              message: 'The garden from before the restore could not be read.',
            }
          }
          written = await gardenRepository.replace(previous)
        } catch (error) {
          return { ok: false, message: errorMessage(error) }
        }
        setPersistence({ readOnly: false })
        adoptReplacement(previous, written)
        return {
          ok: true,
          message: 'Your garden is back to how it was before the restore.',
        }
      },
      /**
       * Start a new garden over one this build could not read.
       *
       * The unreadable garden has already been set aside in quarantine by the
       * load that withheld it, and stays there; this only lets saving resume
       * for a new garden. Refused when storage itself could not be opened.
       */
      startFresh: async (): Promise<{ ok: boolean; message?: string }> => {
        if ((await gardenRepository.quarantined()).length === 0)
          return {
            ok: false,
            message:
              'There is no set-aside copy of your garden yet, so starting again could lose it.',
          }
        try {
          await gardenRepository.prepareFreshStart()
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
      deleteAll: async (): Promise<{ ok: boolean; message?: string }> => {
        // Other tabs stop writing first, so none can recreate part of the
        // garden in the moment between the deletion and its announcement.
        channelRef.current?.postMessage({
          type: 'garden-clearing',
        } satisfies SyncMessage)
        try {
          await gardenRepository.clear()
        } catch (error) {
          if (error instanceof GardenDeletionPendingError) {
            // The deletion is queued, not cancelled: it completes as soon as
            // the other tab lets go. This tab behaves as if it already has, so
            // nothing here can write the garden back.
            resetAfterDeletion(error.message)
            return { ok: false, message: error.message }
          }
          channelRef.current?.postMessage({
            type: 'garden-clear-failed',
          } satisfies SyncMessage)
          return { ok: false, message: errorMessage(error) }
        }
        settleMedia({ ok: false, message: 'The garden was deleted.' })
        resetDrafts()
        persistedRef.current = undefined
        readOnlyRef.current = false
        setPersistence({ readOnly: false })
        setState(undefined)
        setLoading(false)
        channelRef.current?.postMessage({
          type: 'garden-cleared',
        } satisfies SyncMessage)
        return { ok: true }
      },
    }),
    [update, adoptReplacement, resetAfterDeletion, settleMedia],
  )

  return { state, loading, persistence, ...actions }
}
