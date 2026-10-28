import type { AppState } from '../types'

/**
 * Gardens the app wrote on its own, with nothing of the gardener's in them:
 * today's visit being noted (lib/visits) is the one there is.
 *
 * When another tab has written first, such a write is refused like any
 * other, and the garden is read back. Usually that comes with a notice that
 * the last change was not kept; for a write like this there was no change of
 * the gardener's to keep, and the other tab has noted the day itself, so the
 * notice would only alarm. Held weakly, so a garden left behind is not kept
 * alive by being remembered here.
 */
const quiet = new WeakSet<AppState>()

/** Remember that this garden differs from the last only by the app's own note. */
export function markQuietWrite(state: AppState): AppState {
  quiet.add(state)
  return state
}

/** Whether this exact garden was the app's own quiet write. */
export function isQuietWrite(state: AppState): boolean {
  return quiet.has(state)
}
