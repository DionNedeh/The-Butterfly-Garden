import type { SunlightAward } from '../types'

const DAY_MS = 86_400_000

function shiftLocalDate(localDate: string, days: number) {
  const [year, month, day] = localDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS)
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function calculateSunlightStreak(
  awards: Pick<SunlightAward, 'localDate'>[],
  today: string,
) {
  const activeDates = new Set(
    awards.map((award) => award.localDate).filter((date) => date <= today),
  )
  const completedToday = activeDates.has(today)
  let cursor = completedToday ? today : shiftLocalDate(today, -1)
  let days = 0

  while (activeDates.has(cursor)) {
    days += 1
    cursor = shiftLocalDate(cursor, -1)
  }

  return { days, completedToday }
}
