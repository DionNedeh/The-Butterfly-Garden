import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState, Goal } from '../types'
import { TodayView } from './TodayView'

const TODAY = '2026-09-05'
const YESTERDAY = '2026-09-04'

function goal(overrides: Partial<Goal> & Pick<Goal, 'id' | 'title'>): Goal {
  return {
    schedule: 'once',
    weekdays: [],
    createdDate: '2026-09-01',
    archived: false,
    ...overrides,
  }
}

function renderToday(state: AppState, overrides: Record<string, unknown> = {}) {
  const handlers = {
    onSaveMood: vi.fn(),
    onSaveReflection: vi.fn(),
    onAddGoal: vi.fn(),
    onUpdateGoal: vi.fn(),
    onDeleteGoal: vi.fn(),
    onCompleteGoal: vi.fn(),
    onSkipGoal: vi.fn(),
    onSnoozeGoal: vi.fn(),
    onWakeGoal: vi.fn(),
    onPlanGoal: vi.fn(),
    onSetGoalArchived: vi.fn(),
    ...overrides,
  }
  render(<TodayView state={state} today={TODAY} {...handlers} />)
  return handlers
}

describe('TodayView goals', () => {
  it('retires a one-time goal completed on an earlier day', () => {
    const state: AppState = {
      ...createInitialState('Tester', 'Test Garden'),
      goals: [
        goal({ id: 'done-before', title: 'Book the appointment' }),
        goal({ id: 'still-due', title: 'Open a window' }),
      ],
      completions: [
        {
          id: `done-before:${YESTERDAY}`,
          goalId: 'done-before',
          localDate: YESTERDAY,
          completedAt: `${YESTERDAY}T10:00:00.000Z`,
        },
      ],
    }
    renderToday(state)

    expect(screen.queryByText('Book the appointment')).not.toBeInTheDocument()
    expect(screen.getByText('Open a window')).toBeInTheDocument()
  })

  it('keeps a one-time goal visible on the day it is completed', () => {
    const state: AppState = {
      ...createInitialState('Tester', 'Test Garden'),
      goals: [goal({ id: 'done-today', title: 'Drink some water' })],
      completions: [
        {
          id: `done-today:${TODAY}`,
          goalId: 'done-today',
          localDate: TODAY,
          completedAt: `${TODAY}T10:00:00.000Z`,
        },
      ],
    }
    renderToday(state)

    expect(screen.getByText('Drink some water')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /drink some water completed/i }),
    ).toBeDisabled()
  })

  it('keeps daily goals coming back after they are completed', () => {
    const state: AppState = {
      ...createInitialState('Tester', 'Test Garden'),
      goals: [
        goal({ id: 'daily', title: 'Three slow breaths', schedule: 'daily' }),
      ],
      completions: [
        {
          id: `daily:${YESTERDAY}`,
          goalId: 'daily',
          localDate: YESTERDAY,
          completedAt: `${YESTERDAY}T10:00:00.000Z`,
        },
      ],
    }
    renderToday(state)

    expect(
      screen.getByRole('button', { name: /complete three slow breaths/i }),
    ).toBeEnabled()
  })

  it('archives a goal instead of destroying the days it was completed', async () => {
    const user = userEvent.setup()
    const state: AppState = {
      ...createInitialState('Tester', 'Test Garden'),
      goals: [goal({ id: 'weekly', title: 'Water the plants', schedule: 'daily' })],
    }
    const { onSetGoalArchived, onDeleteGoal } = renderToday(state)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Archive' }))

    expect(onSetGoalArchived).toHaveBeenCalledWith('weekly', true)
    expect(onDeleteGoal).not.toHaveBeenCalled()
  })

  it('lists archived goals separately and offers to restore them', async () => {
    const user = userEvent.setup()
    const state: AppState = {
      ...createInitialState('Tester', 'Test Garden'),
      goals: [
        goal({ id: 'resting', title: 'Old routine', schedule: 'daily', archived: true }),
      ],
    }
    const { onSetGoalArchived } = renderToday(state)

    expect(screen.queryByRole('button', { name: /complete old routine/i })).toBeNull()
    const archived = screen.getByText(/archived \(1\)/i).closest('details')
    expect(archived).not.toBeNull()
    await user.click(within(archived as HTMLElement).getByRole('button', { name: 'Restore' }))

    expect(onSetGoalArchived).toHaveBeenCalledWith('resting', false)
  })

  it('marks the day it is given as today, not whatever day the test runs', () => {
    // The planner used to read the clock during render, so a session left open
    // overnight kept highlighting yesterday and offered to plan onto it.
    renderToday(createInitialState('Tester', 'Test Garden'))
    const todayCell = document.querySelector('.calendar-day.today')
    expect(todayCell?.querySelector('.calendar-day-number')?.textContent).toBe('5')
  })
})
