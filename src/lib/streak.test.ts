import { describe, expect, it } from 'vitest'
import { awardMoonlight, createInitialState } from './progression'
import { calculateSunlightStreak } from './streak'

describe('daily Sunlight streak', () => {
  it('counts one or more Sunlight awards as a single active day', () => {
    expect(
      calculateSunlightStreak(
        [
          { localDate: '2026-06-12' },
          { localDate: '2026-06-13' },
          { localDate: '2026-06-13' },
          { localDate: '2026-06-14' },
        ],
        '2026-06-14',
      ),
    ).toEqual({ days: 3, completedToday: true })
  })

  it('keeps yesterday’s streak available until today is missed', () => {
    expect(
      calculateSunlightStreak(
        [{ localDate: '2026-06-12' }, { localDate: '2026-06-13' }],
        '2026-06-14',
      ),
    ).toEqual({ days: 2, completedToday: false })
  })

  it('resets after a fully missed calendar day', () => {
    expect(
      calculateSunlightStreak(
        [{ localDate: '2026-06-11' }, { localDate: '2026-06-12' }],
        '2026-06-14',
      ),
    ).toEqual({ days: 0, completedToday: false })
  })

  it('crosses daylight-saving calendar dates without elapsed-hour math', () => {
    expect(
      calculateSunlightStreak(
        [
          { localDate: '2026-03-07' },
          { localDate: '2026-03-08' },
          { localDate: '2026-03-09' },
        ],
        '2026-03-09',
      ),
    ).toEqual({ days: 3, completedToday: true })
  })

  it('is not advanced by collecting Moonlight', () => {
    // The journal tells gardeners that one Sunlight keeps the streak growing.
    // If closing the day counted, a streak could be kept alive without ever
    // performing an act of care, and that sentence would stop being true.
    const state = awardMoonlight(
      createInitialState('Streaky', 'Streaky Garden'),
      '2026-03-09',
      {},
      new Date(2026, 2, 9, 21),
    )

    expect(state.moonlight).toHaveLength(1)
    expect(calculateSunlightStreak(state.sunlight, '2026-03-09')).toEqual({
      days: 0,
      completedToday: false,
    })
  })
})
