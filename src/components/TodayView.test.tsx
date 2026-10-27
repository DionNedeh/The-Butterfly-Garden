import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState, Goal } from '../types'
import { TodayView } from './TodayView'
import { UNDO_MS } from './UndoToast'

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
    onUncompleteGoal: vi.fn(),
    onRestoreGoal: vi.fn(),
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


describe('checking in', () => {
  const mood = (level: 1 | 2 | 3 | 4 | 5, unsure?: true) => ({
    id: 'm',
    localDate: TODAY,
    level,
    ...(unsure ? { unsure } : {}),
    note: '',
    createdAt: '',
    updatedAt: '',
  })

  it('chooses nothing for the gardener, and saves only once something is chosen', async () => {
    const user = userEvent.setup()
    const { onSaveMood } = renderToday(createInitialState('Tester', 'Test Garden'))
    const save = screen.getByRole('button', { name: 'Save check-in' })
    expect(save).toBeDisabled()
    expect(screen.getByText(/Choose a weather, or Not sure today/)).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { pressed: true })) {
      expect(button).not.toHaveClass('mood-button')
    }

    await user.click(screen.getByRole('button', { name: 'Not sure today' }))
    expect(screen.getByRole('button', { name: 'Not sure today' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(save)
    expect(onSaveMood).toHaveBeenCalledWith('unsure', '')
  })

  it('opens on the answer already given today, "not sure" included', () => {
    renderToday({ ...createInitialState('Tester', 'Test Garden'), moods: [mood(3, true)] })
    expect(screen.getByRole('button', { name: 'Not sure today' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Update check-in' })).toBeEnabled()
  })

  it('offers support quietly after a stormy check-in, and only then', async () => {
    const onOpenSupport = vi.fn()
    renderToday({ ...createInitialState('Tester', 'Test Garden'), moods: [mood(1)] }, { onOpenSupport })
    await userEvent.setup().click(screen.getByRole('button', { name: 'If you need support now' }))
    expect(onOpenSupport).toHaveBeenCalledOnce()
  })

  it('does not offer support after a brighter day', () => {
    renderToday({ ...createInitialState('Tester', 'Test Garden'), moods: [mood(4)] }, { onOpenSupport: vi.fn() })
    expect(screen.queryByRole('button', { name: 'If you need support now' })).toBeNull()
  })
})

describe('undo on Today', () => {
  afterEach(() => vi.useRealTimers())

  const withGoal = (): AppState => ({
    ...createInitialState('Tester', 'Test Garden'),
    goals: [
      goal({ id: 'first', title: 'Open a window', schedule: 'daily' }),
      goal({ id: 'g', title: 'Water the fern', schedule: 'daily' }),
    ],
    completions: [{ id: 'g:2026-09-01', goalId: 'g', localDate: '2026-09-01', completedAt: '' }],
  })

  it('takes back a goal marked done', async () => {
    const user = userEvent.setup()
    const handlers = renderToday(withGoal())
    await user.click(screen.getByRole('button', { name: 'Complete Water the fern' }))
    expect(handlers.onCompleteGoal).toHaveBeenCalledWith('g')
    expect(screen.getByRole('status')).toHaveTextContent('Water the fern marked done.')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onUncompleteGoal).toHaveBeenCalledWith('g', TODAY)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('takes back a skip by skipping again', async () => {
    const user = userEvent.setup()
    const handlers = renderToday(withGoal())
    await user.click(screen.getAllByRole('button', { name: 'Skip' })[1])
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onSkipGoal).toHaveBeenCalledTimes(2)
  })

  it('puts back a deleted goal where it was, with its history', async () => {
    const user = userEvent.setup()
    const state = withGoal()
    const handlers = renderToday(state)
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handlers.onDeleteGoal).toHaveBeenCalledWith('g')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onRestoreGoal).toHaveBeenCalledWith(state.goals[1], 1, state.completions)
  })

  it('brings back an archived goal', async () => {
    const user = userEvent.setup()
    const handlers = renderToday(withGoal())
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByRole('status')).toHaveTextContent('Open a window archived.')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onSetGoalArchived).toHaveBeenLastCalledWith('first', false)
  })

  it('lets the offer go after a few seconds, but not while it is being reached for', () => {
    vi.useFakeTimers()
    renderToday(withGoal())
    act(() => screen.getByRole('button', { name: 'Complete Water the fern' }).click())
    const toast = screen.getByText('Water the fern marked done.').parentElement!
    fireEvent.pointerEnter(toast)
    act(() => {
      vi.advanceTimersByTime(UNDO_MS * 2)
    })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    fireEvent.pointerLeave(toast)
    act(() => {
      vi.advanceTimersByTime(UNDO_MS)
    })
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})
