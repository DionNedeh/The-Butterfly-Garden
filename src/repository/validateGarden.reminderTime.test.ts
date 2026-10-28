import { describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import { validateGarden } from './validateGarden'

function garden(reminderTime: unknown) {
  const seed = createInitialState('Tester', 'Reminders')
  return { ...seed, profile: { ...seed.profile, reminderTime } }
}

describe('the time of the daily visit last added to a calendar', () => {
  it('is kept when it is a time of day', () => {
    for (const time of ['08:00', '18:30', '00:00', '23:59']) {
      const result = validateGarden(garden(time))
      expect(result.state?.profile?.reminderTime).toBe(time)
      expect(result.repaired).toBe(0)
    }
  })

  it('is dropped, without counting as damage, when it is anything else', () => {
    for (const time of ['8:00', '24:00', '08:00:00', 'morning', '', 800, true, null, { at: '08:00' }]) {
      const result = validateGarden(garden(time))
      expect(result.refused).toBeUndefined()
      expect(result.state?.profile).not.toHaveProperty('reminderTime')
      expect(result.repaired).toBe(0)
    }
  })

  it('is simply absent from a garden that never added one', () => {
    const seed = createInitialState('Tester', 'Reminders')
    expect(validateGarden(seed).state?.profile).not.toHaveProperty('reminderTime')
  })
})
