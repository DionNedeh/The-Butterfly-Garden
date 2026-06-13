import { useEffect, useState } from 'react'
import { formatChrysalisCountdown } from '../lib/countdown'

const REFRESH_INTERVAL_MS = 60_000

export function ChrysalisCountdown({ emergeAt }: { emergeAt?: string }) {
  const [nowMs, setNowMs] = useState(Date.now)

  useEffect(() => {
    const refresh = () => setNowMs(Date.now())
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  const emergeDate = emergeAt ? new Date(emergeAt) : undefined
  const validEmergeDate =
    emergeDate && Number.isFinite(emergeDate.getTime()) ? emergeDate : undefined
  const exactTime = validEmergeDate
    ? validEmergeDate.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : undefined

  return (
    <time
      dateTime={validEmergeDate?.toISOString()}
      title={exactTime ? `Expected emergence: ${exactTime}` : undefined}
      aria-label={
        exactTime
          ? `${formatChrysalisCountdown(emergeAt, nowMs)}. Expected emergence ${exactTime}.`
          : undefined
      }
    >
      {formatChrysalisCountdown(emergeAt, nowMs)}
    </time>
  )
}
