import { describe, expect, it } from 'vitest'
import { awardMoonlight, createInitialState } from './progression'
import { careRhythm } from './rhythm'

const days = (...dates: string[]) => dates.map((localDate) => ({ localDate }))

describe('the rhythm of care', () => {
  it('counts each cared-for day once, however much was done', () => {
    expect(
      careRhythm(days('2026-06-12', '2026-06-13', '2026-06-13', '2026-06-14'), '2026-06-14'),
    ).toEqual({ lastSeven: 3, thisMonth: 3, longestRun: 3 })
  })

  it('never falls to nothing after one missed day', () => {
    // The old streak read 0 here. Five of the last seven still happened.
    const rhythm = careRhythm(
      days('2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-13'),
      '2026-06-14',
    )
    expect(rhythm).toEqual({ lastSeven: 5, thisMonth: 5, longestRun: 4 })
  })

  it('keeps the week and the month apart across a month boundary', () => {
    expect(careRhythm(days('2026-05-29', '2026-05-30', '2026-06-01', '2026-06-02'), '2026-06-02')).toEqual({
      lastSeven: 4,
      thisMonth: 2,
      longestRun: 2,
    })
  })

  it('looks only at days that have happened', () => {
    expect(careRhythm(days('2026-06-20'), '2026-06-14')).toEqual({
      lastSeven: 0,
      thisMonth: 0,
      longestRun: 0,
    })
  })

  it('crosses daylight-saving dates by calendar, not elapsed hours', () => {
    expect(careRhythm(days('2026-03-07', '2026-03-08', '2026-03-09'), '2026-03-09').longestRun).toBe(3)
  })

  it('is not moved by collecting Moonlight', () => {
    // A cared-for day means an act of care. If closing the day counted, the
    // rhythm could grow without one, and the Guide would stop being true.
    const state = awardMoonlight(
      createInitialState('Rhythm', 'Rhythm Garden'),
      '2026-03-09',
      {},
      new Date(2026, 2, 9, 21),
    )
    expect(state.moonlight).toHaveLength(1)
    expect(careRhythm(state.sunlight, '2026-03-09').lastSeven).toBe(0)
  })
})
