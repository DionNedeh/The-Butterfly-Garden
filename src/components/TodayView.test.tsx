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
    onOpenRecap: vi.fn(),
    moonlightCollected: false,
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

describe('the Moonlight card on Today', () => {
  const state = () => createInitialState('Tester', 'Test Garden')

  it('waits quietly before the evening rather than hiding', () => {
    // Visible from the first day so the rhythm is learnable. A feature that
    // does not exist until six o'clock is a feature nobody discovers.
    renderToday(state(), { recap: { open: false, state: 'waiting' } })

    expect(screen.getByText('Moonlight opens this evening.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Begin' }),
    ).not.toBeInTheDocument()
  })

  it('offers the recap once the evening arrives', async () => {
    const handlers = renderToday(state(), {
      recap: { open: true, targetDate: TODAY, state: 'evening' },
    })

    expect(screen.getByText('Round out your day')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Begin' }))
    expect(handlers.onOpenRecap).toHaveBeenCalled()
  })

  it('names the day it would close inside the grace window', () => {
    // 2026-09-04 is a Friday. After midnight the card has to say which day it
    // is rounding out, or collecting feels like it landed on the wrong one.
    renderToday(state(), {
      recap: { open: true, targetDate: YESTERDAY, state: 'grace' },
    })

    expect(screen.getByText('Round out Friday')).toBeInTheDocument()
  })

  it('stops offering once the night has been collected', () => {
    renderToday(state(), {
      recap: { open: true, targetDate: TODAY, state: 'evening' },
      moonlightCollected: true,
    })

    expect(screen.getByText('The day is rounded out.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Begin' }),
    ).not.toBeInTheDocument()
  })

  it('says nothing at all when the garden cannot be saved', () => {
    // A bonus that silently fails to persist is worse than one never offered.
    renderToday(state(), { recap: undefined })

    expect(screen.queryByText('Moonlight')).not.toBeInTheDocument()
  })
})

