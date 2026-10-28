import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useUpdateCheck } from '../hooks/useUpdateCheck'
import { reloadForUpdate, reloadOtherTabs } from '../lib/appUpdate'

/**
 * If "Update now" has not reloaded the tab by itself after this long, it
 * reloads anyway. The new version normally takes over in a moment; a tab the
 * service worker was not looking after (opened with a hard reload, say) never
 * hears that it did, and would otherwise sit on the old version with a button
 * that seemed to do nothing. Hearing it does call this off. The other tabs
 * it tells by then may have moved to the new version already; the message
 * names the build it leaves, and they stay put (lib/appUpdate).
 */
const UPDATE_FALLBACK_MS = 4000

/** Hand focus to the open page's heading, making it able to take it. */
function focusPageHeading() {
  const heading = document.querySelector<HTMLElement>('#main-content h1')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
  heading.focus()
}

/**
 * The offer to load a new version, and the hourly look for one.
 *
 * Loaded after the garden appears, and only in the PWA: the Android app is
 * updated by Google Play. Choosing "Update now" moves every open tab of the
 * app to the new version together (lib/appUpdate). "Later" keeps this
 * version until the app is next opened.
 */
export function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  /** Set when this tab's "Update now" asked for the update. */
  const applying = useRef(false)
  const fallback = useRef<number>(undefined)
  const toast = useRef<HTMLElement>(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, found) => setRegistration(found),
    // The new version has taken over this tab. Every tab hears this from its
    // own service worker; the one whose button asked for it also tells the
    // others, for any the service worker was not looking after, and no
    // longer needs its fallback, which would tell them a second time.
    onNeedReload: () => {
      window.clearTimeout(fallback.current)
      if (applying.current) reloadOtherTabs()
      void reloadForUpdate()
    },
  })
  useUpdateCheck(registration)
  useEffect(() => () => window.clearTimeout(fallback.current), [])

  if (!needRefresh) return null
  return (
    <aside className="update-toast" role="status" ref={toast}>
      <div>
        <strong>A fresh garden update is ready.</strong>
        <span>Updating reloads every open garden tab together.</span>
      </div>
      <button
        className="secondary-button"
        onClick={() => {
          applying.current = true
          void updateServiceWorker(true)
          window.clearTimeout(fallback.current)
          fallback.current = window.setTimeout(() => {
            reloadOtherTabs()
            void reloadForUpdate()
          }, UPDATE_FALLBACK_MS)
        }}
      >
        Update now
      </button>
      <button
        className="text-button"
        onClick={() => {
          // The toast leaves with this button; focus goes to the page's
          // heading rather than falling to the page itself.
          if (toast.current?.contains(document.activeElement)) focusPageHeading()
          setNeedRefresh(false)
        }}
      >
        Later
      </button>
    </aside>
  )
}
