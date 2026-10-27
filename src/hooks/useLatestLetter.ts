import { useCallback, useSyncExternalStore } from 'react'
import { recapHoursOf } from '../lib/date'
import { latestLetterFor, nextLetterAt } from '../lib/letterTiming'
import type { Profile } from '../types'

/**
 * The Sunday of Marigold's newest letter (lib/letterTiming), kept fresh while the
 * garden is open: one timer to the next Sunday evening rather than a look at
 * the clock every minute, and a fresh look whenever the page is seen again,
 * since a phone asleep through that hour can hold the timer back. The answer
 * is a date, so the clock moving on within a week never re-renders anything.
 */
export function useLatestLetter(
  profile: Pick<Profile, 'createdAt' | 'recapOpensHour'> | undefined,
): string | undefined {
  const opensHour = recapHoursOf(profile).opensHour
  const subscribe = useCallback(
    (onChange: () => void) => {
      let timer: number | undefined
      const schedule = () => {
        window.clearTimeout(timer)
        const now = new Date()
        timer = window.setTimeout(
          () => {
            onChange()
            schedule()
          },
          nextLetterAt(now, opensHour).getTime() - now.getTime(),
        )
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
    [opensHour],
  )
  return useSyncExternalStore(subscribe, () => latestLetterFor(profile, new Date()))
}
