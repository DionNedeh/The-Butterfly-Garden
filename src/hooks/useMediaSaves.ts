import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { AppState, CustomBackdrop } from '../types'

export type MediaResult = { ok: boolean; message?: string }

/** What a save can wait for: one of the gardener's images, or a sighting's photo. */
export type MediaRecord = CustomBackdrop | Blob

/** Whether a garden carries `record`. */
function carries(garden: AppState, record: MediaRecord): boolean {
  return (
    garden.customBackdrops.includes(record as CustomBackdrop) ||
    garden.sightings.some((sighting) => sighting.photo === record)
  )
}

/** How long an image save may wait for its write before giving up. */
export const MEDIA_SAVE_TIMEOUT_MS = 30_000

/**
 * Image saves waiting for the write that carries them.
 *
 * Saving one of the gardener's own images, or a sighting's new photo,
 * answers only once that exact record reaches disk, so the editor can keep
 * the draft through a quota failure, and the field book says "saved" only
 * once it is. Every wait settles exactly once: on its write, on a failure, when
 * the garden changes underneath it, or after MEDIA_SAVE_TIMEOUT_MS. A wait
 * left hanging used to block every later image save until a reload.
 */
export function useMediaSaves() {
  const waiters = useRef(new Map<MediaRecord, (result: MediaResult) => void>())

  /** Answer every waiting save at once: the garden went away or was replaced. */
  const settleAll = useCallback((result: MediaResult) => {
    for (const settle of [...waiters.current.values()]) settle(result)
    waiters.current.clear()
  }, [])

  /** Answer the saves whose images are in a garden that just reached disk. */
  const settleWritten = useCallback((written: AppState) => {
    for (const [record, settle] of [...waiters.current]) {
      if (carries(written, record)) settle({ ok: true })
    }
  }, [])

  /**
   * Answer, with the error, the saves whose images were in a write that
   * failed, and hand back those images.
   */
  const failWritten = useCallback(
    (attempted: AppState, message: string): MediaRecord[] => {
      const failed: MediaRecord[] = []
      for (const [record, settle] of [...waiters.current]) {
        if (carries(attempted, record)) {
          failed.push(record)
          settle({ ok: false, message })
        }
      }
      return failed
    },
    [],
  )

  const waiting = useCallback(() => waiters.current.size > 0, [])

  /**
   * Wait for `record` to reach disk. `start` makes the change that should
   * carry it, and is handed `notCarried` to call if it turns out not to.
   */
  const waitFor = useCallback(
    (record: MediaRecord, start: (notCarried: () => void) => void) =>
      new Promise<MediaResult>((resolve) => {
        const settle = (result: MediaResult) => {
          if (waiters.current.get(record) !== settle) return
          waiters.current.delete(record)
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
        waiters.current.set(record, settle)
        start(() =>
          queueMicrotask(() =>
            settle({
              ok: false,
              message: 'The garden changed while the image was saving. Please try again.',
            }),
          ),
        )
      }),
    [],
  )

  // Nothing may be left waiting once the garden is gone.
  useEffect(() => {
    const current = waiters.current
    return () => {
      for (const settle of [...current.values()])
        settle({ ok: false, message: 'Image saving was interrupted.' })
      current.clear()
    }
  }, [])

  return useMemo(
    () => ({ settleAll, settleWritten, failWritten, waiting, waitFor }),
    [settleAll, settleWritten, failWritten, waiting, waitFor],
  )
}
