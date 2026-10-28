import { useEffect } from 'react'
import { UPDATE_CHECK_INTERVAL_MS, updateCheckDue } from '../lib/appUpdate'
import { isAndroidApp } from '../lib/platform'

/**
 * Ask, every hour the garden is open and seen, whether a new version is out.
 *
 * A browser looks for a new service worker only when the app is opened, so a
 * garden left open for days would otherwise never hear of an update. The
 * question is the browser's own (`registration.update()`), asked of the
 * app's own address, and nothing else is fetched. A hidden tab is not asked
 * for; when it is seen again after an hour or more, it asks at once. Offline,
 * it waits for the next hour.
 *
 * Never in the Android app: it has no service worker, and Google Play brings
 * its updates.
 */
export function useUpdateCheck(registration: ServiceWorkerRegistration | undefined): void {
  useEffect(() => {
    if (!registration || isAndroidApp()) return
    let lastCheckedAt = Date.now()
    const check = () => {
      if (document.visibilityState !== 'visible') return
      lastCheckedAt = Date.now()
      // One already on its way, or no network to ask: nothing to do now.
      if (registration.installing || !navigator.onLine) return
      // A failed check (a dropped connection, a server error) is simply
      // asked again in an hour.
      registration.update().catch(() => undefined)
    }
    const whenSeen = () => {
      if (document.visibilityState === 'visible' && updateCheckDue(lastCheckedAt, Date.now()))
        check()
    }
    const timer = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', whenSeen)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', whenSeen)
    }
  }, [registration])
}
