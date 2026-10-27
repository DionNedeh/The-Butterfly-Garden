import { describe, expect, it } from 'vitest'
import type { AppState, MoodEntry, RecapEntry, ReflectionEntry } from '../types'
import {
  BACKUP_REMINDER_DAYS,
  BACKUP_REMINDER_ENTRIES,
  backupReminder,
  isBackupDue,
} from './backupReminder'
import { createInitialState } from './progression'

const CREATED = new Date('2026-01-10T12:00:00.000Z')
const NOW = new Date('2026-10-27T15:00:00.000Z')
const DAY = 86_400_000

function garden(lastBackupAt?: string, overrides: Partial<AppState> = {}): AppState {
  const state = createInitialState('Tester', 'Reminders', CREATED)
  return {
    ...state,
    profile: { ...state.profile!, ...(lastBackupAt ? { lastBackupAt } : {}) },
    ...overrides,
  }
}

function daysBefore(days: number, from = NOW): string {
  return new Date(from.getTime() - days * DAY).toISOString()
}

function mood(createdAt: string, index: number): MoodEntry {
  return {
    id: `m${index}`,
    localDate: createdAt.slice(0, 10),
    level: 3,
    note: '',
    createdAt,
    updatedAt: createdAt,
  }
}

function reflection(createdAt: string, index: number): ReflectionEntry {
  return {
    id: `r${index}`,
    localDate: createdAt.slice(0, 10),
    promptId: 'p',
    body: 'Words',
    createdAt,
    updatedAt: createdAt,
  }
}

function recap(createdAt: string, index: number): RecapEntry {
  return {
    id: `e${index}`,
    localDate: createdAt.slice(0, 10),
    wentWell: '',
    settingDown: '',
    forTomorrow: '',
    createdAt,
    updatedAt: createdAt,
  }
}

/** `count` entries of every kind in turn, all written at `createdAt`. */
function entries(count: number, createdAt: string): Partial<AppState> {
  const moods: MoodEntry[] = []
  const reflections: ReflectionEntry[] = []
  const recaps: RecapEntry[] = []
  for (let index = 0; index < count; index += 1) {
    if (index % 3 === 0) moods.push(mood(createdAt, index))
    else if (index % 3 === 1) reflections.push(reflection(createdAt, index))
    else recaps.push(recap(createdAt, index))
  }
  return { moods, reflections, recaps }
}

describe('when to suggest a fresh copy', () => {
  it('says nothing about a recent copy with little written since', () => {
    const state = garden(daysBefore(3), entries(10, daysBefore(1)))
    expect(backupReminder(state, NOW)).toBeUndefined()
    expect(isBackupDue(state, NOW)).toBe(false)
  })

  it('suggests one once the last copy is a month old', () => {
    const justUnder = garden(daysBefore(BACKUP_REMINDER_DAYS - 0.01))
    expect(backupReminder(justUnder, NOW)).toBeUndefined()

    const lastBackupAt = '2026-03-14T15:00:00.000Z'
    expect(backupReminder(garden(lastBackupAt), NOW)).toEqual({
      lastBackupAt,
      reason: 'age',
      text: 'Your last copy is from March.',
    })
    expect(isBackupDue(garden(lastBackupAt), NOW)).toBe(true)
    expect(isBackupDue(garden(daysBefore(BACKUP_REMINDER_DAYS)), NOW)).toBe(true)
  })

  it('names the year of a copy from another year', () => {
    expect(backupReminder(garden('2025-11-14T15:00:00.000Z'), NOW)?.text).toBe(
      'Your last copy is from November 2025.',
    )
  })

  it('suggests one sooner after a lot of new writing', () => {
    const lastBackupAt = daysBefore(5)
    const written = daysBefore(2)
    const under = garden(lastBackupAt, entries(BACKUP_REMINDER_ENTRIES - 1, written))
    expect(backupReminder(under, NOW)).toBeUndefined()

    const enough = garden(lastBackupAt, entries(BACKUP_REMINDER_ENTRIES, written))
    expect(backupReminder(enough, NOW)).toEqual({
      lastBackupAt,
      reason: 'entries',
      text: 'Your last copy is from October.',
    })
  })

  it('counts only what was written after the copy, not what it already holds', () => {
    const lastBackupAt = daysBefore(5)
    const older = entries(BACKUP_REMINDER_ENTRIES * 2, daysBefore(6))
    expect(backupReminder(garden(lastBackupAt, older), NOW)).toBeUndefined()
    // Edited since, but written before: still in the copy, so not new.
    const edited = {
      ...older,
      moods: older.moods!.map((entry) => ({ ...entry, updatedAt: NOW.toISOString() })),
    }
    expect(backupReminder(garden(lastBackupAt, edited), NOW)).toBeUndefined()
  })

  it('counts from the garden’s first day when there has never been a copy', () => {
    const young = createInitialState('Tester', 'New', new Date(NOW.getTime() - 10 * DAY))
    expect(backupReminder(young, NOW)).toBeUndefined()

    expect(backupReminder(garden(), NOW)).toEqual({
      reason: 'age',
      text: 'You have not saved a copy yet.',
    })

    const busy = {
      ...young,
      ...entries(BACKUP_REMINDER_ENTRIES, daysBefore(1)),
    }
    expect(backupReminder(busy, NOW)).toEqual({
      reason: 'entries',
      text: 'You have not saved a copy yet.',
    })
  })

  it('treats a garden of unknown age as an old one', () => {
    const state = garden()
    const undated = { ...state, profile: { ...state.profile!, createdAt: 'unknown' } }
    expect(backupReminder(undated, NOW)?.reason).toBe('age')
  })

  it('believes a copy made a moment ahead of the clock, but not one from a wrong clock', () => {
    const justAhead = new Date(NOW.getTime() + 5_000).toISOString()
    expect(backupReminder(garden(justAhead), NOW)).toBeUndefined()

    // Stamped by a clock set a year ahead and since put right.
    const farAhead = new Date(NOW.getTime() + 365 * DAY).toISOString()
    expect(backupReminder(garden(farAhead), NOW)).toEqual({
      reason: 'age',
      text: 'You have not saved a copy yet.',
    })
  })

  it('says nothing before there is a garden', () => {
    const empty = garden(undefined, { profile: undefined })
    expect(backupReminder(empty, NOW)).toBeUndefined()
    expect(isBackupDue(empty, NOW)).toBe(false)
  })
})
