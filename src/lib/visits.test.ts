import { describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { toLocalDate } from './date'
import { createEmptyState, createInitialState } from './progression'
import {
  daysAway,
  DAYS_AWAY_FOR_A_WELCOME,
  noteVisit,
  putAwayWelcomeBack,
  welcomeBackToday,
} from './visits'

function visitedOn(lastVisitOn: string | undefined, extra = {}): AppState {
  const garden = createInitialState('Tester', 'Visits', new Date(2026, 0, 5, 9))
  const profile = { ...garden.profile!, ...extra }
  if (lastVisitOn === undefined) delete profile.lastVisitOn
  else profile.lastVisitOn = lastVisitOn
  return { ...garden, profile }
}

describe('days away', () => {
  it('counts local calendar days, not 24-hour stretches', () => {
    // Late on a Monday to early on a Thursday: barely 50 hours, three days.
    const left = new Date(2026, 9, 5, 23, 30)
    const back = new Date(2026, 9, 8, 0, 15)
    expect(daysAway(toLocalDate(left), toLocalDate(back))).toBe(3)
    expect(daysAway('2026-10-05', '2026-10-05')).toBe(0)
  })

  it('is unbothered by the clocks changing in between', () => {
    // The tests run in New York, where the clocks went forward on 8 March
    // 2026 and back on 1 November: each crossing has a 23- or 25-hour day.
    const spring = [new Date(2026, 2, 7, 0, 10), new Date(2026, 2, 10, 23, 50)]
    // An hour short of the 95 hours 40 minutes the wall clock shows.
    expect((spring[1].getTime() - spring[0].getTime()) / 3_600_000).toBeCloseTo(94 + 40 / 60)
    expect(daysAway(toLocalDate(spring[0]), toLocalDate(spring[1]))).toBe(3)
    const autumn = [new Date(2026, 9, 31, 23, 59), new Date(2026, 10, 3, 0, 1)]
    expect(daysAway(toLocalDate(autumn[0]), toLocalDate(autumn[1]))).toBe(3)
  })
})

describe('noting a visit', () => {
  it('writes at most once a day: the same garden comes back on a day already noted', () => {
    const garden = visitedOn('2026-10-27')
    expect(noteVisit(garden, '2026-10-27')).toBe(garden)
  })

  it('moves the last visit on, with no welcome after a short gap', () => {
    for (const gap of [1, DAYS_AWAY_FOR_A_WELCOME - 1]) {
      const next = noteVisit(visitedOn('2026-10-20'), `2026-10-${20 + gap}`)
      expect(next.profile?.lastVisitOn).toBe(`2026-10-${20 + gap}`)
      expect(next.profile).not.toHaveProperty('welcomeBackOn')
    }
  })

  it('has a welcome ready on a return after three days or more, and changes nothing else', () => {
    const garden = visitedOn('2026-10-20')
    const back = noteVisit(garden, '2026-10-23')
    expect(back.profile).toEqual({
      ...garden.profile,
      lastVisitOn: '2026-10-23',
      welcomeBackOn: '2026-10-23',
    })
    // Nothing is granted and nothing else is touched.
    for (const key of Object.keys(garden) as Array<keyof AppState>) {
      if (key !== 'profile') expect(back[key]).toBe(garden[key])
    }
    expect(welcomeBackToday(back.profile, '2026-10-23')).toBe(true)
    expect(welcomeBackToday(back.profile, '2026-10-24')).toBe(false)
  })

  it('starts the record for an older garden without a welcome', () => {
    const next = noteVisit(visitedOn(undefined), '2026-10-27')
    expect(next.profile?.lastVisitOn).toBe('2026-10-27')
    expect(next.profile).not.toHaveProperty('welcomeBackOn')
  })

  it('moves a last visit in the future back to today, with no welcome', () => {
    const next = noteVisit(visitedOn('2026-12-25'), '2026-10-27')
    expect(next.profile?.lastVisitOn).toBe('2026-10-27')
    expect(next.profile).not.toHaveProperty('welcomeBackOn')
  })

  it('lets a welcome from an earlier day go, put away or not', () => {
    const next = noteVisit(
      visitedOn('2026-10-23', { welcomeBackOn: '2026-10-23' }),
      '2026-10-24',
    )
    expect(next.profile).not.toHaveProperty('welcomeBackOn')
  })

  it('does nothing for a garden not yet made', () => {
    const empty = createEmptyState()
    expect(noteVisit(empty, '2026-10-27')).toBe(empty)
  })
})

describe('putting the welcome away', () => {
  it('clears it, and is a no-op once it is away', () => {
    const out = visitedOn('2026-10-23', { welcomeBackOn: '2026-10-23' })
    const away = putAwayWelcomeBack(out)
    expect(away.profile).not.toHaveProperty('welcomeBackOn')
    expect(away.profile?.lastVisitOn).toBe('2026-10-23')
    expect(putAwayWelcomeBack(away)).toBe(away)
    const empty = createEmptyState()
    expect(putAwayWelcomeBack(empty)).toBe(empty)
  })

  it('is not offered again the same day', () => {
    const away = putAwayWelcomeBack(noteVisit(visitedOn('2026-10-20'), '2026-10-23'))
    expect(noteVisit(away, '2026-10-23')).toBe(away)
    expect(welcomeBackToday(away.profile, '2026-10-23')).toBe(false)
  })
})
