import { useEffect, useRef } from 'react'
import { hasUnseenRelease } from '../data/currentRelease'

/** What the app is showing: still loading, a garden, or no garden yet. */
export type LaunchScreen = 'loading' | 'garden' | 'no-garden'

/** A dialog the gardener has open, native or marked modal. */
function dialogOpen(): boolean {
  return document.querySelector('dialog[open], [aria-modal="true"]') !== null
}

/** Whether this is the tab the gardener is looking at: shown, and in front. */
function inFront(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus()
}

/**
 * Open What's new by itself, once, after an update.
 *
 * It is decided the first time this visit shows a garden: if its gardener
 * has not read this release's notes, the app was updated since they last
 * looked, and `onOpen` (which marks them read) runs. Never for a garden made
 * or restored during the visit, since onboarding and the recovery screen
 * come first and settle it; never while saving is paused, as marking the
 * notes read could not be kept; and never over an open dialog. A tab not in
 * front (hidden, or in a window without focus) waits until the gardener turns
 * to it, by when the tab they were looking at has marked the notes read: so
 * they open in one tab, not in every tab at once, which would also have two
 * tabs writing the same change and one told it was not kept. If the moment
 * passes, the garden's notice still offers them.
 */
export function useWhatsNewOnce({
  screen,
  readOnly,
  lastSeenReleaseId,
  onOpen,
}: {
  screen: LaunchScreen
  readOnly: boolean
  lastSeenReleaseId: string | undefined
  onOpen: () => void
}): void {
  /** Settled for this visit: opened, or not to be. */
  const decided = useRef(false)
  const latestOpen = useRef(onOpen)
  useEffect(() => {
    latestOpen.current = onOpen
  })
  useEffect(() => {
    if (decided.current || screen === 'loading') return
    if (screen === 'no-garden' || readOnly || !hasUnseenRelease(lastSeenReleaseId)) {
      decided.current = true
      return
    }
    const stopWaiting = () => {
      document.removeEventListener('visibilitychange', attempt)
      window.removeEventListener('focus', attempt)
    }
    function attempt() {
      if (decided.current || !inFront() || dialogOpen()) return
      decided.current = true
      stopWaiting()
      latestOpen.current()
    }
    attempt()
    if (decided.current) return
    document.addEventListener('visibilitychange', attempt)
    window.addEventListener('focus', attempt)
    return stopWaiting
  }, [screen, readOnly, lastSeenReleaseId])
}
