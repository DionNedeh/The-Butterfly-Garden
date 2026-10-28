/**
 * What Google Play last said about the Garden Pass, held for the whole app.
 *
 * gardenPassAccess() is asked synchronously, from render and from save
 * handlers alike, so the answer lives here rather than in a hook. React
 * subscribes with useSyncExternalStore (usePassStatus) and re-renders the tree
 * when Play's answer changes.
 *
 * Deliberately not part of AppState: a garden backup is a file the gardener
 * can edit, and nothing in it may ever open the Pass.
 */
import {
  getPassStatus,
  onPassStatusChange,
  type PassStatus,
} from './playBilling'
import type { Unsubscribe } from './native'

const CHECKING: PassStatus = { state: 'checking', fromCache: false, lapsed: false }

let current: PassStatus = CHECKING
const listeners = new Set<() => void>()

export function passStatus(): PassStatus {
  return current
}

export function subscribeToPassStatus(listener: () => void): Unsubscribe {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setPassStatus(next: PassStatus): void {
  if (
    next.state === current.state &&
    next.fromCache === current.fromCache &&
    next.lapsed === current.lapsed
  )
    return
  current = next
  for (const listener of listeners) listener()
}

/**
 * Ask Play now: when the Garden Pass page opens, or "Try again". The
 * gardener's own request is what wakes Google's Billing Library.
 */
export async function refreshPassStatus(): Promise<void> {
  setPassStatus(await getPassStatus({ ask: true }))
}

/**
 * Start following Play's answers. At start-up Play is asked only if this
 * device is following a subscription (otherwise the state is "unasked");
 * after that, every change Play reports, including the native re-check each
 * time a subscriber reopens the app.
 */
export function trackPassStatus(): Unsubscribe {
  const stop = onPassStatusChange(setPassStatus)
  void getPassStatus({ ask: false }).then(setPassStatus)
  return stop
}
