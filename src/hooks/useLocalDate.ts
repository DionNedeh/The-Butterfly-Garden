import { useEffect, useState } from 'react'
import { toLocalDate } from '../lib/date'

/**
 * The current local date, kept fresh across midnight.
 *
 * Views that derive "today" during render would otherwise keep showing
 * yesterday for a session left open overnight: the garden's background tick
 * returns the same state object when nothing changed, so React never
 * re-renders and the stale date sticks.
 */
export function useLocalDate(): string {
  const [today, setToday] = useState(toLocalDate)

  useEffect(() => {
    const refresh = () => setToday(toLocalDate())
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const interval = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  return today
}
