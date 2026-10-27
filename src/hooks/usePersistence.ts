import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadDrafts, resetDrafts } from '../lib/drafts'
import { recordBackup } from '../lib/gardenActions'
import { progressGarden } from '../lib/progression'
import { requestPersistentStorage } from '../lib/storage'
import {
  GardenConflictError,
  GardenDeletedElsewhereError,
  GardenDeletionPendingError,
  inspectImportedState,
  type GardenPart,
  type GardenRepository,
  type LoadResult,
} from '../repository/gardenRepository'
import { isQuietWrite } from '../lib/quietWrites'
import { hasPictures } from '../lib/customBackdrops'
import type { FileCopy } from '../lib/sightingPhotos'
import type { AppState, CustomBackdrop, Sighting } from '../types'
import type { useMediaSaves } from './useMediaSaves'

/** Tabs tell each other when the shared garden changed underneath them. */
export const SYNC_CHANNEL = 'butterfly-garden-sync'

/** What tabs say to each other on the sync channel. */
export type SyncMessage =
  | { type: 'garden-saved'; parts?: unknown }
  /** A tab is about to delete the garden: stop writing now. */
  | { type: 'garden-clearing' }
  /** The garden is gone: start again from nothing. */
  | { type: 'garden-cleared' }
  /** The deletion did not happen after all: read the garden again. */
  | { type: 'garden-clear-failed' }
  /**
   * The garden lock was turned on or off, or (`now`) locked. A tab with the
   * garden open follows it here, reading the garden again; one showing the
   * lock screen, there.
   */
  | { type: 'garden-lock'; now?: boolean }
  /**
   * The time the garden may be out of sight before it locks itself was
   * chosen anew. Nothing of the garden changed: only a tab with it open
   * under the lock takes the new time (components/lock/LockWatch).
   */
  | { type: 'garden-auto-lock' }

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

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Your garden could not be saved to this device.'
}

/**
 * The garden as stored: reading it, writing every change, keeping step with
 * other tabs, and the whole-garden operations (restore, undo, delete).
 *
 * The garden on screen is written whenever it changes, unless the stored one
 * could not be read, in which case saving pauses and says why. What other
 * tabs write is adopted rather than raced; a deletion anywhere stops every
 * tab writing before it happens.
 */
export function usePersistence(
  repository: GardenRepository,
  media: ReturnType<typeof useMediaSaves>,
) {
  const [state, setState] = useState<AppState>()
  const [loading, setLoading] = useState(true)
  const [persistence, setPersistence] = useState<PersistenceStatus>({
    readOnly: false,
  })
  /** The exact object last known to be on disk; never re-saved as-is. */
  const persistedRef = useRef<AppState>(undefined)
  const readOnlyRef = useRef(false)
  const channelRef = useRef<BroadcastChannel>(undefined)
  const retryRef = useRef<{ timer?: number; attempt: number }>({ attempt: 0 })
  const { settleAll, settleWritten, failWritten } = media

  const applyLoadResult = useCallback(
    (result: LoadResult) => {
      settleAll({
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
        result.status === 'loaded' ? progressGarden(result.state) : result.state,
      )
    },
    [settleAll],
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
      settleAll({ ok: false, message: 'Saving is paused right now.' })
      readOnlyRef.current = true
      setPersistence((current) => ({ ...current, readOnly: true, reason }))
    },
    [settleAll],
  )

  /**
   * Keep trying to read storage after it stopped answering, backing off.
   * Saving stays paused until a read succeeds.
   */
  const retryLoad = useCallback(() => {
    const retry = retryRef.current
    if (retry.timer !== undefined) return
    const delay = RETRY_DELAYS_MS[Math.min(retry.attempt, RETRY_DELAYS_MS.length - 1)]
    retry.timer = window.setTimeout(() => {
      retry.timer = undefined
      retry.attempt += 1
      void repository.load().then((result) => {
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
  }, [repository, applyLoadResult, pauseSaving])

  /** Another tab deleted the garden: start again from nothing, saving nothing. */
  const resetAfterDeletion = useCallback(
    (notice = 'This garden was deleted in another tab.') => {
      repository.forget()
      settleAll({ ok: false, message: notice })
      resetDrafts()
      persistedRef.current = undefined
      readOnlyRef.current = false
      setPersistence({ readOnly: false, notice })
      setState(undefined)
      setLoading(false)
    },
    [repository, settleAll],
  )

  useEffect(() => {
    let active = true
    const retry = retryRef.current
    void repository.load().then((result) => {
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
    return () => {
      active = false
      if (retry.timer !== undefined) window.clearTimeout(retry.timer)
      retry.timer = undefined
    }
  }, [repository, applyLoadResult, retryLoad])

  // Another tab wrote the shared garden; adopt its version instead of racing it.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(SYNC_CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<SyncMessage | undefined>) => {
      const message = event.data
      if (message?.type === 'garden-lock' && message.now) {
        // Locked everywhere now: this tab too, and components/LockGate
        // shows the lock screen.
        void import('../lib/gardenLockActions').then(({ lockGarden }) => lockGarden(false))
        return
      }
      if (message?.type === 'garden-clearing') {
        pauseSaving('deleting')
        return
      }
      if (message?.type === 'garden-cleared') {
        resetAfterDeletion()
        return
      }
      if (message?.type === 'garden-clear-failed') {
        void repository.load().then(applyLoadResult)
        return
      }
      if (message?.type !== 'garden-saved' && message?.type !== 'garden-lock') return
      if (readOnlyRef.current) {
        // Nothing is written from here, so nothing is read back; but a lock
        // turned on still takes the garden off this screen (LockGate).
        if (message.type === 'garden-lock') void repository.checkLock().catch(() => undefined)
        return
      }
      // The sender names what it wrote, so only those parts are read back.
      // A message without them falls back to a full load: an older tab's, or
      // the lock turned on or off, which stores every part again under a new
      // revision (in a database of its own, perhaps, which the read opens).
      // Kept at the old one, this tab's next change would be refused as a
      // conflict and lost. The load follows the lock as it now stands, so a
      // garden this tab may no longer read goes to the lock screen.
      const parts = message.type === 'garden-saved' ? message.parts : undefined
      void repository.adopt(parts).then((result) => {
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
  }, [repository, applyLoadResult, pauseSaving, resetAfterDeletion, retryLoad])

  const persist = useCallback(
    async (next: AppState) => {
      try {
        const written = await repository.save(next)
        persistedRef.current = next
        settleWritten(next)
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
          // and say plainly that this change was not kept -- unless the write
          // held nothing of the gardener's (lib/quietWrites), when there is
          // nothing to say.
          const quiet = isQuietWrite(next)
          if (!quiet) settleAll({ ok: false, message: error.message })
          const result = await repository.load()
          if (result.status === 'loaded') applyLoadResult(result)
          else pauseSaving(result.reason)
          if (!quiet) setPersistence((current) => ({ ...current, notice: error.message }))
          return
        }
        const failed = failWritten(next, errorMessage(error))
        const previous = persistedRef.current
        // Keep the old scene active on quota/decode write failure. The editor
        // still owns the unsaved draft; unrelated in-memory edits survive.
        // A sighting's photo that would not go in comes back out (the photo
        // stored before, if any), or every later write would carry it, and
        // fail too; the field book says it was not kept.
        if (failed.length && previous) {
          setState((current) => {
            if (!current) return current
            let kept = current
            if (failed.some((record) => current.customBackdrops.includes(record as CustomBackdrop)))
              kept = {
                ...kept,
                customBackdrops: previous.customBackdrops,
                profile: current.profile
                  ? {
                      ...current.profile,
                      selectedCustomBackdropId:
                        previous.profile?.selectedCustomBackdropId,
                    }
                  : undefined,
              }
            const refused = (sighting: Sighting) =>
              sighting.photo !== undefined && failed.includes(sighting.photo)
            if (current.sightings.some(refused))
              kept = {
                ...kept,
                sightings: current.sightings.map((sighting) =>
                  refused(sighting)
                    ? {
                        ...sighting,
                        photo: previous.sightings.find((item) => item.id === sighting.id)?.photo,
                      }
                    : sighting,
                ),
              }
            return kept
          })
        }
        setPersistence((current) => ({ ...current, writeError: errorMessage(error) }))
      }
    },
    [
      repository,
      applyLoadResult,
      pauseSaving,
      resetAfterDeletion,
      settleAll,
      settleWritten,
      failWritten,
    ],
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

  // Time moves the garden on (a chrysalis from 1.x emerging, a scene's
  // unlock) even when nobody touches it.
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

  /** Adopt a garden that just replaced the stored one, and tell other tabs. */
  const adoptReplacement = useCallback(
    (garden: AppState, written: GardenPart[]) => {
      settleAll({ ok: false, message: 'The garden was replaced.' })
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
    [settleAll],
  )

  /** The whole-garden operations. Stable, like every action. */
  const lifecycle = useMemo(
    () => ({
      /** Clear a notice once the gardener has read it. */
      dismissNotice: () => {
        setPersistence((current) => ({ ...current, notice: undefined }))
      },
      /**
       * The newest set-aside copy of a garden this build could not read, as a
       * file the gardener can keep, or undefined when there is none.
       */
      quarantinedCopy: async (): Promise<FileCopy | undefined> => {
        const [newest] = await repository.quarantined()
        // Its photos are Blobs, which go into a file as text (lib/sightingPhotos).
        return newest && (await import('../lib/sightingPhotos')).setAsideCopy(newest)
      },
      /** How many set-aside copies are kept. */
      countQuarantined: async (): Promise<number> =>
        (await repository.quarantined()).length,
      /** Discard every set-aside copy, once the gardener has kept what they need. */
      discardQuarantine: async (): Promise<void> => {
        await repository.clearQuarantine()
      },
      /** Replace the garden with a previously exported backup. */
      importGarden: async (text: string): Promise<{ ok: boolean; message: string }> => {
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          return { ok: false, message: 'That file is not a garden backup.' }
        }
        const inspection = inspectImportedState(parsed)
        // The restored garden is exactly a file the gardener holds, so it
        // counts as a copy kept now. This also replaces the time the file
        // carries, which is from the copy before it (or hand-edited), and
        // would otherwise say the wrong thing about copies on a new device.
        const imported =
          inspection.state && recordBackup(inspection.state, new Date())
        if (!imported) {
          return {
            ok: false,
            message: `That backup could not be restored. ${inspection.refused ?? 'It may be from a newer version of the garden.'}`,
          }
        }
        let written: GardenPart[]
        const startedAt = new Date().toISOString()
        try {
          if (hasPictures(imported)) {
            const { verifyGardenImages } = await import('../lib/imageImport')
            await verifyGardenImages(imported)
          }
          // Replaced rather than saved: a restore swaps the whole document,
          // and writing only the difference from the garden being replaced can
          // leave a collection's stored record behind. The garden being
          // replaced is copied aside first, so the restore can be undone.
          written = await repository.replace(imported, { snapshot: true })
        } catch (error) {
          return { ok: false, message: errorMessage(error) }
        }
        // The garden is already replaced; failing to find the copy only loses
        // the offer to undo, not the restore itself.
        const [snapshot] = await repository.snapshots().catch(() => [])
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
      undoRestore: async (snapshotId: string): Promise<{ ok: boolean; message: string }> => {
        let previous: AppState | undefined
        let written: GardenPart[]
        try {
          previous = await repository.snapshot(snapshotId)
          if (!previous) {
            return {
              ok: false,
              message: 'The garden from before the restore could not be read.',
            }
          }
          written = await repository.replace(previous)
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
        try {
          if ((await repository.quarantined()).length === 0)
            return {
              ok: false,
              message:
                'There is no set-aside copy of your garden yet, so starting again could lose it.',
            }
          await repository.prepareFreshStart()
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
        channelRef.current?.postMessage({ type: 'garden-clearing' } satisfies SyncMessage)
        try {
          await repository.clear()
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
        settleAll({ ok: false, message: 'The garden was deleted.' })
        resetDrafts()
        persistedRef.current = undefined
        readOnlyRef.current = false
        setPersistence({ readOnly: false })
        setState(undefined)
        setLoading(false)
        channelRef.current?.postMessage({ type: 'garden-cleared' } satisfies SyncMessage)
        return { ok: true }
      },
    }),
    [repository, adoptReplacement, resetAfterDeletion, settleAll],
  )

  return {
    state,
    setState,
    loading,
    persistence,
    setPersistence,
    /** True while saving is paused; read by actions that must refuse then. */
    readOnlyRef,
    lifecycle,
  }
}
