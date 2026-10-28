import { useEffect, useRef } from 'react'
import { useLockState } from '../../hooks/useLockState'
import { changedForTheFile, fileWriteDue, type WriteMoment } from '../../lib/autoBackup'
import { noteChange, writeBackupFile } from '../../lib/autoBackupFile'
import type { FileCopy } from '../../lib/sightingPhotos'
import type { AppState } from '../../types'

/** How often a garden left open looks for an earlier day's changes to write. */
const LOOK_EVERY_MS = 5 * 60_000

/**
 * Writes the backup file the gardener chose (lib/autoBackupFile), while the
 * garden is open: an earlier day's changes when the garden is opened or
 * looked at again, and the day's own as the page is hidden. Draws nothing.
 *
 * Loaded by the app only where the browser can keep a file, and only once a
 * garden is open; it does nothing at all until a file has been chosen. It
 * pauses while saving is paused and while the garden lock is on, and notes
 * nothing then; once either ends, the file is treated as behind.
 */
export function AutoBackupKeeper({
  state,
  readOnly,
  onExportGarden,
  onWritten,
}: {
  state: AppState
  readOnly: boolean
  onExportGarden: () => FileCopy | undefined | Promise<FileCopy | undefined>
  /** A copy reached the file: it counts as a backup kept (Profile.lastBackupAt). */
  onWritten: (madeAt: Date) => void
}) {
  const lock = useLockState()
  const paused = readOnly || lock !== 'none'
  const latest = useRef({ onExportGarden, onWritten })
  useEffect(() => {
    latest.current = { onExportGarden, onWritten }
  })

  // Each change that belongs in the file marks it as behind.
  const seen = useRef(state)
  useEffect(() => {
    const before = seen.current
    seen.current = state
    if (!paused && changedForTheFile(before, state)) void noteChange().catch(() => undefined)
  }, [state, paused])

  // What happened while paused is not known: the file is behind once it ends.
  const wasPaused = useRef(paused)
  useEffect(() => {
    if (wasPaused.current && !paused) void noteChange().catch(() => undefined)
    wasPaused.current = paused
  }, [paused])

  useEffect(() => {
    if (paused) return
    let active = true
    const write = (moment: WriteMoment) => {
      writeBackupFile(
        () => latest.current.onExportGarden(),
        (record) => fileWriteDue(record, moment, new Date()),
        () => active,
      ).then(
        ({ outcome, madeAt }) => {
          if (active && outcome === 'written' && madeAt) latest.current.onWritten(madeAt)
        },
        () => undefined,
      )
    }
    const look = () => {
      if (document.visibilityState === 'visible') write('daily')
    }
    const visibility = () => write(document.visibilityState === 'hidden' ? 'hidden' : 'daily')
    look()
    const timer = window.setInterval(look, LOOK_EVERY_MS)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [paused])

  return null
}
