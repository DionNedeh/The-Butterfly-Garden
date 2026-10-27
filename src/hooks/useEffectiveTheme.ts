import { useCallback, useSyncExternalStore } from 'react'
import { effectiveTheme, nextThemeChange } from '../lib/theme'
import type { AppearanceTheme, Profile } from '../types'
import { useMediaQuery } from './useMediaQuery'

const PREFERS_DARK = '(prefers-color-scheme: dark)'

/**
 * The theme on screen: the one chosen by hand, or what it follows.
 *
 * Following the device listens for its dark setting changing. Following the
 * evening sets one timer, to the next hour the theme turns, rather than
 * looking at the clock every minute. A phone asleep through that hour can
 * hold the timer back, so the clock is read again whenever the page is seen
 * again. The theme itself is worked out afresh on every render (lib/theme),
 * so a change of the gardener's hours shows at once.
 */
export function useEffectiveTheme(profile: Profile | undefined): AppearanceTheme {
  const prefersDark = useMediaQuery(PREFERS_DARK)
  const follows = profile?.themeFollows
  const recapOpensHour = profile?.recapOpensHour
  const recapGraceEndsHour = profile?.recapGraceEndsHour
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (follows !== 'evening') return () => undefined
      const hours = { themeFollows: follows, recapOpensHour, recapGraceEndsHour }
      let timer: number | undefined
      const schedule = () => {
        window.clearTimeout(timer)
        const now = new Date()
        const next = nextThemeChange(hours, now)
        if (next)
          timer = window.setTimeout(() => {
            onChange()
            schedule()
          }, next.getTime() - now.getTime())
      }
      const whenSeen = () => {
        if (document.visibilityState !== 'visible') return
        onChange()
        schedule()
      }
      schedule()
      document.addEventListener('visibilitychange', whenSeen)
      return () => {
        window.clearTimeout(timer)
        document.removeEventListener('visibilitychange', whenSeen)
      }
    },
    [follows, recapOpensHour, recapGraceEndsHour],
  )
  return useSyncExternalStore(subscribe, () =>
    effectiveTheme(profile, new Date(), prefersDark),
  )
}
