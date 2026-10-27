import { describe, expect, it } from 'vitest'
import type { AppState, Goal } from '../types'
import * as act from './gardenActions'
import { createInitialState, MAX_PLANT_GROWTH } from './progression'

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

  it('keeps a two-minute version trimmed, no longer than a title, and only when there is one', () => {
    const tinyOf = (tinyTitle?: string) =>
      act.addGoal(garden(), 'Stretch', 'daily', [], TODAY, tinyTitle).goals.at(-1)!
    expect(tinyOf('  Roll your shoulders  ').tinyTitle).toBe('Roll your shoulders')
    expect(tinyOf('a'.repeat(act.GOAL_TITLE_LENGTH + 30)).tinyTitle).toHaveLength(
      act.GOAL_TITLE_LENGTH,
    )
    for (const none of [undefined, '', '   ']) {
      expect(tinyOf(none)).not.toHaveProperty('tinyTitle')
    }
  })

  it('edits a two-minute version, and takes one away when it is cleared', () => {
    const before = garden({ goals: [goal({ tinyTitle: 'Water one plant' })] })
    const edited = act.updateGoal(before, goal({ tinyTitle: '  Water one leaf ' }))
    expect(edited.goals[0].tinyTitle).toBe('Water one leaf')
    for (const cleared of [undefined, ' ']) {
      expect(act.updateGoal(before, goal({ tinyTitle: cleared })).goals[0]).not.toHaveProperty(
        'tinyTitle',
      )
    }
    // The goal it was given is left as it was.
    const given = goal({ tinyTitle: ' padded ' })
    act.updateGoal(before, given)
    expect(given.tinyTitle).toBe(' padded ')
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

  it('takes back a completion without taking back its Sunlight, or paying twice', () => {
    const before = garden({ goals: [goal()] })
    const done = act.completeGoal(before, 'g1', NOW)
    const undone = act.uncompleteGoal(done, 'g1', TODAY)
    expect(undone.completions).toEqual([])
    expect(undone.sunlight).toEqual(done.sunlight)
    expect(act.uncompleteGoal(undone, 'g1', TODAY)).toBe(undone)
    // Completing again counts the goal, and earns nothing more.
    expect(act.completeGoal(undone, 'g1', NOW).sunlight).toHaveLength(1)
  })

  it('puts a deleted goal back where it was, with its completions', () => {
    const completion = { id: 'g2:2026-10-25', goalId: 'g2', localDate: '2026-10-25', completedAt: '' }
    const before = garden({
      goals: [goal(), goal({ id: 'g2', title: 'Second' }), goal({ id: 'g3' })],
      completions: [completion],
    })
    const deleted = act.deleteGoal(before, 'g2')
    const restored = act.restoreGoal(deleted, before.goals[1], 1, [completion])
    expect(restored.goals.map((item) => item.id)).toEqual(['g1', 'g2', 'g3'])
    expect(restored.completions).toEqual([completion])
    // A goal already back is not doubled.
    expect(act.restoreGoal(restored, before.goals[1], 1, [completion])).toBe(restored)
    // An index past the end lands at the end.
    expect(act.restoreGoal(deleted, before.goals[1], 99, []).goals.at(-1)?.id).toBe('g2')
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

  it('keeps the feelings and energy given with a check-in, and only those', () => {
    const tagged = act.saveMood(garden(), 2, '', NOW, {
      feelings: ['tired', 'hopeful', 'tired', 'ecstatic'],
      energy: 'low',
    })
    expect(tagged.moods[0]).toMatchObject({ feelings: ['hopeful', 'tired'], energy: 'low' })

    // Rewritten without them, the check-in keeps none behind, and an empty
    // list is never stored.
    const later = new Date(2026, 9, 26, 18)
    const plain = act.saveMood(tagged, 2, '', later, { feelings: [] })
    expect(plain.moods[0]).not.toHaveProperty('feelings')
    expect(plain.moods[0]).not.toHaveProperty('energy')
  })

  it('earns the same Sunlight whatever the feelings and energy', () => {
    const before = garden()
    const plain = act.saveMood(before, 3, '', NOW)
    const tagged = act.saveMood(before, 3, '', NOW, { feelings: ['joyful'], energy: 'bright' })
    expect(tagged.sunlight).toHaveLength(plain.sunlight.length)
    expect(tagged.seeds).toBe(plain.seeds)
    expect(tagged.plants).toEqual(plain.plants)
  })

  it('writes today’s reflection once and rewrites it after', () => {
    const first = act.saveReflection(garden(), 'notice', 'The light', NOW)
    const again = act.saveReflection(first, 'notice', 'The rain', NOW)
    expect(again.reflections).toHaveLength(1)
    expect(again.reflections[0].body).toBe('The rain')
  })

  it('records "not sure" as an answer that earns the same Sunlight', () => {
    const unsure = act.saveMood(garden(), 'unsure', '', NOW)
    expect(unsure.moods[0]).toMatchObject({ level: 3, unsure: true })
    expect(unsure.sunlight).toHaveLength(1)
    // Choosing a weather later the same day clears the flag.
    const sure = act.saveMood(unsure, 2, '', new Date(2026, 9, 26, 20))
    expect(sure.moods[0].level).toBe(2)
    expect(sure.moods[0].unsure).toBeUndefined()
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

  it('keeps tomorrow’s notes one per line, leaving out empty ones', () => {
    const before = garden({ goals: [goal()] })
    const closed = act.collectMoonlight(
      before,
      TODAY,
      {
        tomorrow: [
          { text: '  Book it  ', plan: false },
          { text: '   ', plan: true },
          { text: 'Call Mum', plan: false },
        ],
      },
      NOW,
    )
    expect(closed.recaps[0].forTomorrow).toBe('Book it\nCall Mum')
    // Nothing was planned, so nothing is added to tomorrow, not even for the
    // blank note that was marked.
    expect(closed.goals).toEqual(before.goals)
    expect(closed.recaps[0].plannedGoalId).toBeUndefined()
    expect(closed.recaps[0].plannedGoalIds).toBeUndefined()
  })

  it('plans each marked note as a goal for the day after the one closed', () => {
    const before = garden({ goals: [goal()] })
    const closed = act.collectMoonlight(
      before,
      '2026-10-25',
      {
        tomorrow: [
          { text: ' Book it ', plan: true },
          { text: 'Stretch', plan: false },
          { text: 'Call Mum', plan: true },
        ],
      },
      new Date(2026, 9, 26, 1, 15),
    )
    const planned = closed.goals.slice(before.goals.length)
    expect(closed.goals[0]).toBe(before.goals[0])
    expect(planned).toHaveLength(2)
    for (const [index, title] of ['Book it', 'Call Mum'].entries()) {
      expect(planned[index]).toMatchObject({
        title,
        schedule: 'once',
        weekdays: [],
        createdDate: TODAY,
        archived: false,
        scheduledDate: '2026-10-26',
      })
    }
    expect(closed.recaps[0]).toMatchObject({
      forTomorrow: 'Book it\nStretch\nCall Mum',
      plannedGoalId: planned[0].id,
      plannedGoalIds: planned.map((item) => item.id),
    })
  })

  it('takes no more than three notes for tomorrow', () => {
    const notes = ['', 'One', 'Two', 'Three', 'Four'].map((text) => ({ text, plan: true }))
    const closed = act.collectMoonlight(garden(), TODAY, { tomorrow: notes }, NOW)
    expect(act.TOMORROW_NOTES).toBe(3)
    // The empty note does not take one of the three places.
    expect(closed.recaps[0].forTomorrow).toBe('One\nTwo\nThree')
    expect(closed.goals.map((item) => item.title)).toEqual(['One', 'Two', 'Three'])
    expect(closed.recaps[0].plannedGoalIds).toHaveLength(act.TOMORROW_NOTES)
  })

  it('keeps a note that becomes a goal to a goal title’s length', () => {
    // A draft left by an older build is not held to the field's limit.
    const long = 'a'.repeat(act.TOMORROW_NOTE_LENGTH + 50)
    const closed = act.collectMoonlight(
      garden(),
      TODAY,
      { tomorrow: [{ text: long, plan: true }] },
      NOW,
    )
    expect(closed.goals[0].title).toHaveLength(act.TOMORROW_NOTE_LENGTH)
    // The note itself is kept whole: nothing the gardener wrote is dropped.
    expect(closed.recaps[0].forTomorrow).toBe(long)
    expect(act.TOMORROW_TEXT_LENGTH).toBe(3 * act.TOMORROW_NOTE_LENGTH + 2)
  })

  it('still reads a single note from an older draft, planning it only when asked', () => {
    const kept = act.collectMoonlight(garden(), TODAY, { forTomorrow: '  Rest  ' }, NOW)
    expect(kept.recaps[0].forTomorrow).toBe('Rest')
    expect(kept.goals).toEqual([])
    expect(kept.recaps[0].plannedGoalIds).toBeUndefined()

    const planned = act.collectMoonlight(
      garden(),
      TODAY,
      { forTomorrow: 'Rest', planForTomorrow: true },
      NOW,
    )
    const added = planned.goals.at(-1)
    expect(added).toMatchObject({ title: 'Rest', scheduledDate: '2026-10-27' })
    expect(planned.recaps[0]).toMatchObject({
      plannedGoalId: added?.id,
      plannedGoalIds: [added?.id],
    })
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

  it('leaves the garden as it was when a rename changes nothing', () => {
    const before = garden()
    const [starter] = before.creatures
    expect(act.renameCreature(before, starter.id, ` ${starter.name} `)).toBe(before)
    expect(act.renameCreature(before, 'nobody', 'Pip')).toBe(before)
  })

  it('answers the offer to name a new egg, whether named or kept', () => {
    const base = garden()
    const egg = { ...base.creatures[0], id: 'egg', name: 'Clover', stage: 'egg' as const, awaitingName: true }
    const before = garden({ creatures: [base.creatures[0], egg] })

    const named = act.renameCreature(before, 'egg', 'Pip')
    expect(named.creatures[1]).toEqual({ ...egg, name: 'Pip', awaitingName: undefined })
    expect(named.creatures[1]).not.toHaveProperty('awaitingName')
    // The other companion is the very same object, so nothing else is saved.
    expect(named.creatures[0]).toBe(before.creatures[0])

    const kept = act.renameCreature(before, 'egg', 'Clover')
    expect(kept).not.toBe(before)
    expect(kept.creatures[1].name).toBe('Clover')
    expect(kept.creatures[1]).not.toHaveProperty('awaitingName')
    expect(before.creatures[1].awaitingName).toBe(true)
  })

  it('chooses a companion, a track, a theme and sound', () => {
    const before = garden()
    expect(act.selectCompanion(before, 'c9').profile?.activeCompanionId).toBe('c9')
    expect(act.selectAmbientTrack(before, 'piano-music').profile?.ambientTrack).toBe('piano-music')
    expect(act.toggleTheme(before).profile?.theme).toBe('night')
    expect(act.toggleTheme(act.toggleTheme(before)).profile?.theme).toBe('sunlight')
    expect(act.toggleAmbientSound(before).profile?.ambientSound).toBe(!before.profile?.ambientSound)
  })

  it('chooses a theme by hand, which ends following', () => {
    const following = act.chooseTheme(garden(), 'evening')
    const night = act.chooseTheme(following, 'night')
    expect(night.profile).toMatchObject({ theme: 'night', themeFollows: undefined })
    expect(act.chooseTheme(night, 'sunlight').profile?.theme).toBe('sunlight')
    // The same choice again changes nothing, so nothing is written.
    expect(act.chooseTheme(night, 'night')).toBe(night)
    // Back to the hand-chosen theme it already had: only the following ends.
    const sunlitFollowing = act.chooseTheme(garden(), 'device')
    const sunlit = act.chooseTheme(sunlitFollowing, 'sunlight')
    expect(sunlit).not.toBe(sunlitFollowing)
    expect(sunlit.profile).toMatchObject({ theme: 'sunlight', themeFollows: undefined })
  })

  it('follows the device or the evening, keeping the theme chosen by hand beneath', () => {
    const night = act.chooseTheme(garden(), 'night')
    const device = act.chooseTheme(night, 'device')
    expect(device.profile).toMatchObject({ theme: 'night', themeFollows: 'device' })
    const evening = act.chooseTheme(device, 'evening')
    expect(evening.profile).toMatchObject({ theme: 'night', themeFollows: 'evening' })
    expect(act.chooseTheme(evening, 'evening')).toBe(evening)
    expect(night.profile?.themeFollows).toBeUndefined()
  })

  it('switches from the theme on screen, and stops following', () => {
    const before = garden()
    // Following the evening, at night: the switch turns the garden to sunlight.
    const evening = act.chooseTheme(before, 'evening')
    const switched = act.toggleTheme(evening, 'night')
    expect(switched.profile).toMatchObject({ theme: 'sunlight', themeFollows: undefined })
    // Following the device in daylight, with night chosen by hand beneath:
    // the switch turns it to night by hand.
    const device = act.chooseTheme(act.chooseTheme(before, 'night'), 'device')
    expect(act.toggleTheme(device, 'sunlight').profile).toMatchObject({
      theme: 'night',
      themeFollows: undefined,
    })
  })

  it('sets a larger text size, and the usual one again', () => {
    const before = garden()
    const largest = act.setTextSize(before, 'largest')
    expect(largest.profile?.textSize).toBe('largest')
    expect(act.setTextSize(largest, 'larger').profile?.textSize).toBe('larger')
    expect(act.setTextSize(largest, undefined).profile?.textSize).toBeUndefined()
    expect(act.setTextSize(largest, 'largest')).toBe(largest)
    expect(act.setTextSize(before, undefined)).toBe(before)
    expect(before.profile?.textSize).toBeUndefined()
  })

  it('leaves a garden with no gardener yet untouched', () => {
    const empty = garden({ profile: undefined })
    expect(act.selectCompanion(empty, 'c1')).toBe(empty)
    expect(act.toggleTheme(empty)).toBe(empty)
    expect(act.chooseTheme(empty, 'device')).toBe(empty)
    expect(act.setTextSize(empty, 'larger')).toBe(empty)
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

  it('hides and shows day counts, and switches sound to a given state', () => {
    const hidden = act.setDayCountsHidden(garden(), true)
    expect(hidden.profile?.hideDayCounts).toBe(true)
    expect(act.setDayCountsHidden(hidden, true)).toBe(hidden)
    expect(act.setDayCountsHidden(hidden, false).profile?.hideDayCounts).toBe(false)

    const on = act.setAmbientSound(garden(), true)
    expect(on.profile?.ambientSound).toBe(true)
    expect(act.setAmbientSound(on, true)).toBe(on)
    expect(act.setAmbientSound(on, false).profile?.ambientSound).toBe(false)
    const empty = garden({ profile: undefined })
    expect(act.setDayCountsHidden(empty, true)).toBe(empty)
    expect(act.setAmbientSound(empty, true)).toBe(empty)
  })

  it('asks the next Sunlight to tend a chosen plant, and lets the choice go', () => {
    const before = garden()
    const id = before.plants[1].id
    const chosen = act.chooseNextPlant(before, id)
    expect(chosen.profile?.tendFirstPlantId).toBe(id)
    expect(chosen.plants).toBe(before.plants)
    expect(act.chooseNextPlant(chosen, id)).toBe(chosen)
    const released = act.chooseNextPlant(chosen, undefined)
    expect(released.profile?.tendFirstPlantId).toBeUndefined()
    expect(act.chooseNextPlant(before, undefined)).toBe(before)
    const empty = garden({ profile: undefined })
    expect(act.chooseNextPlant(empty, id)).toBe(empty)
  })

  it('ignores a plant that is not in the garden, or is fully grown', () => {
    const before = garden()
    expect(act.chooseNextPlant(before, 'no-such-plant')).toBe(before)
    const grown = {
      ...before,
      plants: before.plants.map((plant, index) =>
        index === 1 ? { ...plant, growth: MAX_PLANT_GROWTH } : plant,
      ),
    }
    expect(act.chooseNextPlant(grown, grown.plants[1].id)).toBe(grown)
  })

  it('makes a day gentle, and ordinary again', () => {
    const before = garden()
    const gentle = act.setGentleDay(before, TODAY)
    expect(gentle.profile?.gentleDay).toBe(TODAY)
    expect(act.setGentleDay(gentle, TODAY)).toBe(gentle)
    const ordinary = act.setGentleDay(gentle, undefined)
    expect(ordinary.profile?.gentleDay).toBeUndefined()
    expect(act.setGentleDay(before, undefined)).toBe(before)
    // Another day replaces a gentle day that has run out.
    expect(act.setGentleDay(gentle, '2026-10-27').profile?.gentleDay).toBe('2026-10-27')
    const empty = garden({ profile: undefined })
    expect(act.setGentleDay(empty, TODAY)).toBe(empty)
  })

  it('moves the gardener’s evening, and only to hours on offer', () => {
    const moved = act.setRecapHours(garden(), { opensHour: 21, graceEndsHour: 6 })
    expect(moved.profile).toMatchObject({ recapOpensHour: 21, recapGraceEndsHour: 6 })
    expect(act.setRecapHours(moved, { opensHour: 21, graceEndsHour: 6 })).toBe(moved)
    // The defaults, chosen explicitly, change nothing that needs saving.
    const fresh = garden()
    expect(act.setRecapHours(fresh, { opensHour: 18, graceEndsHour: 4 })).toBe(fresh)
    expect(act.setRecapHours(moved, { opensHour: 5, graceEndsHour: 6 })).toBe(moved)
    expect(act.setRecapHours(moved, { opensHour: 21, graceEndsHour: 12 })).toBe(moved)
    const empty = garden({ profile: undefined })
    expect(act.setRecapHours(empty, { opensHour: 21, graceEndsHour: 6 })).toBe(empty)
  })

  it('remembers when a copy was kept, writing nothing for the same moment', () => {
    const before = garden()
    const madeAt = new Date('2026-03-14T09:30:00.000Z')
    const kept = act.recordBackup(before, madeAt)
    expect(kept.profile?.lastBackupAt).toBe('2026-03-14T09:30:00.000Z')
    expect(before.profile).not.toHaveProperty('lastBackupAt')
    expect(act.recordBackup(kept, new Date(madeAt))).toBe(kept)
    const later = act.recordBackup(kept, new Date('2026-04-01T08:00:00.000Z'))
    expect(later.profile?.lastBackupAt).toBe('2026-04-01T08:00:00.000Z')
    // No gardener yet, or a clock reading that is no time at all.
    const empty = garden({ profile: undefined })
    expect(act.recordBackup(empty, madeAt)).toBe(empty)
    expect(act.recordBackup(kept, new Date(Number.NaN))).toBe(kept)
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
