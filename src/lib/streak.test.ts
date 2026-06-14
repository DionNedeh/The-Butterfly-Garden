import { describe, expect, it } from 'vitest'
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
})
