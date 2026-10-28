import { describe, expect, it } from 'vitest'
import type { CreatureInstance, Goal } from '../types'
import { companionsByGoal, goalsToGrowAlongside } from './growAlongside'

const TODAY = '2026-06-10'

function goal(overrides: Partial<Goal> & Pick<Goal, 'id'>): Goal {
  return {
    title: overrides.id,
    schedule: 'daily',
    weekdays: [],
    createdDate: '2026-06-01',
    archived: false,
    ...overrides,
  }
}

function creature(overrides: Partial<CreatureInstance> & Pick<CreatureInstance, 'id'>): CreatureInstance {
  return {
    speciesId: 'monarch',
    name: overrides.id,
    stage: 'egg',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-06-01T09:00:00.000Z',
    ...overrides,
  }
}

describe('the goals a companion can grow alongside', () => {
  it('offers the goals in use, in order, and not one set aside or done for good', () => {
    const goals = [
      goal({ id: 'walk' }),
      goal({ id: 'archived', archived: true }),
      goal({ id: 'called', schedule: 'once' }),
      goal({ id: 'call-today', schedule: 'once' }),
      goal({ id: 'plan', schedule: 'once', scheduledDate: '2026-06-20' }),
      goal({ id: 'snoozed', snoozedUntil: '2026-06-12' }),
    ]
    const completions = [
      { id: 'a', goalId: 'called', localDate: '2026-06-09', completedAt: '' },
      { id: 'b', goalId: 'call-today', localDate: TODAY, completedAt: '' },
      { id: 'c', goalId: 'walk', localDate: '2026-06-09', completedAt: '' },
    ]
    expect(goalsToGrowAlongside({ goals, completions }, TODAY).map((item) => item.id)).toEqual([
      'walk',
      'call-today',
      'plan',
      'snoozed',
    ])
  })
})

describe('the companions a goal is growing', () => {
  it('names them by goal, in the garden’s order, leaving out butterflies', () => {
    const growing = companionsByGoal([
      creature({ id: 'Sol', adoptedGoalId: 'walk' }),
      creature({ id: 'Pip', stage: 'chrysalis', adoptedGoalId: 'walk' }),
      creature({ id: 'Wren', adoptedGoalId: 'water' }),
      creature({ id: 'Fern', stage: 'butterfly', adoptedGoalId: 'walk' }),
      creature({ id: 'Moss' }),
    ])
    expect([...growing]).toEqual([
      ['walk', ['Sol', 'Pip']],
      ['water', ['Wren']],
    ])
  })
})
