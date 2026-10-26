import { describe, expect, it } from 'vitest'
import type { AppState, Goal } from '../types'
import * as act from './gardenActions'
import { createInitialState } from './progression'

const NOW = new Date(2026, 9, 26, 10)
const TODAY = '2026-10-26'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Tester', 'Actions'), ...overrides }
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Water the plants',
    schedule: 'daily',
    weekdays: [],
    createdDate: '2026-10-01',
    archived: false,
    ...overrides,
  }
}

describe('goals', () => {
  it('adds a trimmed goal created today', () => {
    const after = act.addGoal(garden(), '  Walk  ', 'weekdays', [1, 3], TODAY)
    expect(after.goals.at(-1)).toMatchObject({
      title: 'Walk',
      schedule: 'weekdays',
      weekdays: [1, 3],
      createdDate: TODAY,
      archived: false,
    })
  })

  it('plans a one-off goal, and ignores a blank one', () => {
    const before = garden()
    expect(act.planGoal(before, '   ', '2026-10-27', TODAY)).toBe(before)
    const after = act.planGoal(before, 'Call Mum', '2026-10-27', TODAY)
    expect(after.goals.at(-1)).toMatchObject({
      title: 'Call Mum',
      schedule: 'once',
      scheduledDate: '2026-10-27',
    })
  })

  it('skips a goal for a day, and takes the skip back', () => {
    const before = garden({ goals: [goal()] })
    const skipped = act.skipGoal(before, 'g1', TODAY)
    expect(skipped.goals[0].skippedDates).toEqual([TODAY])
    expect(act.skipGoal(skipped, 'g1', TODAY).goals[0].skippedDates).toEqual([])
  })

  it('snoozes at least a day, moving a planned goal with it, and wakes it', () => {
    const before = garden({
      goals: [goal(), goal({ id: 'g2', schedule: 'once', scheduledDate: TODAY })],
    })
    const snoozed = act.snoozeGoal(before, 'g2', 0, TODAY)
    expect(snoozed.goals[1]).toMatchObject({
      snoozedUntil: '2026-10-27',
      scheduledDate: '2026-10-27',
    })
    expect(act.wakeGoal(snoozed, 'g2').goals[1].snoozedUntil).toBeUndefined()
    // A repeating goal keeps its schedule while snoozed.
    expect(act.snoozeGoal(before, 'g1', 3, TODAY).goals[0].scheduledDate).toBeUndefined()
  })

  it('archives, updates and deletes, taking completions with a deleted goal', () => {
    const before = garden({
      goals: [goal()],
      completions: [{ id: 'g1:2026-10-25', goalId: 'g1', localDate: '2026-10-25', completedAt: '' }],
    })
    expect(act.setGoalArchived(before, 'g1', true).goals[0].archived).toBe(true)
    expect(act.updateGoal(before, goal({ title: 'Renamed' })).goals[0].title).toBe('Renamed')
    const deleted = act.deleteGoal(before, 'g1')
    expect(deleted.goals).toEqual([])
    expect(deleted.completions).toEqual([])
  })

  it('completes a goal once a day and earns Sunlight for it', () => {
    const before = garden({ goals: [goal()] })
    const once = act.completeGoal(before, 'g1', NOW)
    expect(once.completions).toHaveLength(1)
    expect(once.sunlight).toHaveLength(1)
    expect(act.completeGoal(once, 'g1', NOW)).toBe(once)
  })
})

describe('the journal', () => {
  it('writes today’s check-in once and rewrites it after', () => {
    const first = act.saveMood(garden(), 3, '  Calm  ', NOW)
    expect(first.moods).toHaveLength(1)
    expect(first.moods[0].note).toBe('Calm')
    const rewritten = act.saveMood(first, 5, 'Bright', new Date(2026, 9, 26, 18))
    expect(rewritten.moods).toHaveLength(1)
    expect(rewritten.moods[0]).toMatchObject({ id: first.moods[0].id, level: 5, note: 'Bright' })
    expect(rewritten.moods[0].createdAt).toBe(first.moods[0].createdAt)
    // Rewriting earns nothing more.
    expect(rewritten.sunlight).toHaveLength(1)
  })

  it('writes today’s reflection once and rewrites it after', () => {
    const first = act.saveReflection(garden(), 'notice', 'The light', NOW)
    const again = act.saveReflection(first, 'notice', 'The rain', NOW)
    expect(again.reflections).toHaveLength(1)
    expect(again.reflections[0].body).toBe('The rain')
  })

  it('stamps an edit and deletes an entry', () => {
    const written = act.saveMood(garden(), 3, 'x', NOW)
    const later = new Date(2026, 9, 27)
    const edited = act.updateMood(written, { ...written.moods[0], note: 'y' }, later)
    expect(edited.moods[0]).toMatchObject({ note: 'y', updatedAt: later.toISOString() })
    expect(act.deleteMood(edited, edited.moods[0].id).moods).toEqual([])

    const reflected = act.saveReflection(garden(), 'notice', 'a', NOW)
    const changed = act.updateReflection(reflected, { ...reflected.reflections[0], body: 'b' }, later)
    expect(changed.reflections[0].body).toBe('b')
    expect(act.deleteReflection(changed, changed.reflections[0].id).reflections).toEqual([])
  })
})

describe('the evening recap', () => {
  it('collects a night once, planning tomorrow from the day being closed', () => {
    const closed = act.collectMoonlight(
      garden(),
      '2026-10-25',
      { wentWell: 'A walk', forTomorrow: '  Book it  ', planForTomorrow: true },
      new Date(2026, 9, 26, 1, 15),
    )
    expect(closed.recaps).toHaveLength(1)
    expect(closed.goals.at(-1)).toMatchObject({ title: 'Book it', scheduledDate: '2026-10-26' })
    expect(act.collectMoonlight(closed, '2026-10-25', {}, NOW)).toBe(closed)
  })

  it('edits and deletes a recap without paying out again', () => {
    const closed = act.collectMoonlight(garden(), TODAY, { wentWell: 'Tea' }, NOW)
    const edited = act.updateRecap(closed, { ...closed.recaps[0], wentWell: 'Coffee' }, NOW)
    expect(edited.recaps[0].wentWell).toBe('Coffee')
    const deleted = act.deleteRecap(edited, edited.recaps[0].id)
    expect(deleted.recaps).toEqual([])
    expect(deleted.moonlight).toEqual(closed.moonlight)
  })
})

describe('the gardener and their companions', () => {
  it('renames a companion, but never to nothing', () => {
    const before = garden()
    const id = before.creatures[0].id
    expect(act.renameCreature(before, id, '  Pip ').creatures[0].name).toBe('Pip')
    expect(act.renameCreature(before, id, '   ')).toBe(before)
  })

  it('chooses a companion, a track, a theme and sound', () => {
    const before = garden()
    expect(act.selectCompanion(before, 'c9').profile?.activeCompanionId).toBe('c9')
    expect(act.selectAmbientTrack(before, 'piano-music').profile?.ambientTrack).toBe('piano-music')
    expect(act.toggleTheme(before).profile?.theme).toBe('night')
    expect(act.toggleTheme(act.toggleTheme(before)).profile?.theme).toBe('sunlight')
    expect(act.toggleAmbientSound(before).profile?.ambientSound).toBe(!before.profile?.ambientSound)
  })

  it('leaves a garden with no gardener yet untouched', () => {
    const empty = garden({ profile: undefined })
    expect(act.selectCompanion(empty, 'c1')).toBe(empty)
    expect(act.toggleTheme(empty)).toBe(empty)
    expect(act.updateProfile(empty, 'A', 'B', 'calm')).toBe(empty)
    expect(act.markReleaseSeen(empty, 'r')).toBe(empty)
  })

  it('keeps names when left blank, and sets motion from one choice', () => {
    const after = act.updateProfile(garden(), ' ', ' ', 'calm')
    expect(after.profile).toMatchObject({
      name: 'Tester',
      gardenName: 'Actions',
      reducedMotion: false,
      calmMotion: true,
    })
    expect(act.updateProfile(garden(), 'A', 'B', 'reduce').profile).toMatchObject({
      reducedMotion: true,
      calmMotion: false,
    })
  })

  it('remembers release notes read, writing nothing the second time', () => {
    const read = act.markReleaseSeen(garden(), 'release-3-0')
    expect(read.profile?.lastSeenReleaseId).toBe('release-3-0')
    expect(act.markReleaseSeen(read, 'release-3-0')).toBe(read)
  })

  it('chooses only a scene that is available, and drops a custom image for it', () => {
    const before = garden()
    const chosen = act.selectBackdrop(
      { ...before, profile: { ...before.profile!, selectedCustomBackdropId: 'mine' } },
      'cottage-bloom',
      NOW,
    )
    expect(chosen.profile).toMatchObject({
      selectedBackdropId: 'cottage-bloom',
      selectedCustomBackdropId: undefined,
    })
    // Secret Conservatory waits for a garden sixty days old.
    const refused = act.selectBackdrop(before, 'secret-conservatory', NOW)
    expect(refused.profile?.selectedBackdropId).toBe(before.profile?.selectedBackdropId)
  })
})
