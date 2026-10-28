import { useEffect, useState } from 'react'
import { DEFAULT_RECAP_HOURS, recapWindow, type RecapHours, type RecapWindow } from '../lib/date'

function sameWindow(a: RecapWindow, b: RecapWindow): boolean {
  return (
    a.open === b.open && a.targetDate === b.targetDate && a.state === b.state
  )
}

/**
 * Whether the Moonlight recap is open, kept fresh as the evening arrives.
 *
 * Mirrors `useLocalDate`'s refresh triggers for the same reason: a session
 * left open at 5:40pm has to notice 6pm without a reload, and the garden's
 * background tick will not re-render on its own when nothing else changed.
 *
 * The clock is read afresh on every tick rather than cached, so a device that
 * changes zone mid-session -- a gardener who has just landed somewhere -- is
 * reporting the local evening within the minute. A change to the gardener's
 * own hours is read at once.
 */
export function useRecapWindow(
  { opensHour, graceEndsHour }: RecapHours = DEFAULT_RECAP_HOURS,
): RecapWindow {
  const [value, setValue] = useState(() =>
    recapWindow(new Date(), { opensHour, graceEndsHour }),
  )

  useEffect(() => {
    // Ticking once a minute would re-render Today once a minute if every tick
    // produced a fresh object. Returning the current one when nothing moved
    // lets React skip the render entirely.
    const refresh = () =>
      setValue((current) => {
        const next = recapWindow(new Date(), { opensHour, graceEndsHour })
        return sameWindow(current, next) ? current : next
      })
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    // The hours may just have changed; the first read cannot wait a minute.
    const first = window.setTimeout(refresh, 0)
    const interval = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [opensHour, graceEndsHour])

  return value
}
