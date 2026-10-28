import { describe, expect, it } from 'vitest'
import { createInitialState } from './progression'
import { isReminderTime, setReminderTime } from './reminderTime'

describe('the time of a daily visit', () => {
  it('is a time of day on a 24-hour clock, as a time field reports it', () => {
    for (const time of ['00:00', '08:00', '09:45', '18:00', '23:59'])
      expect(isReminderTime(time)).toBe(true)
    for (const time of ['8:00', '24:00', '12:60', '08:00:00', '08.00', ' 08:00', '', 800, null])
      expect(isReminderTime(time)).toBe(false)
  })

  it('is remembered, and the same garden comes back when nothing changes', () => {
    const before = createInitialState('Tester', 'Reminders')
    const after = setReminderTime(before, '18:00')
    expect(after.profile?.reminderTime).toBe('18:00')
    expect(after.profile).toMatchObject({ name: 'Tester' })
    expect(before.profile).not.toHaveProperty('reminderTime')
    expect(setReminderTime(after, '18:00')).toBe(after)
    expect(setReminderTime(after, '7pm')).toBe(after)
    const empty = { ...before, profile: undefined }
    expect(setReminderTime(empty, '08:00')).toBe(empty)
  })
})
