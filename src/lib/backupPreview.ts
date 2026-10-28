import { inspectImportedState } from '../repository/gardenRepository'
import { photosIn } from './customBackdrops'
import type { AppState } from '../types'

/** What a backup file holds, shown before it replaces anything. */
export interface BackupPreview {
  ok: boolean
  /** Why it cannot be restored, in plain words, when it can't. */
  problem?: string
  exportedAt?: string
  appVersion?: string
  gardenName?: string
  counts?: {
    checkIns: number
    reflections: number
    recaps: number
    goals: number
    butterflies: number
    images: number
    /** Sightings in the field book, and how many of them have a photo. */
    sightings: number
    photos: number
  }
  /** The first and last day anything was written, YYYY-MM-DD. */
  firstDay?: string
  lastDay?: string
  /** Damaged but recoverable entries that a restore would repair. */
  repaired: number
}

function writtenDays(state: AppState): string[] {
  return [
    ...state.moods.map((entry) => entry.localDate),
    ...state.reflections.map((entry) => entry.localDate),
    ...state.recaps.map((entry) => entry.localDate),
  ].sort()
}

/**
 * Read a backup file's text and describe it, without changing anything.
 *
 * Restoring replaces the whole garden, so the gardener should see what is in
 * the file -- whose garden, from when, how much -- before agreeing to it.
 */
export function previewBackup(text: string): BackupPreview {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, problem: 'That file is not a garden backup.', repaired: 0 }
  }
  const inspection = inspectImportedState(parsed)
  const state = inspection.state
  if (!state) {
    return {
      ok: false,
      problem: inspection.refused ?? 'That backup could not be read.',
      repaired: 0,
    }
  }
  const envelope =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  return {
    ...previewGarden(state, inspection.repaired),
    exportedAt:
      typeof envelope.exportedAt === 'string' ? envelope.exportedAt : undefined,
    appVersion:
      typeof envelope.appVersion === 'string' ? envelope.appVersion : undefined,
  }
}

/**
 * Describe a garden already read: a backup's, or an earlier copy kept on
 * this device (repository/dailyCopies), which is shown the same way before
 * it is put back.
 */
export function previewGarden(state: AppState, repaired = 0): BackupPreview {
  const days = writtenDays(state)
  return {
    ok: true,
    gardenName: state.profile?.gardenName,
    counts: {
      checkIns: state.moods.length,
      reflections: state.reflections.length,
      recaps: state.recaps.length,
      goals: state.goals.length,
      butterflies: state.creatures.filter(
        (creature) => creature.stage === 'butterfly',
      ).length,
      images: state.customBackdrops.length,
      sightings: state.sightings.length,
      photos: photosIn(state.sightings).count,
    },
    firstDay: days[0],
    lastDay: days[days.length - 1],
    repaired,
  }
}
