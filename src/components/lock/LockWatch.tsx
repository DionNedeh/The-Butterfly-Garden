import { useEffect } from 'react'
import { SYNC_CHANNEL, type SyncMessage } from '../../hooks/usePersistence'
import {
  autoLockMinutes,
  loadAutoLock,
  cameFromLockScreen,
  lockGarden,
  onAutoLockChange,
  settledFromLockScreen,
} from '../../lib/gardenLockActions'
import { onAppActiveChange } from '../../lib/native'

/**
 * How often a garden out of sight looks again at what it is waiting on (see
 * `waiting` below), in case that has finished while nobody looked.
 */
const WAITING_CHECK_MS = 60_000

/**
 * The auto-lock, while a locked garden is open in this tab: once the garden
 * has been out of sight for the minutes chosen in Settings (never, unless
 * chosen), the key is forgotten and the lock screen comes back. Unsaved
 * words are written first, sealed (lib/gardenLockActions).
 *
 * Out of sight is a hidden tab, or the Android app in the background. A
 * hidden page's timers may be held back by the browser, so the time hidden
 * is also checked the moment the garden is seen again, before anything of
 * it is shown for long.
 *
 * Locking takes the whole app down, so the clock does not start while the
 * gardener is in the middle of something it would throw away: a photo or
 * file being chosen from the garden (whose chooser, or the camera, takes
 * the Android app to the background), or a form whose contents are not kept
 * as a draft -- the sighting form, a goal being edited, a garden image being
 * framed -- which marks itself `data-auto-lock-waits`. Settings says so
 * beside the choice. A new time chosen in another tab is taken at once.
 */
export function LockWatch() {
  // Opened from the lock screen, which is gone: focus lands on the page's
  // heading once the app has drawn it (after its splash), never on nothing.
  useEffect(() => {
    if (!cameFromLockScreen()) return
    const until = Date.now() + 10_000
    let frame = 0
    const land = () => {
      const heading = document.querySelector<HTMLElement>('#main-content h1')
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
        heading.focus()
        settledFromLockScreen()
      } else if (Date.now() < until) {
        frame = requestAnimationFrame(land)
      } else {
        settledFromLockScreen()
      }
    }
    frame = requestAnimationFrame(land)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    /** Whether the garden is out of sight now. */
    let out = false
    /** When the clock that locks the garden started, while it runs. */
    let since: number | undefined
    let timer: number | undefined
    /** A file chooser (or the camera) opened from the garden, not yet put away. */
    let choosing = false

    void loadAutoLock().catch(() => undefined)

    /** Whether the gardener is in the middle of something locking would lose. */
    const waiting = () => choosing || document.querySelector('[data-auto-lock-waits]') !== null

    /** Lock once the minutes chosen have passed since the clock started. */
    const check = () => {
      window.clearTimeout(timer)
      timer = undefined
      const minutes = autoLockMinutes()
      if (since === undefined || minutes === undefined) return
      const left = since + minutes * 60_000 - Date.now()
      if (left <= 0) {
        since = undefined
        void lockGarden(false)
      } else if (out) {
        timer = window.setTimeout(check, left)
      }
    }
    const hidden = () => {
      out = true
      if (since === undefined) {
        if (waiting()) {
          window.clearTimeout(timer)
          timer = window.setTimeout(hidden, WAITING_CHECK_MS)
          return
        }
        // Started whatever the minutes, so a time chosen meanwhile counts
        // from when the garden went out of sight.
        since = Date.now()
      }
      check()
    }
    const seen = () => {
      out = false
      // Back in the garden, so whatever chooser was open has been put away.
      choosing = false
      check()
      since = undefined
    }
    const follow = () => {
      if (document.visibilityState === 'hidden') hidden()
      else seen()
    }

    // A file input's chooser opens on its click, and is put away with a
    // file (change), without one (cancel), or, where a browser says
    // neither, as focus comes back to the page.
    const putAway = () => {
      if (!choosing) return
      choosing = false
      // Still out of sight once it is put away: the clock starts now.
      if (out) hidden()
    }
    const chooser = (event: Event) => {
      const input = event.target
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return
      if (event.type === 'click') choosing = true
      else putAway()
    }

    // A new time chosen in another tab, taken at once: a garden out of sight
    // for longer than it allows locks now.
    const channel =
      typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(SYNC_CHANNEL)
    if (channel) {
      channel.onmessage = (event: MessageEvent<SyncMessage | undefined>) => {
        if (event.data?.type === 'garden-auto-lock') void loadAutoLock().catch(() => undefined)
      }
    }
    const stopFollowingChoice = onAutoLockChange(() => {
      if (out) hidden()
    })

    document.addEventListener('visibilitychange', follow)
    document.addEventListener('click', chooser, true)
    document.addEventListener('change', chooser, true)
    document.addEventListener('cancel', chooser, true)
    window.addEventListener('focus', putAway)
    const stopFollowingApp = onAppActiveChange((active) => (active ? seen() : hidden()))
    return () => {
      document.removeEventListener('visibilitychange', follow)
      document.removeEventListener('click', chooser, true)
      document.removeEventListener('change', chooser, true)
      document.removeEventListener('cancel', chooser, true)
      window.removeEventListener('focus', putAway)
      stopFollowingApp()
      stopFollowingChoice()
      channel?.close()
      window.clearTimeout(timer)
    }
  }, [])
  return null
}
