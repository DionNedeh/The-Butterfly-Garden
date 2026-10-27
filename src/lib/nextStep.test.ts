import { describe, expect, it } from 'vitest'
import type { MoodEntry } from '../types'
import { isHeavyCheckIn, nextStepsAfter, type NextStepContext } from './nextStep'

type CheckIn = Pick<MoodEntry, 'level' | 'unsure' | 'energy'>

const everything: NextStepContext = {
  canMakeGentle: true,
  canReflect: true,
  canVisitCompanion: true,
}

describe('a heavy check-in', () => {
  it('is Stormy or Rainy weather', () => {
    expect(isHeavyCheckIn({ level: 1 })).toBe(true)
    expect(isHeavyCheckIn({ level: 2 })).toBe(true)
    expect(isHeavyCheckIn({ level: 3 })).toBe(false)
    expect(isHeavyCheckIn({ level: 5 })).toBe(false)
  })

  it('is low energy, whatever the weather', () => {
    expect(isHeavyCheckIn({ level: 5, energy: 'low' })).toBe(true)
    expect(isHeavyCheckIn({ level: 3, unsure: true, energy: 'low' })).toBe(true)
    expect(isHeavyCheckIn({ level: 4, energy: 'steady' })).toBe(false)
  })

  it('is never "not sure" on its own, though it is stored at the middle level', () => {
    expect(isHeavyCheckIn({ level: 3, unsure: true })).toBe(false)
  })
})

describe('the next step after a check-in', () => {
  it('offers a gentle day, one line and a companion after heavy weather', () => {
    expect(nextStepsAfter({ level: 1 }, everything)).toEqual([
      'gentle-day',
      'write-one-line',
      'visit-companion',
    ])
    expect(nextStepsAfter({ level: 4, energy: 'low' }, everything)).toEqual([
      'gentle-day',
      'write-one-line',
      'visit-companion',
    ])
  })

  it('offers a few slow breaths after heavy weather, where breathing can be opened', () => {
    const breathing = { ...everything, canBreathe: true }
    expect(nextStepsAfter({ level: 1 }, breathing)).toEqual([
      'gentle-day',
      'breathe',
      'write-one-line',
      'visit-companion',
    ])
    expect(nextStepsAfter({ level: 4, energy: 'low' }, { ...breathing, canMakeGentle: false })[0]).toBe(
      'breathe',
    )
    // Never in place of the reflection after an ordinary day.
    expect(nextStepsAfter({ level: 4 }, breathing)).toEqual(['reflection'])
  })

  it('offers the day’s reflection after anything else, "not sure" included', () => {
    const others: CheckIn[] = [{ level: 3 }, { level: 5, energy: 'bright' }, { level: 3, unsure: true }]
    for (const checkIn of others) expect(nextStepsAfter(checkIn, everything)).toEqual(['reflection'])
  })

  it('leaves out what is already done or out of reach', () => {
    expect(nextStepsAfter({ level: 2 }, { ...everything, canMakeGentle: false })).toEqual([
      'write-one-line',
      'visit-companion',
    ])
    expect(nextStepsAfter({ level: 2 }, { ...everything, canReflect: false })).toEqual([
      'gentle-day',
      'visit-companion',
    ])
    expect(nextStepsAfter({ level: 2 }, { ...everything, canVisitCompanion: false })).toEqual([
      'gentle-day',
      'write-one-line',
    ])
  })

  it('offers nothing when nothing is left to suggest', () => {
    expect(nextStepsAfter({ level: 4 }, { ...everything, canReflect: false })).toEqual([])
    expect(
      nextStepsAfter({ level: 1 }, { canMakeGentle: false, canReflect: false, canVisitCompanion: false }),
    ).toEqual([])
  })
})
