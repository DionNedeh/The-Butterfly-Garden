import { inspectImportedState } from '../repository/gardenRepository'
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
  const days = writtenDays(state)
  return {
    ok: true,
    exportedAt:
      typeof envelope.exportedAt === 'string' ? envelope.exportedAt : undefined,
    appVersion:
      typeof envelope.appVersion === 'string' ? envelope.appVersion : undefined,
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
    },
    firstDay: days[0],
    lastDay: days[days.length - 1],
    repaired: inspection.repaired,
  }
}
