import { useSyncExternalStore } from 'react'
import { passStatus, subscribeToPassStatus } from '../lib/passEntitlement'

/**
 * Google Play's latest answer about the Garden Pass. Using it in a component
 * re-renders that component (and, at the root, the whole garden) whenever the
 * answer changes, so every gardenPassAccess() check below it reads fresh.
 */
export function usePassStatus() {
  return useSyncExternalStore(subscribeToPassStatus, passStatus)
}
