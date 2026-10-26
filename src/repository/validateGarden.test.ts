import { describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import { formatJournalDate, isGoalDue } from '../lib/date'
import { isLocalDate, validateGarden } from './validateGarden'

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
  })

  it('still refuses a garden from a newer version, saying so', () => {
    const result = validateGarden(garden({ version: 99 }))
    expect(result.state).toBeUndefined()
    expect(result.refused).toMatch(/newer version/)
  })
})
