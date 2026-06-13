const MINUTE_MS = 60_000
const HOUR_MINUTES = 60
const DAY_MINUTES = 24 * HOUR_MINUTES

export function formatChrysalisCountdown(
  emergeAt: string | undefined,
  nowMs = Date.now(),
) {
  if (!emergeAt) return 'Time unknown'

  const emergeAtMs = new Date(emergeAt).getTime()
  if (!Number.isFinite(emergeAtMs)) return 'Time unknown'

  const remainingMs = emergeAtMs - nowMs
  if (remainingMs <= 0) return 'Ready to emerge'

  const totalMinutes = Math.ceil(remainingMs / MINUTE_MS)
  const days = Math.floor(totalMinutes / DAY_MINUTES)
  const hours = Math.floor((totalMinutes % DAY_MINUTES) / HOUR_MINUTES)
  const minutes = totalMinutes % HOUR_MINUTES

  if (days > 0) {
    return `${days}d ${hours}h${minutes > 0 ? ` ${minutes}m` : ''} remaining`
  }
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}
