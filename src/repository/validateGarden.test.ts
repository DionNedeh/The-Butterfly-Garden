import { describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import { formatJournalDate, isGoalDue, isLocalDate } from '../lib/date'
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

  it('still refuses a garden from a newer version, saying so', () => {
    const result = validateGarden(garden({ version: 99 }))
    expect(result.state).toBeUndefined()
    expect(result.refused).toMatch(/newer version/)
  })
})
