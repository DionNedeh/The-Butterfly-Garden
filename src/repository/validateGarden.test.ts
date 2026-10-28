import { describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import {
  MAX_GOAL_DAYS,
  MAX_OUTFIT_PRESETS,
  MAX_OUTFITS_WORN,
  PRESET_NAME_LENGTH,
} from '../lib/companionDiary'
import { formatJournalDate, isGoalDue, isLocalDate, toLocalDate } from '../lib/date'
import { REBLOOM_CARE_DAYS } from '../lib/gardenPace'
import { jarCharacters } from '../data/jars'
import { validateGarden } from './validateGarden'

function garden(overrides: Record<string, unknown> = {}) {
  return { ...createInitialState('Tester', 'Test Garden'), ...overrides }
}

describe('validating a garden', () => {
  it('hands back an undamaged garden with its collections untouched', () => {
    const stored = garden({
      goals: [
        {
          id: 'g1',
          title: 'Water the plants',
          schedule: 'daily',
          weekdays: [],
          createdDate: '2026-01-01',
          archived: false,
        },
      ],
    })
    const result = validateGarden(stored)
    expect(result.refused).toBeUndefined()
    expect(result.repaired).toBe(0)
    // Same identity, so the repository's dirty check writes nothing extra.
    expect(result.state?.goals).toBe(stored.goals)
    expect(result.state?.plants).toBe(stored.plants)
    expect(result.state?.sunlight).toBe(stored.sunlight)
  })

  it('accepts real calendar days only', () => {
    expect(isLocalDate('2026-10-26')).toBe(true)
    expect(isLocalDate('2024-02-29')).toBe(true)
    expect(isLocalDate('2026-02-30')).toBe(false)
    expect(isLocalDate('26-10-2026')).toBe(false)
    expect(isLocalDate(20261026)).toBe(false)
  })

  describe('a hand-edited or damaged backup', () => {
    it('no longer imports something that crashes every launch', () => {
      // The reproduction from the audit: this used to pass validation and
      // then throw while rendering, on every launch.
      const result = validateGarden(
        garden({ goals: [null], profile: { name: {}, gardenName: 'G' } }),
      )
      expect(result.state).toBeDefined()
      for (const goal of result.state!.goals) {
        expect(() => isGoalDue(goal, '2026-10-26')).not.toThrow()
      }
      expect(typeof result.state!.profile?.name).toBe('string')
      expect(result.repaired).toBeGreaterThan(0)
    })

    it('keeps text that arrived as the wrong type as text', () => {
      const result = validateGarden(
        garden({
          goals: [
            {
              id: 'g1',
              title: 1234,
              schedule: 'sometimes',
              weekdays: [1, 9, 'x'],
              createdDate: 'yesterday',
              archived: 'no',
            },
          ],
        }),
      )
      const [goal] = result.state!.goals
      expect(goal.title).toBe('1234')
      expect(goal.schedule).toBe('daily')
      expect(goal.weekdays).toEqual([1])
      expect(isLocalDate(goal.createdDate)).toBe(true)
      expect(goal.archived).toBe(false)
    })

    it('repairs what can be earned again and says how much', () => {
      const result = validateGarden(
        garden({
          inventory: { 'leaf-bundle': '3', 'spring-water': -2, 'nectar-drop': 2 },
          sunlight: [
            { id: 's1', localDate: 'not a day', source: 'x', awardedAt: '' },
            { id: 's2', localDate: '2026-10-25', source: 'mood:2026-10-25', awardedAt: '' },
          ],
          plants: [{ id: 'p1', plantId: 'aster', growth: 'tall', plantedAt: '' }, 7],
          nectar: Number.NaN,
          profile: { name: 'A', gardenName: 'B', theme: 'neon' },
        }),
      )
      const state = result.state!
      expect(state.inventory).toEqual({ 'nectar-drop': 2 })
      expect(state.sunlight).toHaveLength(1)
      expect(state.plants).toHaveLength(1)
      expect(state.plants[0].growth).toBe(0)
      expect(state.nectar).toBe(0)
      expect(state.profile?.theme).toBeUndefined()
      expect(result.repaired).toBeGreaterThanOrEqual(6)
    })

    it('refuses rather than drop a check-in it cannot place', () => {
      const result = validateGarden(
        garden({
          moods: [
            {
              id: 'm1',
              localDate: 'someday',
              level: 2,
              note: 'A hard week, but I made it.',
              createdAt: '',
              updatedAt: '',
            },
          ],
        }),
      )
      expect(result.state).toBeUndefined()
      expect(result.refused).toMatch(/check-in without a valid date/)
    })

    it('refuses rather than drop a reflection or a recap it cannot place', () => {
      expect(
        validateGarden(
          garden({
            reflections: [{ id: 'r1', localDate: '', promptId: 'notice', body: 'Words' }],
          }),
        ).refused,
      ).toMatch(/reflection/)
      expect(
        validateGarden(
          garden({ recaps: [{ id: 'c1', localDate: 3, wentWell: 'The walk' }] }),
        ).refused,
      ).toMatch(/recap/)
    })

    it('drops an empty entry it cannot place, since nothing written is lost', () => {
      const result = validateGarden(
        garden({
          moods: [{ id: 'm1', localDate: 'x', level: 3, note: '' }],
          recaps: [{ id: 'c1', wentWell: '', settingDown: '', forTomorrow: '' }],
        }),
      )
      expect(result.state?.moods).toEqual([])
      expect(result.state?.recaps).toEqual([])
    })

    it('fixes a check-in level and identity without losing its note', () => {
      const result = validateGarden(
        garden({ moods: [{ localDate: '2026-10-20', level: 9, note: 'Bright' }] }),
      )
      const [mood] = result.state!.moods
      expect(mood.level).toBe(5)
      expect(mood.note).toBe('Bright')
      expect(typeof mood.id).toBe('string')
      expect(() => formatJournalDate(mood.localDate)).not.toThrow()
    })

    it('gives a creature a name it can render and tidy care records', () => {
      const result = validateGarden(
        garden({
          creatures: [
            {
              id: 'c1',
              speciesId: 'monarch',
              name: 42,
              stage: 'emerged',
              careDates: { butterfly: ['2026-10-01', 'bad'], mystery: [] },
              actionLog: { sip: '2026-10-01', bad: 5 },
              outfit: { headwear: 'flower-crown', cape: 'x' },
              bond: -1,
            },
          ],
        }),
      )
      const [creature] = result.state!.creatures
      expect(creature.name).toBe('42')
      expect(creature.stage).toBe('butterfly')
      expect(creature.careDates).toEqual({ butterfly: ['2026-10-01'] })
      expect(creature.actionLog).toEqual({ sip: '2026-10-01' })
      expect(creature.outfit).toEqual({ headwear: 'flower-crown' })
      expect(creature.bond).toBe(0)
    })

    it('keeps an open offer to name an egg only when it is stored as true', () => {
      const egg = {
        ...createInitialState('Tester', 'Test Garden').creatures[0],
        stage: 'egg',
      }
      const result = validateGarden(
        garden({
          creatures: [
            { ...egg, id: 'open', awaitingName: true },
            { ...egg, id: 'answered', awaitingName: false },
            { ...egg, id: 'odd', awaitingName: 'yes' },
            { ...egg, id: 'older' },
          ],
        }),
      )
      const [open, ...rest] = result.state!.creatures
      expect(open.awaitingName).toBe(true)
      for (const creature of rest) expect(creature).not.toHaveProperty('awaitingName')
      // A dropped offer is not damage worth telling the gardener about.
      expect(result.repaired).toBe(0)
    })

    it('keeps a companion\'s own flight pattern only when it names a known one', () => {
      const flyer = {
        ...createInitialState('Tester', 'Test Garden').creatures[0],
        stage: 'butterfly',
      }
      const result = validateGarden(
        garden({
          // Owned or not: whether it is flown is decided when the garden is
          // drawn, so a pattern the garden does not own yet is kept.
          ownedFlightPatternIds: ['gentle-drift'],
          creatures: [
            { ...flyer, id: 'own', flightPatternId: 'petal-hop' },
            { ...flyer, id: 'unowned', flightPatternId: 'canopy-dance' },
            { ...flyer, id: 'unknown', flightPatternId: 'loop-the-loop' },
            { ...flyer, id: 'number', flightPatternId: 3 },
            { ...flyer, id: 'empty', flightPatternId: '' },
            { ...flyer, id: 'none', flightPatternId: null },
            { ...flyer, id: 'older' },
          ],
        }),
      )
      const [own, unowned, ...rest] = result.state!.creatures
      expect(own.flightPatternId).toBe('petal-hop')
      expect(unowned.flightPatternId).toBe('canopy-dance')
      for (const creature of rest) expect(creature).not.toHaveProperty('flightPatternId')
      // Flying the garden's pattern instead is no damage to report.
      expect(result.repaired).toBe(0)
    })

    it('carries a companion\'s own flight pattern through a backup unchanged', () => {
      const flyer = {
        ...createInitialState('Tester', 'Test Garden').creatures[0],
        stage: 'butterfly',
        flightPatternId: 'ribbon-loop',
      }
      const stored = garden({
        ownedFlightPatternIds: ['gentle-drift', 'ribbon-loop'],
        creatures: [flyer],
      })
      const once = validateGarden(JSON.parse(JSON.stringify(stored)) as unknown)
      const twice = validateGarden(JSON.parse(JSON.stringify(once.state)) as unknown)
      expect(twice.state!.creatures[0].flightPatternId).toBe('ribbon-loop')
      expect(twice.state!.creatures).toEqual(once.state!.creatures)
    })
  })

  describe('the feelings and energy of a check-in', () => {
    const mood = (overrides: Record<string, unknown>) => ({
      id: 'm1',
      localDate: '2026-10-20',
      level: 2,
      note: 'Long day',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
      ...overrides,
    })

    it('keeps them as they are when well formed, the entry untouched', () => {
      const stored = garden({
        moods: [mood({ feelings: ['hopeful', 'tired'], energy: 'low' }), mood({ id: 'm2', localDate: '2026-10-21' })],
      })
      const result = validateGarden(stored)
      expect(result.repaired).toBe(0)
      // Same identity, so an undamaged garden costs no extra write.
      expect(result.state?.moods).toBe(stored.moods)
    })

    it('drops unknown words, repeats and anything that is not a word', () => {
      const result = validateGarden(
        garden({ moods: [mood({ feelings: ['tired', 'ecstatic', 'tired', 4, null, 'calm'] })] }),
      )
      expect(result.state?.moods[0].feelings).toEqual(['calm', 'tired'])
      expect(result.state?.moods[0].note).toBe('Long day')
    })

    it('stores no list rather than an empty or a broken one', () => {
      for (const feelings of [[], ['ecstatic'], 'tired', { tired: true }, 7]) {
        const [entry] = validateGarden(garden({ moods: [mood({ feelings })] })).state!.moods
        expect(entry).not.toHaveProperty('feelings')
        expect(entry.level).toBe(2)
      }
    })

    it('keeps energy only as one of its three steps', () => {
      for (const energy of ['high', 3, true, '']) {
        const [entry] = validateGarden(garden({ moods: [mood({ energy })] })).state!.moods
        expect(entry).not.toHaveProperty('energy')
      }
      const [kept] = validateGarden(garden({ moods: [mood({ energy: 'steady' })] })).state!.moods
      expect(kept.energy).toBe('steady')
    })

    it('tidies them on a check-in that needed repair too', () => {
      const [entry] = validateGarden(
        garden({ moods: [{ localDate: '2026-10-20', level: 9, note: 'x', feelings: [], energy: 'loud' }] }),
      ).state!.moods
      expect(entry.level).toBe(5)
      expect(entry).not.toHaveProperty('feelings')
      expect(entry).not.toHaveProperty('energy')
    })

    it('does not count a dropped answer as damage', () => {
      const result = validateGarden(garden({ moods: [mood({ feelings: ['ecstatic'], energy: 'loud' })] }))
      expect(result.repaired).toBe(0)
      expect(result.refused).toBeUndefined()
    })
  })

  it('keeps the mark on an entry written later only when it is stored as true', () => {
    const check = (id: string, writtenLater?: unknown) => ({
      id,
      localDate: '2026-10-20',
      level: 3,
      note: 'Words',
      createdAt: '2026-10-26T09:00:00.000Z',
      updatedAt: '2026-10-26T09:00:00.000Z',
      ...(writtenLater === undefined ? {} : { writtenLater }),
    })
    const reflection = (id: string, writtenLater?: unknown) => ({
      id,
      localDate: '2026-10-20',
      promptId: 'free',
      body: 'Words',
      createdAt: '2026-10-26T09:00:00.000Z',
      updatedAt: '2026-10-26T09:00:00.000Z',
      ...(writtenLater === undefined ? {} : { writtenLater }),
    })
    const odd = ['yes', false, 1, null, {}]
    const moods = [check('kept', true), check('on-the-day'), ...odd.map((value, index) => check(`odd-${index}`, value))]
    const reflections = [
      reflection('kept', true),
      reflection('on-the-day'),
      ...odd.map((value, index) => reflection(`odd-${index}`, value)),
    ]
    const result = validateGarden(garden({ moods, reflections }))
    for (const entries of [result.state!.moods, result.state!.reflections]) {
      const [kept, ...rest] = entries
      expect(kept.writtenLater).toBe(true)
      for (const entry of rest) expect(entry).not.toHaveProperty('writtenLater')
      // Every entry is still there, words and all.
      expect(entries).toHaveLength(moods.length)
      expect(entries.every((entry) => 'note' in entry ? entry.note === 'Words' : entry.body === 'Words')).toBe(true)
    }
    // An undamaged garden with the mark keeps its collections as they were.
    const clean = garden({ moods: [check('kept', true)], reflections: [reflection('kept', true)] })
    const cleanResult = validateGarden(clean)
    expect(cleanResult.state?.moods).toBe(clean.moods)
    expect(cleanResult.state?.reflections).toBe(clean.reflections)
  })

  it('keeps calm motion only as a true or false choice', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const calm = validateGarden(garden({ profile: { ...base, calmMotion: true } }))
    expect(calm.state?.profile?.calmMotion).toBe(true)
    const odd = validateGarden(garden({ profile: { ...base, calmMotion: 'yes' } }))
    expect(odd.state?.profile?.calmMotion).toBe(false)
    const older = validateGarden(garden({ profile: base }))
    expect(older.state?.profile?.calmMotion).toBeUndefined()
  })

  it('keeps the later rhythm choices only when they are well formed', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const kept = validateGarden(
      garden({
        profile: {
          ...base,
          gentleDay: '2026-10-26',
          tendFirstPlantId: 'plant-2',
          recapOpensHour: 22,
          recapGraceEndsHour: 7,
        },
      }),
    ).state?.profile
    expect(kept).toMatchObject({
      gentleDay: '2026-10-26',
      tendFirstPlantId: 'plant-2',
      recapOpensHour: 22,
      recapGraceEndsHour: 7,
    })

    // Hand-edited: a date that is not one, an id that is not text, an evening
    // inside the late night, and an hour that is no hour.
    const odd = validateGarden(
      garden({
        profile: {
          ...base,
          gentleDay: 'tomorrow',
          tendFirstPlantId: 7,
          recapOpensHour: 3,
          recapGraceEndsHour: '4',
        },
      }),
    ).state?.profile
    expect(odd).not.toHaveProperty('gentleDay')
    expect(odd).not.toHaveProperty('tendFirstPlantId')
    expect(odd).not.toHaveProperty('recapOpensHour')
    expect(odd).not.toHaveProperty('recapGraceEndsHour')
  })

  it('keeps what the theme follows only when it is the device or the evening', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const followsOf = (themeFollows: unknown) =>
      validateGarden(garden({ profile: { ...base, theme: 'night', themeFollows } })).state
        ?.profile
    expect(followsOf('device')?.themeFollows).toBe('device')
    expect(followsOf('evening')?.themeFollows).toBe('evening')
    for (const odd of ['sunset', 'Device', 'night', 1, true, {}, null, '']) {
      const profile = followsOf(odd)
      expect(profile).not.toHaveProperty('themeFollows')
      // The theme chosen by hand is still there underneath.
      expect(profile?.theme).toBe('night')
    }
    expect(validateGarden(garden()).state?.profile).not.toHaveProperty('themeFollows')
  })

  it('keeps a text size only when it is one the garden offers', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const sizeOf = (textSize: unknown) =>
      validateGarden(garden({ profile: { ...base, textSize } })).state?.profile
    expect(sizeOf('larger')?.textSize).toBe('larger')
    expect(sizeOf('largest')?.textSize).toBe('largest')
    // "Comfortable" is the usual size, which is stored as no size at all.
    for (const odd of ['comfortable', 'huge', '125%', 1.25, false, [], null, '']) {
      const profile = sizeOf(odd)
      expect(profile).not.toHaveProperty('textSize')
      expect(profile?.gardenName).toBe('Test Garden')
    }
    expect(validateGarden(garden()).state?.profile).not.toHaveProperty('textSize')
  })

  it('accepts every soundscape, the two newest included, and falls back for any other', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const trackOf = (ambientTrack: unknown) =>
      validateGarden(garden({ profile: { ...base, ambientTrack } })).state?.profile?.ambientTrack
    for (const id of ['garden-chimes', 'garden', 'piano-music', 'soft-rain', 'dawn-birdsong']) {
      expect(trackOf(id)).toBe(id)
    }
    for (const odd of ['thunder', 'Soft Rain', 3, null, {}]) {
      expect(trackOf(odd)).toBe('garden-chimes')
    }
  })

  it('brings a volume into range, and drops one that is not a number', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const volumeOf = (ambientVolume: unknown) =>
      validateGarden(garden({ profile: { ...base, ambientVolume } })).state?.profile
    expect(volumeOf(0)?.ambientVolume).toBe(0)
    expect(volumeOf(35)?.ambientVolume).toBe(35)
    expect(volumeOf(100)?.ambientVolume).toBe(100)
    // What was meant is plain: a whole number within the slider.
    expect(volumeOf(150)?.ambientVolume).toBe(100)
    expect(volumeOf(-4)?.ambientVolume).toBe(0)
    expect(volumeOf(42.6)?.ambientVolume).toBe(43)
    for (const odd of ['50', NaN, Infinity, null, true, [], {}]) {
      const profile = volumeOf(odd)
      expect(profile).not.toHaveProperty('ambientVolume')
      expect(profile?.gardenName).toBe('Test Garden')
    }
    // An older garden has none, and plays at the usual volume.
    expect(validateGarden(garden()).state?.profile).not.toHaveProperty('ambientVolume')
  })

  it('keeps the sound switches only in the one value each is stored as', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const profileWith = (fields: Record<string, unknown>) =>
      validateGarden(garden({ profile: { ...base, ...fields } })).state?.profile
    expect(profileWith({ soundFollowsTheme: true })?.soundFollowsTheme).toBe(true)
    expect(profileWith({ soundInBackground: false })?.soundInBackground).toBe(false)
    for (const odd of [false, 'true', 1, null, {}]) {
      expect(profileWith({ soundFollowsTheme: odd })).not.toHaveProperty('soundFollowsTheme')
    }
    for (const odd of [true, 'false', 0, null, []]) {
      expect(profileWith({ soundInBackground: odd })).not.toHaveProperty('soundInBackground')
    }
    const older = validateGarden(garden()).state?.profile
    expect(older).not.toHaveProperty('soundFollowsTheme')
    expect(older).not.toHaveProperty('soundInBackground')
  })

  it('keeps the time of the last backup only when it is a real moment', () => {
    const base = createInitialState('Tester', 'Test Garden').profile!
    const lastBackupOf = (lastBackupAt: unknown) =>
      validateGarden(garden({ profile: { ...base, lastBackupAt } })).state?.profile
    expect(lastBackupOf('2026-03-14T09:30:00.000Z')?.lastBackupAt).toBe(
      '2026-03-14T09:30:00.000Z',
    )
    expect(lastBackupOf('2026-03-14T09:30:00+01:00')?.lastBackupAt).toBe(
      '2026-03-14T09:30:00+01:00',
    )
    // Wrong types, a date with no time, a time that is no time, and words.
    for (const odd of [1773480600000, true, {}, '2026-03-14', '2026-13-45T99:99:00Z', 'last week', '']) {
      const profile = lastBackupOf(odd)
      expect(profile).not.toHaveProperty('lastBackupAt')
      expect(profile?.gardenName).toBe('Test Garden')
    }
    // An older garden simply has none, and gains none.
    expect(validateGarden(garden()).state?.profile).not.toHaveProperty('lastBackupAt')
  })

  it('keeps a goal’s two-minute version only when it is words', () => {
    const base = {
      id: 'g1',
      title: 'Stretch your shoulders',
      schedule: 'daily',
      weekdays: [],
      createdDate: '2026-01-01',
      archived: false,
    }
    const kept = garden({ goals: [{ ...base, tinyTitle: 'Roll your shoulders' }] })
    const result = validateGarden(JSON.parse(JSON.stringify(kept)))
    expect(result.state?.goals[0].tinyTitle).toBe('Roll your shoulders')
    expect(result.repaired).toBe(0)
    // Untouched, so the repository writes nothing for it.
    expect(validateGarden(kept).state?.goals).toBe(kept.goals)

    for (const odd of [42, null, {}, ['Roll'], true, '', '   ']) {
      const repaired = validateGarden(garden({ goals: [{ ...base, tinyTitle: odd }] }))
      const [goal] = repaired.state!.goals
      expect(goal).not.toHaveProperty('tinyTitle')
      expect(goal.title).toBe('Stretch your shoulders')
      expect(repaired.repaired).toBe(1)
    }
    // An older goal simply has none, and gains none.
    const older = validateGarden(garden({ goals: [base] }))
    expect(older.state?.goals[0]).not.toHaveProperty('tinyTitle')
    expect(older.repaired).toBe(0)
  })

  it('keeps every goal a recap’s notes became, through a save and a backup', () => {
    const recap = {
      id: 'recap',
      localDate: '2026-10-26',
      wentWell: '',
      settingDown: '',
      forTomorrow: 'One\nTwo',
      plannedGoalId: 'g1',
      plannedGoalIds: ['g1', 'g2'],
      createdAt: '2026-10-26T20:00:00.000Z',
      updatedAt: '2026-10-26T20:00:00.000Z',
    }
    const kept = validateGarden(JSON.parse(JSON.stringify(garden({ recaps: [recap] }))))
    expect(kept.state?.recaps[0].plannedGoalIds).toEqual(['g1', 'g2'])
    expect(kept.repaired).toBe(0)

    // Anything but text is left out, and an empty list is no list.
    const odd = validateGarden(garden({ recaps: [{ ...recap, plannedGoalIds: ['g1', 4, null] }] }))
    expect(odd.state?.recaps[0].plannedGoalIds).toEqual(['g1'])
    const none = validateGarden(garden({ recaps: [{ ...recap, plannedGoalIds: [7] }] }))
    expect(none.state?.recaps[0]).not.toHaveProperty('plannedGoalIds')
    const notAList = validateGarden(garden({ recaps: [{ ...recap, plannedGoalIds: 'g1' }] }))
    expect(notAList.state?.recaps[0]).not.toHaveProperty('plannedGoalIds')
  })

  describe('a companion’s diary', () => {
    const base = createInitialState('Tester', 'Test Garden').creatures[0]
    const diaryOf = (fields: Record<string, unknown>) => {
      const result = validateGarden(garden({ creatures: [{ ...base, ...fields }] }))
      return { creature: result.state!.creatures[0], repaired: result.repaired }
    }

    it('keeps a well-formed diary as it is', () => {
      const fields = {
        hatchedAt: '2026-06-03T09:00:00.000Z',
        careCounts: { 'egg-warm': 3, 'cat-play': 1 },
        outfitsWorn: ['sprout-cap', 'silk-bow'],
      }
      const { creature, repaired } = diaryOf(fields)
      expect(creature).toMatchObject(fields)
      expect(repaired).toBe(0)
    })

    it('keeps the day it hatched only when it is a real moment', () => {
      for (const odd of ['yesterday', 1780000000000, '2026-06-03', null, '']) {
        expect(diaryOf({ hatchedAt: odd }).creature).not.toHaveProperty('hatchedAt')
      }
    })

    it('counts only care the garden knows, in whole numbers above nought', () => {
      const { creature } = diaryOf({
        careCounts: {
          'egg-warm': 2,
          'made-up': 4,
          'cat-play': 0,
          'cat-tuck': -1,
          'cat-bath': 1.5,
          'but-groom': '3',
          'but-fly': Number.POSITIVE_INFINITY,
          'chr-sun': 7,
        },
      })
      expect(creature.careCounts).toEqual({ 'egg-warm': 2, 'chr-sun': 7 })
      for (const odd of [{ 'made-up': 1 }, [], 'many', 5]) {
        expect(diaryOf({ careCounts: odd }).creature).not.toHaveProperty('careCounts')
      }
    })

    it('lists only known pieces, once each, and no more than the diary keeps', () => {
      const { creature, repaired } = diaryOf({
        outfitsWorn: ['silk-bow', 'leaf-bundle', 'retired-hat', 7, 'silk-bow', 'sprout-cap'],
      })
      // A supply is not a piece, and a piece the shop no longer has is not one.
      expect(creature.outfitsWorn).toEqual(['silk-bow', 'sprout-cap'])
      expect(repaired).toBe(0)
      const many = Array.from({ length: MAX_OUTFITS_WORN + 5 }, () => 'silk-bow')
      expect(diaryOf({ outfitsWorn: many }).creature.outfitsWorn).toEqual(['silk-bow'])
      for (const odd of [['retired-hat'], [], 'silk-bow', { 0: 'silk-bow' }]) {
        expect(diaryOf({ outfitsWorn: odd }).creature).not.toHaveProperty('outfitsWorn')
      }
    })

    it('gives an older companion no diary of its own', () => {
      const { creature } = diaryOf({})
      for (const field of ['hatchedAt', 'careCounts', 'outfitsWorn']) {
        expect(creature).not.toHaveProperty(field)
      }
    })

    it('keeps the day the diary began only when it is a real moment', () => {
      const profile = createInitialState('Tester', 'Test Garden').profile!
      const since = (diarySince: unknown) =>
        validateGarden(garden({ profile: { ...profile, diarySince } })).state?.profile
      expect(since('2026-10-27T12:00:00.000Z')?.diarySince).toBe('2026-10-27T12:00:00.000Z')
      for (const odd of ['today', 1780000000000, '2026-10-27', {}]) {
        const kept = since(odd)
        expect(kept).not.toHaveProperty('diarySince')
        expect(kept?.gardenName).toBe('Test Garden')
      }
      const older = { ...profile }
      delete older.diarySince
      expect(validateGarden(garden({ profile: older })).state?.profile).not.toHaveProperty(
        'diarySince',
      )
    })
  })

  describe('a companion grown alongside a goal', () => {
    const walk = {
      id: 'walk',
      title: 'Walk outside',
      schedule: 'daily',
      weekdays: [],
      createdDate: '2026-06-01',
      archived: false,
    }
    const base = createInitialState('Tester', 'Test Garden').creatures[0]
    const story = [{ goalId: 'walk', title: 'Walk outside', dates: ['2026-06-02', '2026-06-04'] }]
    const read = (fields: Record<string, unknown>, goals: unknown[] = [walk]) => {
      const result = validateGarden(garden({ goals, creatures: [{ ...base, ...fields }] }))
      return { creature: result.state!.creatures[0], repaired: result.repaired }
    }

    it('keeps the goal and the diary as they are, through a backup too', () => {
      const { creature, repaired } = read({ adoptedGoalId: 'walk', grownAlongside: story })
      expect(creature.adoptedGoalId).toBe('walk')
      expect(creature.grownAlongside).toEqual(story)
      expect(repaired).toBe(0)
      const stored = garden({ goals: [walk], creatures: [{ ...base, adoptedGoalId: 'walk', grownAlongside: story }] })
      const once = validateGarden(JSON.parse(JSON.stringify(stored)) as unknown)
      const twice = validateGarden(JSON.parse(JSON.stringify(once.state)) as unknown)
      expect(twice.state!.creatures).toEqual(once.state!.creatures)
      expect(twice.state!.creatures[0]).toMatchObject({ adoptedGoalId: 'walk', grownAlongside: story })
    })

    it('lets go, silently, of a goal not here, archived, or not a goal id', () => {
      for (const [adoptedGoalId, goals] of [
        ['gone', [walk]],
        ['walk', [{ ...walk, archived: true }]],
        ['walk', []],
        [7, [walk]],
        [null, [walk]],
      ] as const) {
        const { creature, repaired } = read({ adoptedGoalId, grownAlongside: story }, [...goals])
        expect(creature).not.toHaveProperty('adoptedGoalId')
        // The story stays: the diary does not need the goal to be here.
        expect(creature.grownAlongside).toEqual(story)
        expect(repaired).toBe(0)
      }
    })

    it('lets a butterfly go of its goal: it has no stage left to grow', () => {
      const { creature } = read({ stage: 'butterfly', adoptedGoalId: 'walk' })
      expect(creature).not.toHaveProperty('adoptedGoalId')
    })

    it('keeps only well-formed goals in the diary, each day once and no more than it keeps', () => {
      const { creature, repaired } = read({
        grownAlongside: [
          { goalId: 'walk', title: 'Walk outside', dates: ['2026-06-02', 'yesterday', '2026-02-30', 5] },
          { goalId: 'water', title: 'Drink water', dates: ['2026-06-02', '2026-06-03'] },
          { goalId: 'walk', title: 'A twin', dates: ['2026-06-05'] },
          { goalId: '', title: 'No id', dates: ['2026-06-06'] },
          { goalId: 'blank', title: '  ', dates: ['2026-06-06'] },
          { goalId: 'number', title: 4, dates: ['2026-06-06'] },
          { goalId: 'none', title: 'No days', dates: [] },
          { goalId: 'odd', title: 'Odd days', dates: '2026-06-06' },
          'Walk outside',
          null,
        ],
      })
      expect(creature.grownAlongside).toEqual([
        { goalId: 'walk', title: 'Walk outside', dates: ['2026-06-02'] },
        { goalId: 'water', title: 'Drink water', dates: ['2026-06-03'] },
      ])
      expect(repaired).toBe(0)

      const many = Array.from({ length: MAX_GOAL_DAYS + 5 }, (_, day) =>
        toLocalDate(new Date(2026, 0, day + 1, 12)),
      )
      const capped = read({ grownAlongside: [{ goalId: 'walk', title: 'Walk', dates: many }] })
      expect(capped.creature.grownAlongside?.[0].dates).toEqual(many.slice(0, MAX_GOAL_DAYS))

      for (const odd of [[], 'Walk outside', { walk: ['2026-06-02'] }, [{ goalId: 'x', title: 'X', dates: ['no'] }]]) {
        expect(read({ grownAlongside: odd }).creature).not.toHaveProperty('grownAlongside')
      }
    })

    it('gives an older companion neither', () => {
      const { creature } = read({})
      expect(creature).not.toHaveProperty('adoptedGoalId')
      expect(creature).not.toHaveProperty('grownAlongside')
    })
  })

  describe('saved looks', () => {
    const sunday = { id: 'sunday', name: 'Sunday best', outfit: { headwear: 'sprout-cap' } }

    /** A garden whose profile holds these looks, where the wardrobe keeps them. */
    function withLooks(outfitPresets: unknown) {
      const stored = garden()
      return { ...stored, profile: { ...stored.profile!, outfitPresets } }
    }

    it('keeps well-formed looks in the profile as the very same list', () => {
      const stored = withLooks([sunday])
      const result = validateGarden(stored)
      expect(result.state?.profile?.outfitPresets).toBe(stored.profile.outfitPresets)
      expect(result.state?.profile?.gardenName).toBe('Test Garden')
      expect(result.repaired).toBe(0)
      // And the same through a backup's JSON.
      const restored = validateGarden(JSON.parse(JSON.stringify(stored)))
      expect(restored.state?.profile?.outfitPresets).toEqual([sunday])
    })

    it('drops unknown slots and pieces, and pieces in the wrong slot', () => {
      const result = validateGarden(
        withLooks([
          {
            id: 'mixed',
            name: 'Mixed',
            outfit: {
              headwear: 'sprout-cap',
              accessory: 'sparkle-aura',
              aura: 'retired-glow',
              cape: 'silk-bow',
            },
          },
        ]),
      )
      expect(result.state?.profile?.outfitPresets).toEqual([
        { id: 'mixed', name: 'Mixed', outfit: { headwear: 'sprout-cap' } },
      ])
    })

    it('drops a look with nothing left in it, no id of its own, or a twin’s id', () => {
      const stored = withLooks([
        sunday,
        { ...sunday, name: 'Twin' },
        { id: 'empty', name: 'Empty', outfit: { headwear: 'retired-hat' } },
        { id: '', name: 'No id', outfit: sunday.outfit },
        { name: 'No id', outfit: sunday.outfit },
        { id: 'no-outfit', name: 'No outfit' },
        'Sunday best',
        null,
      ])
      const result = validateGarden(stored)
      expect(result.state?.profile?.outfitPresets).toEqual([sunday])
      // A cleaned list is a new one, and the stored one is left as it was.
      expect(result.state?.profile?.outfitPresets).not.toBe(stored.profile.outfitPresets)
      expect(stored.profile.outfitPresets).toHaveLength(8)
      // A look is an arrangement of pieces, not something made: dropping one
      // is not reported as damage.
      expect(result.repaired).toBe(0)
    })

    it('names a look as the wardrobe names it, giving one with no name a plain one', () => {
      const result = validateGarden(
        withLooks([
          { ...sunday, id: 'padded', name: '  Padded  ' },
          { ...sunday, id: 'long', name: 'L'.repeat(PRESET_NAME_LENGTH + 20) },
          { ...sunday, id: 'blank', name: '   ' },
          { ...sunday, id: 'number', name: 7 },
          { ...sunday, id: 'extra', name: 'Extra', note: 'not kept' },
        ]),
      )
      const looks = result.state?.profile?.outfitPresets
      expect(looks?.map((preset) => preset.name)).toEqual([
        'Padded',
        'L'.repeat(PRESET_NAME_LENGTH),
        'Saved look',
        'Saved look',
        'Extra',
      ])
      expect(looks?.[4]).not.toHaveProperty('note')
    })

    it('keeps no more looks than the closet holds', () => {
      const many = Array.from({ length: MAX_OUTFIT_PRESETS + 3 }, (_, index) => ({
        ...sunday,
        id: `look-${index}`,
      }))
      const looks = validateGarden(withLooks(many)).state?.profile?.outfitPresets
      expect(looks).toHaveLength(MAX_OUTFIT_PRESETS)
      expect(looks?.[0].id).toBe('look-0')
    })

    it('gives an older garden no looks, and an odd or empty value none either', () => {
      expect(validateGarden(garden()).state?.profile).not.toHaveProperty('outfitPresets')
      // An emptied list is kept as no list at all, the way a garden that never
      // saved a look stores it.
      for (const odd of ['looks', 4, { sunday }, null, [], [null]]) {
        const profile = validateGarden(withLooks(odd)).state?.profile
        expect(profile).not.toHaveProperty('outfitPresets')
        expect(profile?.gardenName).toBe('Test Garden')
      }
    })
  })

  it('still refuses a garden from a newer version, saying so', () => {
    const result = validateGarden(garden({ version: 99 }))
    expect(result.state).toBeUndefined()
    expect(result.refused).toMatch(/newer version/)
  })
})

describe('the characters on jars', () => {
  const jar = (id: string, character: unknown) => ({
    id,
    character,
    colorId: 'blue',
    purchasedAt: '2026-10-27T12:00:00.000Z',
  })

  it('keeps a jar with any character the shop sells, accents and marks included', () => {
    const jars = jarCharacters.map((character, index) => jar(`j${index}`, character))
    const result = validateGarden(garden({ jars }))
    expect(result.state?.jars.map((entry) => entry.character)).toEqual(jarCharacters)
    expect(result.repaired).toBe(0)
    for (const character of ['É', 'Ñ', 'Ü', 'Ø', 'Å', 'Ç', 'Œ', '!', '?', '&', '+', '.', '*'])
      expect(jarCharacters).toContain(character)
  })

  it('still drops a jar with anything else, and its place on a plant', () => {
    const plantId = garden().plants[0].id
    const others = ['~', '#', '♥', '★', 'é', 'Ł', 'ß', 'AB', '', 'E\u0301', 7, null]
    const result = validateGarden(
      garden({
        jars: [jar('kept', 'É'), ...others.map((character, index) => jar(`x${index}`, character))],
        jarPlacements: [{ jarId: 'x2', plantId }],
      }),
    )
    expect(result.state?.jars.map((entry) => entry.id)).toEqual(['kept'])
    expect(result.state?.jarPlacements).toEqual([])
  })
})

describe('the garden pace and its plants', () => {
  const plant = (careDaysSinceBloom: unknown) => ({
    id: 'p1',
    plantId: 'milkweed',
    growth: 3,
    plantedAt: '2026-06-01T00:00:00.000Z',
    careDaysSinceBloom,
  })

  it('keeps a known region and drops anything else, so the Guide marks nothing', () => {
    const seed = createInitialState('Tester', 'Test Garden')
    for (const region of ['north-america', 'europe', 'australasia', 'elsewhere']) {
      const result = validateGarden(garden({ profile: { ...seed.profile, region } }))
      expect(result.state?.profile?.region).toBe(region)
    }
    for (const region of ['uk', 'North America', '', 1, true, null, { id: 'europe' }]) {
      const result = validateGarden(garden({ profile: { ...seed.profile, region } }))
      expect(result.state?.profile).not.toHaveProperty('region')
    }
    expect(validateGarden(garden({ profile: seed.profile })).state?.profile).not.toHaveProperty(
      'region',
    )
  })

  it('keeps Keep giving, and reads anything else as Classic', () => {
    const seed = createInitialState('Tester', 'Test Garden')
    const kept = validateGarden(garden({ profile: { ...seed.profile, gardenPace: 'keep-giving' } }))
    expect(kept.state?.profile?.gardenPace).toBe('keep-giving')
    for (const gardenPace of ['classic', 'fast', 1, true, null]) {
      const result = validateGarden(garden({ profile: { ...seed.profile, gardenPace } }))
      expect(result.state?.profile).not.toHaveProperty('gardenPace')
      expect(result.repaired).toBe(0)
    }
  })

  it("keeps a plant's days of care toward its next bloom as whole days, at most a bloom's worth", () => {
    const stored = garden({ plants: [plant(4)] })
    const result = validateGarden(stored)
    // Same identity, so a well-formed count costs no extra write.
    expect(result.state?.plants).toBe(stored.plants)
    expect(validateGarden(garden({ plants: [plant(REBLOOM_CARE_DAYS)] })).state?.plants[0]
      .careDaysSinceBloom).toBe(REBLOOM_CARE_DAYS)
    // A longer count, as a build with a longer wait might leave, reads as ready.
    expect(validateGarden(garden({ plants: [plant(40)] })).state?.plants[0].careDaysSinceBloom).toBe(
      REBLOOM_CARE_DAYS,
    )
    for (const odd of [0, -2, 2.5, '3', null, Number.NaN, {}]) {
      const checked = validateGarden(garden({ plants: [plant(odd)] }))
      const [kept] = checked.state!.plants
      expect(kept).not.toHaveProperty('careDaysSinceBloom')
      expect(kept.growth).toBe(3)
      expect(checked.repaired).toBe(0)
    }
    // A plant that needed repair keeps a good count too.
    const repaired = validateGarden(garden({ plants: [{ ...plant(2), id: 7 }] }))
    expect(repaired.state?.plants[0].careDaysSinceBloom).toBe(2)
  })
})

describe('the days the garden was visited', () => {
  const seed = createInitialState('Tester', 'Test Garden')
  const withVisits = (visits: Record<string, unknown>) =>
    validateGarden(garden({ profile: { ...seed.profile, ...visits } })).state!.profile!

  it('keeps real days that have already happened', () => {
    const today = toLocalDate()
    expect(withVisits({ lastVisitOn: '2026-01-04', welcomeBackOn: today })).toMatchObject({
      lastVisitOn: '2026-01-04',
      welcomeBackOn: today,
    })
  })

  it('drops anything that is not a real day, or is a day still to come', () => {
    const tomorrow = toLocalDate(new Date(Date.now() + 86_400_000))
    for (const value of ['2026-02-30', 'yesterday', 20260101, null, tomorrow, '99999-01-01']) {
      const profile = withVisits({ lastVisitOn: value, welcomeBackOn: value })
      expect(profile).not.toHaveProperty('lastVisitOn')
      expect(profile).not.toHaveProperty('welcomeBackOn')
    }
  })
})
