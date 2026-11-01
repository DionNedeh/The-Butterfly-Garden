import { useSyncExternalStore } from 'react'
import { isDraftKept, subscribe } from './drafts'

/**
 * Whether the draft for `key` has reached storage as it stands (6.2), for
 * the "Draft kept" hint (components/DraftKept), which must never claim a
 * draft that a failed write or the garden lock kept out. False while there
 * is no draft, which is the case whenever the field holds its saved entry
 * (see useDraft). Apart from lib/drafts, which every page loads, since only
 * the pages that show the hint need it.
 */
export function useDraftKept(key: string): boolean {
  return useSyncExternalStore(subscribe, () => isDraftKept(key), () => false)
}
