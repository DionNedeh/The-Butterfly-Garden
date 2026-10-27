import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CreatureInstance, DailyCompletion, Goal } from '../../types'
import { GrowAlongside } from './GrowAlongside'

const TODAY = '2026-06-10'

function goal(id: string, title: string, overrides: Partial<Goal> = {}): Goal {
  return {
    id,
    title,
    schedule: 'daily',
    weekdays: [],
    createdDate: '2026-06-01',
    archived: false,
    ...overrides,
  }
}

const sol: CreatureInstance = {
  id: 'sol',
  speciesId: 'monarch',
  name: 'Sol',
  stage: 'egg',
  careDates: {},
  actionLog: {},
  bond: 0,
  outfit: {},
  carePoints: 0,
  discoveredAt: '2026-06-01T09:00:00.000Z',
}

const goals = [
  goal('walk', 'Walk outside'),
  goal('water', 'Drink water'),
  goal('old', 'Old routine', { archived: true }),
]

function renderChoice(
  creature: CreatureInstance = sol,
  state: { goals: Goal[]; completions: DailyCompletion[] } = { goals, completions: [] },
) {
  const onAdopt = vi.fn()
  const view = render(
    <GrowAlongside state={state} today={TODAY} creature={creature} onAdopt={onAdopt} />,
  )
  return { onAdopt, view, choice: () => screen.getByRole('combobox', { name: 'Grow alongside a goal' }) }
}

describe('growing a companion alongside a goal', () => {
  it('offers the goals in use, and grows it alongside the one chosen', async () => {
    const user = userEvent.setup()
    const { onAdopt, choice } = renderChoice()
    expect(choice()).toHaveValue('')
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['None', 'Walk outside', 'Drink water'])
    expect(choice()).toHaveAccessibleDescription(
      'Choose a goal, and each day you complete it on Today counts as a day of care for Sol.',
    )
    await user.selectOptions(choice(), 'Walk outside')
    expect(onAdopt).toHaveBeenCalledWith('sol', 'walk')
  })

  it('says what its goal does, what it has given, and can let it go', async () => {
    const user = userEvent.setup()
    const { onAdopt, choice } = renderChoice({
      ...sol,
      adoptedGoalId: 'walk',
      grownAlongside: [
        { goalId: 'walk', title: 'Walk outside', dates: ['2026-06-02', '2026-06-04'] },
        { goalId: 'water', title: 'Drink water', dates: ['2026-06-03'] },
      ],
    })
    expect(choice()).toHaveValue('walk')
    expect(choice()).toHaveAccessibleDescription(
      'Each day you complete Walk outside on Today counts as a day of care for Sol. 2 days so far.',
    )
    await user.selectOptions(choice(), 'None')
    expect(onAdopt).toHaveBeenCalledWith('sol', undefined)
  })

  it('says nothing of days before its goal has given one', () => {
    const { choice } = renderChoice({ ...sol, adoptedGoalId: 'water' })
    expect(choice()).toHaveAccessibleDescription(
      'Each day you complete Drink water on Today counts as a day of care for Sol.',
    )
  })

  it('keeps showing its goal once that goal will not come round again', () => {
    const once = goal('call', 'Call Gran', { schedule: 'once' })
    const { choice } = renderChoice(
      { ...sol, adoptedGoalId: 'call' },
      {
        goals: [goal('walk', 'Walk outside'), once],
        completions: [{ id: 'c', goalId: 'call', localDate: '2026-06-09', completedAt: '' }],
      },
    )
    expect(choice()).toHaveValue('call')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'None',
      'Walk outside',
      'Call Gran',
    ])
  })

  it('keeps its place, and the focus, when its last goal is let go', async () => {
    const user = userEvent.setup()
    const state = {
      goals: [goal('call', 'Call Gran', { schedule: 'once' })],
      completions: [{ id: 'c', goalId: 'call', localDate: '2026-06-09', completedAt: '' }],
    }
    const { onAdopt, view, choice } = renderChoice({ ...sol, adoptedGoalId: 'call' }, state)
    await user.selectOptions(choice(), 'None')
    expect(onAdopt).toHaveBeenCalledWith('sol', undefined)
    view.rerender(<GrowAlongside state={state} today={TODAY} creature={sol} onAdopt={onAdopt} />)
    expect(choice()).toHaveFocus()
    expect(choice()).toHaveValue('')
  })

  it('shows nothing when there is no goal to choose', () => {
    const { view } = renderChoice(sol, { goals: [goals[2]], completions: [] })
    expect(view.container).toBeEmptyDOMElement()
  })
})
