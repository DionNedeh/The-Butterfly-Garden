import { useEffect } from 'react'
import {
  autoLockMinutes,
  loadAutoLock,
  cameFromLockScreen,
  lockGarden,
  settledFromLockScreen,
} from '../../lib/gardenLockActions'
import { onAppActiveChange } from '../../lib/native'

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
    let hiddenAt: number | undefined
    let timer: number | undefined

    void loadAutoLock().catch(() => undefined)

    const lock = () => {
      window.clearTimeout(timer)
      timer = undefined
      hiddenAt = undefined
      void lockGarden(false)
    }
    const hidden = () => {
      if (hiddenAt !== undefined) return
      const minutes = autoLockMinutes()
      if (minutes === undefined) return
      hiddenAt = Date.now()
      timer = window.setTimeout(lock, minutes * 60_000)
    }
    const seen = () => {
      window.clearTimeout(timer)
      timer = undefined
      const minutes = autoLockMinutes()
      if (hiddenAt !== undefined && minutes !== undefined && Date.now() - hiddenAt >= minutes * 60_000) {
        lock()
        return
      }
      hiddenAt = undefined
    }
    const follow = () => {
      if (document.visibilityState === 'hidden') hidden()
      else seen()
    }

    document.addEventListener('visibilitychange', follow)
    const stopFollowingApp = onAppActiveChange((active) => (active ? seen() : hidden()))
    return () => {
      document.removeEventListener('visibilitychange', follow)
      stopFollowingApp()
      window.clearTimeout(timer)
    }
  }, [])
  return null
}
