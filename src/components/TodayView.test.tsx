import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recapOpensAt } from '../lib/date'
import { resetDrafts } from '../lib/drafts'
import { createInitialState, MAX_PLANT_GROWTH } from '../lib/progression'
import { promptForDay } from '../lib/prompts'
import type { AppState, Goal, MoodEntry, PlantInstance, Profile } from '../types'
import { NO_DAYS_CHOSEN } from './GoalEditor'
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

/** Everything Today is given, with a fresh mock for each handler. */
function todayProps(state: AppState, overrides: Record<string, unknown> = {}) {
  return {
    state,
    today: TODAY,
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
}

function renderToday(state: AppState, overrides: Record<string, unknown> = {}) {
  const props = todayProps(state, overrides)
  render(<TodayView {...props} />)
  return props
}

/** A new garden with some of the gardener's own settings, and anything else given. */
function gardenWith(profile: Partial<Profile>, rest: Partial<AppState> = {}): AppState {
  const state = createInitialState('Tester', 'Test Garden')
  return { ...state, ...rest, profile: { ...state.profile!, ...profile } }
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
      screen.getByRole('button', { name: /done: drink some water/i }),
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
      screen.getByRole('button', { name: /care for three slow breaths/i }),
    ).toBeEnabled()
  })

  it('archives a goal instead of destroying the days it was completed', async () => {
    const user = userEvent.setup()
    const state: AppState = {
      ...createInitialState('Tester', 'Test Garden'),
      goals: [goal({ id: 'weekly', title: 'Water the plants', schedule: 'daily' })],
    }
    const { onSetGoalArchived, onDeleteGoal } = renderToday(state)

    await user.click(screen.getByRole('button', { name: 'More for Water the plants' }))
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

    expect(screen.queryByRole('button', { name: /care for old routine/i })).toBeNull()
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

  it('refuses a goal on "Selected days" until at least one day is chosen', async () => {
    // Such a goal would never be due, so it would never be seen again.
    const user = userEvent.setup()
    const { onAddGoal } = renderToday(createInitialState('Tester', 'Test Garden'))
    await user.type(screen.getByRole('combobox', { name: 'Add a goal' }), 'Stretch')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Repeat' }), 'Selected days')
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await user.click(screen.getByRole('checkbox', { name: day }))
    }

    expect(screen.getByRole('alert')).toHaveTextContent(NO_DAYS_CHOSEN)
    const add = screen.getByRole('button', { name: 'Add goal' })
    expect(add).toBeDisabled()
    // Not even a submit that goes around the disabled button gets through.
    fireEvent.submit(add.closest('form')!)
    expect(onAddGoal).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox', { name: 'Wed' }))
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(add)
    expect(onAddGoal).toHaveBeenCalledWith('Stretch', 'weekdays', [3])
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

  it("names the gardener's own evening hour while it waits", () => {
    // A night owl who moved their evening to 9pm should not be told 6pm.
    renderToday(gardenWith({ recapOpensHour: 21 }), { recap: { open: false, state: 'waiting' } })

    const waiting = screen.getByText(/you can look back on the day/)
    // "9 PM" in a 12-hour locale, "21" in a 24-hour one.
    expect(waiting).toHaveTextContent(/^From (9|21)\b/)
    expect(waiting).toHaveTextContent(`From ${recapOpensAt(21)},`)
    expect(waiting).not.toHaveTextContent(recapOpensAt(18))
  })

  it('names the usual evening hour when the gardener has not chosen one', () => {
    renderToday(state(), { recap: { open: false, state: 'waiting' } })

    expect(screen.getByText(/you can look back on the day/)).toHaveTextContent(
      `From ${recapOpensAt(18)},`,
    )
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
    // Nothing beside the weather was answered, so nothing beside it is passed on.
    expect(onSaveMood).toHaveBeenCalledWith('unsure', '', {})
  })

  it('starts at the weather question when opened by the "Check in" shortcut', () => {
    renderToday(createInitialState('Tester', 'Test Garden'), { openAtCheckIn: true })
    expect(screen.getByRole('heading', { name: 'What is your inner weather?' })).toHaveFocus()
  })

  it('leaves focus alone when Today is opened any other way', () => {
    renderToday(createInitialState('Tester', 'Test Garden'))
    expect(screen.getByRole('heading', { name: 'What is your inner weather?' })).not.toHaveFocus()
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
    await user.click(screen.getByRole('button', { name: 'Care for Water the fern' }))
    expect(handlers.onCompleteGoal).toHaveBeenCalledWith('g')
    expect(screen.getByRole('status')).toHaveTextContent('Water the fern marked done.')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onUncompleteGoal).toHaveBeenCalledWith('g', TODAY)
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('takes back a skip by skipping again', async () => {
    const user = userEvent.setup()
    const handlers = renderToday(withGoal())
    await user.click(screen.getByRole('button', { name: 'More for Water the fern' }))
    await user.click(screen.getByRole('button', { name: 'Skip today' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onSkipGoal).toHaveBeenCalledTimes(2)
  })

  it('puts back a deleted goal where it was, with its history', async () => {
    const user = userEvent.setup()
    const state = withGoal()
    const handlers = renderToday(state)
    await user.click(screen.getByRole('button', { name: 'More for Water the fern' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handlers.onDeleteGoal).toHaveBeenCalledWith('g')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onRestoreGoal).toHaveBeenCalledWith(state.goals[1], 1, state.completions)
  })

  it('brings back an archived goal', async () => {
    const user = userEvent.setup()
    const handlers = renderToday(withGoal())
    await user.click(screen.getByRole('button', { name: 'More for Open a window' }))
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(screen.getByRole('status')).toHaveTextContent('Open a window archived.')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(handlers.onSetGoalArchived).toHaveBeenLastCalledWith('first', false)
  })

  it('lets the offer go after a few seconds, but not while it is being reached for', () => {
    vi.useFakeTimers()
    renderToday(withGoal())
    act(() => screen.getByRole('button', { name: 'Care for Water the fern' }).click())
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

describe('a gentle day on Today', () => {
  // What a gentle day shows is kept as drafts for the day; none may leak.
  afterEach(() => resetDrafts())
  const titles = ['Open a window', 'Drink some water', 'Three slow breaths', 'Water the fern', 'Step outside']
  /** Five daily goals, the first already done today. */
  const withGoals = (gentleDay?: string): AppState =>
    gardenWith(gentleDay ? { gentleDay } : {}, {
      goals: titles.map((title, index) => goal({ id: `g${index}`, title, schedule: 'daily' })),
      completions: [{ id: `g0:${TODAY}`, goalId: 'g0', localDate: TODAY, completedAt: '' }],
    })
  const shownGoals = () =>
    titles.filter((title) => screen.queryByRole('button', { name: `More for ${title}` }))

  it('turns a gentle day on from the goals card', async () => {
    const onSetGentleDay = vi.fn()
    renderToday(withGoals(), { onSetGentleDay })
    const toggle = screen.getByRole('checkbox', { name: /gentle day/i })
    expect(toggle).not.toBeChecked()

    await userEvent.setup().click(toggle)
    expect(onSetGentleDay).toHaveBeenCalledWith(true)
  })

  it('turns a gentle day back into an ordinary one', async () => {
    const onSetGentleDay = vi.fn()
    renderToday(withGoals(TODAY), { onSetGentleDay })
    const toggle = screen.getByRole('checkbox', { name: /gentle day/i })
    expect(toggle).toBeChecked()

    await userEvent.setup().click(toggle)
    expect(onSetGentleDay).toHaveBeenCalledWith(false)
  })

  it('offers no toggle when the day cannot be changed', () => {
    renderToday(withGoals())
    expect(screen.queryByRole('checkbox', { name: /gentle day/i })).toBeNull()
  })

  it('shows only a few goals, and no counts', () => {
    renderToday(withGoals(TODAY), { onSetGentleDay: vi.fn() })

    expect(shownGoals()).toEqual(['Open a window', 'Drink some water', 'Three slow breaths'])
    expect(screen.getByText('Rest counts too')).toBeInTheDocument()
    expect(screen.queryByText('0 / 5')).toBeNull()
    expect(screen.queryByLabelText(/Sunlight earned/)).toBeNull()
    expect(screen.queryByText('1 / 5')).toBeNull()
  })

  it('keeps its few goals in place as they are done or set aside', () => {
    // A gentle day's list does not refill itself: finishing one is not a
    // cue for the next to appear, and focus stays where it was.
    const state = withGoals(TODAY)
    const { rerender } = render(<TodayView {...todayProps(state)} />)
    const before = shownGoals()
    const after = {
      ...state,
      goals: state.goals.map((item, index) =>
        index === 2 ? { ...item, skippedDates: [TODAY] } : item,
      ),
      completions: [
        ...state.completions,
        { id: `g1:${TODAY}`, goalId: 'g1', localDate: TODAY, completedAt: '' },
      ],
    }
    rerender(<TodayView {...todayProps(after)} />)
    expect(shownGoals()).toEqual(before)
  })

  it('keeps its few goals when one of them is snoozed or archived', async () => {
    const user = userEvent.setup()
    const onSetGentleDay = vi.fn()
    const { rerender } = render(<TodayView {...todayProps(withGoals(), { onSetGentleDay })} />)
    await user.click(screen.getByRole('checkbox', { name: /gentle day/i }))
    expect(onSetGentleDay).toHaveBeenCalledWith(true)
    // The day turns gentle, and then the second goal is snoozed away.
    const gentle = withGoals(TODAY)
    const later = {
      ...gentle,
      goals: gentle.goals.map((item, index) =>
        index === 1 ? { ...item, snoozedUntil: '2026-09-12' } : item,
      ),
    }
    rerender(<TodayView {...todayProps(later, { onSetGentleDay })} />)
    // No other goal slides into its place.
    expect(shownGoals()).toEqual(['Open a window', 'Three slow breaths'])
  })

  it('remembers "show the others" after leaving Today and coming back', async () => {
    const user = userEvent.setup()
    renderToday(withGoals(TODAY))
    await user.click(screen.getByRole('button', { name: 'Show the other 2 goals' }))
    cleanup()
    renderToday(withGoals(TODAY))
    expect(shownGoals()).toEqual(titles)
  })

  it('takes focus to the first goal it revealed', async () => {
    const user = userEvent.setup()
    renderToday(withGoals(TODAY))
    await user.click(screen.getByRole('button', { name: 'Show the other 2 goals' }))
    expect(screen.getByRole('button', { name: 'Care for Water the fern' })).toHaveFocus()
  })

  it('shows a few again after a gentle day is turned off and on', async () => {
    const user = userEvent.setup()
    const onSetGentleDay = vi.fn()
    const { rerender } = render(<TodayView {...todayProps(withGoals(TODAY), { onSetGentleDay })} />)
    await user.click(screen.getByRole('button', { name: 'Show the other 2 goals' }))
    await user.click(screen.getByRole('checkbox', { name: /gentle day/i }))
    rerender(<TodayView {...todayProps(withGoals(), { onSetGentleDay })} />)
    rerender(<TodayView {...todayProps(withGoals(TODAY), { onSetGentleDay })} />)
    expect(shownGoals()).toHaveLength(3)
  })

  it('shows the other goals when asked', async () => {
    const user = userEvent.setup()
    renderToday(withGoals(TODAY))

    await user.click(screen.getByRole('button', { name: 'Show the other 2 goals' }))
    expect(shownGoals()).toEqual(titles)
    expect(screen.queryByRole('button', { name: /Show the other/ })).toBeNull()
  })

  it('counts a single other goal in the singular', () => {
    const state = withGoals(TODAY)
    renderToday({ ...state, goals: state.goals.slice(0, 4) })

    expect(screen.getByRole('button', { name: 'Show the other 1 goal' })).toBeInTheDocument()
  })

  it('ends by itself at midnight', () => {
    renderToday(withGoals(YESTERDAY), { onSetGentleDay: vi.fn() })

    expect(screen.getByRole('checkbox', { name: /gentle day/i })).not.toBeChecked()
    expect(shownGoals()).toEqual(titles)
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
    expect(screen.getByLabelText('0 of 5 Sunlight earned')).toBeInTheDocument()
    expect(screen.queryByText('Rest counts too')).toBeNull()
  })

  it('points to companion care, which costs nothing', async () => {
    const onOpenCare = vi.fn()
    renderToday(withGoals(TODAY), { onOpenCare })

    await userEvent.setup().click(
      screen.getByRole('button', { name: "Your companions' care is free" }),
    )
    expect(onOpenCare).toHaveBeenCalledOnce()
  })

  it('offers a gentle day after heavy weather, and not once it is one', async () => {
    const heavy = { id: 'm', localDate: TODAY, level: 2 as const, note: '', createdAt: '', updatedAt: '' }
    const onSetGentleDay = vi.fn()
    renderToday({ ...withGoals(), moods: [heavy] }, { onSetGentleDay })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Make today a gentle day' }))
    expect(onSetGentleDay).toHaveBeenCalledWith(true)

    cleanup()
    renderToday({ ...withGoals(TODAY), moods: [heavy] }, { onSetGentleDay })
    expect(screen.queryByRole('button', { name: 'Make today a gentle day' })).toBeNull()
  })
})

describe('choosing the plant the next Sunlight tends', () => {
  const plant = (id: string, plantId: string, growth: number): PlantInstance => ({
    id,
    plantId,
    growth,
    plantedAt: '',
  })
  const garden = (tendFirstPlantId?: string, growth = [MAX_PLANT_GROWTH, 1, 0]) =>
    gardenWith(tendFirstPlantId ? { tendFirstPlantId } : {}, {
      plants: [
        plant('first-milkweed', 'milkweed', growth[0]),
        plant('second-aster', 'aster', growth[1]),
        plant('third-zinnia', 'zinnia', growth[2]),
      ],
    })
  const chooser = () => screen.getByRole('combobox', { name: 'Your next Sunlight tends' })

  it('lists only the plants still growing, named as the garden names them', () => {
    renderToday(garden(), { onChooseNextPlant: vi.fn() })

    expect(within(chooser()).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Aster 2',
      'Zinnia 3',
    ])
    expect(chooser()).toHaveValue('second-aster')
  })

  it('opens on the plant the gardener chose', () => {
    renderToday(garden('third-zinnia'), { onChooseNextPlant: vi.fn() })
    expect(chooser()).toHaveValue('third-zinnia')
  })

  it('passes on the plant chosen', async () => {
    const onChooseNextPlant = vi.fn()
    renderToday(garden(), { onChooseNextPlant })

    await userEvent.setup().selectOptions(chooser(), 'Zinnia 3')
    expect(onChooseNextPlant).toHaveBeenCalledWith('third-zinnia')
  })

  it('says nothing once every plant is fully grown', () => {
    const grown = Array(3).fill(MAX_PLANT_GROWTH)
    renderToday(garden(undefined, grown), { onChooseNextPlant: vi.fn() })
    expect(screen.queryByRole('combobox', { name: 'Your next Sunlight tends' })).toBeNull()
  })

  it('says nothing when the choice cannot be saved', () => {
    renderToday(garden())
    expect(screen.queryByRole('combobox', { name: 'Your next Sunlight tends' })).toBeNull()
  })
})

describe('reflection prompts on Today', () => {
  // Typed words are kept as drafts in memory; none may reach the next test.
  afterEach(() => resetDrafts())

  const todays = promptForDay(TODAY)
  const another = promptForDay(TODAY, 1)
  const promptHeading = (text: string) => screen.queryByRole('heading', { level: 2, name: text })

  it('offers another prompt in place of the day’s own', async () => {
    const user = userEvent.setup()
    const { onSaveReflection } = renderToday(createInitialState('Tester', 'Test Garden'))
    expect(promptHeading(todays.text)).toBeInTheDocument()
    expect(another.text).not.toBe(todays.text)

    await user.click(screen.getByRole('button', { name: 'Another prompt' }))
    expect(promptHeading(another.text)).toBeInTheDocument()
    expect(promptHeading(todays.text)).toBeNull()

    await user.type(screen.getByRole('textbox', { name: 'Your reflection' }), 'The light.')
    await user.click(screen.getByRole('button', { name: 'Keep this reflection' }))
    expect(onSaveReflection).toHaveBeenCalledWith(another.id, 'The light.')
  })

  it('lets the gardener write freely, without a prompt', async () => {
    const user = userEvent.setup()
    const { onSaveReflection } = renderToday(createInitialState('Tester', 'Test Garden'))

    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    expect(promptHeading('Write freely')).toBeInTheDocument()
    expect(promptHeading(todays.text)).toBeNull()
    // It stays, pressed, so focus is not lost and it can be undone.
    expect(screen.getByRole('button', { name: 'Write freely' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.type(screen.getByRole('textbox', { name: 'Your reflection' }), 'Just a day.')
    await user.click(screen.getByRole('button', { name: 'Keep this reflection' }))
    expect(onSaveReflection).toHaveBeenCalledWith('free', 'Just a day.')
  })

  it('goes back to a prompt from free writing', async () => {
    const user = userEvent.setup()
    renderToday(createInitialState('Tester', 'Test Garden'))

    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    await user.click(screen.getByRole('button', { name: 'Another prompt' }))
    expect(promptHeading(todays.text)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Write freely' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // And pressing "Write freely" again goes back to the day's prompt too.
    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    expect(promptHeading(todays.text)).toBeInTheDocument()
  })

  it('returns from free writing to the prompt that was showing', async () => {
    const user = userEvent.setup()
    renderToday(createInitialState('Tester', 'Test Garden'))
    await user.click(screen.getByRole('button', { name: 'Another prompt' }))
    expect(promptHeading(another.text)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    expect(promptHeading(another.text)).toBeInTheDocument()
  })

  it('returns from free writing to the prompt already answered today', async () => {
    const user = userEvent.setup()
    renderToday({
      ...createInitialState('Tester', 'Test Garden'),
      reflections: [
        { id: 'r', localDate: TODAY, promptId: another.id, body: 'Lighter.', createdAt: '', updatedAt: '' },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    cleanup()
    // After a reload the prompt before free writing is no longer known; the
    // one the reflection answered is.
    renderToday({
      ...createInitialState('Tester', 'Test Garden'),
      reflections: [
        { id: 'r', localDate: TODAY, promptId: another.id, body: 'Lighter.', createdAt: '', updatedAt: '' },
      ],
    })
    expect(promptHeading('Write freely')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    expect(promptHeading(another.text)).toBeInTheDocument()
  })

  it('keeps the chosen prompt with the words through a reload', async () => {
    const user = userEvent.setup()
    const { onSaveReflection } = renderToday(createInitialState('Tester', 'Test Garden'))
    await user.click(screen.getByRole('button', { name: 'Write freely' }))
    await user.type(screen.getByRole('textbox', { name: 'Your reflection' }), 'Kept.')
    cleanup()

    renderToday(createInitialState('Tester', 'Test Garden'), { onSaveReflection })
    expect(promptHeading('Write freely')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Your reflection' })).toHaveValue('Kept.')
    expect(screen.getByRole('textbox', { name: 'Your reflection' })).toHaveAccessibleDescription(
      'Write freely',
    )
    await user.click(screen.getByRole('button', { name: 'Keep this reflection' }))
    expect(onSaveReflection).toHaveBeenCalledWith('free', 'Kept.')
  })

  it('opens on the prompt a reflection was already written to today', () => {
    const gratitude = 'What ordinary thing are you grateful for?'
    expect(todays.text).not.toBe(gratitude)
    renderToday({
      ...createInitialState('Tester', 'Test Garden'),
      reflections: [
        {
          id: 'r',
          localDate: TODAY,
          promptId: 'gratitude',
          body: 'The kettle.',
          createdAt: '',
          updatedAt: '',
        },
      ],
    })

    expect(promptHeading(gratitude)).toBeInTheDocument()
    expect(promptHeading(todays.text)).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Your reflection' })).toHaveValue('The kettle.')
    expect(screen.getByRole('button', { name: 'Update reflection' })).toBeEnabled()
  })

  it('moves to a different prompt from one already answered today', async () => {
    // Answered to the day's second prompt: "Another" must not land on it again.
    renderToday({
      ...createInitialState('Tester', 'Test Garden'),
      reflections: [
        { id: 'r', localDate: TODAY, promptId: another.id, body: 'Lighter.', createdAt: '', updatedAt: '' },
      ],
    })
    expect(promptHeading(another.text)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Another prompt' }))
    expect(promptHeading(another.text)).toBeNull()
    expect(promptHeading(promptForDay(TODAY, 2).text)).toBeInTheDocument()
  })

  it('opens on the day’s prompt when yesterday’s reflection is the latest', () => {
    renderToday({
      ...createInitialState('Tester', 'Test Garden'),
      reflections: [
        {
          id: 'r',
          localDate: YESTERDAY,
          promptId: 'gratitude',
          body: 'The kettle.',
          createdAt: '',
          updatedAt: '',
        },
      ],
    })

    expect(promptHeading(todays.text)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Your reflection' })).toHaveValue('')
  })
})

describe('the goal editor on Today', () => {
  const withTwo = (): AppState => ({
    ...createInitialState('Tester', 'Test Garden'),
    goals: [
      goal({ id: 'a', title: 'Alpha', schedule: 'daily' }),
      goal({ id: 'b', title: 'Beta', schedule: 'daily' }),
    ],
  })

  it('closes for good when its goal is archived from the row, so a restore does not reopen it', async () => {
    const user = userEvent.setup()
    const state = withTwo()
    const props = todayProps(state)
    const { rerender } = render(<TodayView {...props} />)
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('textbox', { name: /^Edit goal/ })).toBeInTheDocument()

    const archived = { ...state, goals: state.goals.map((item) => (item.id === 'a' ? { ...item, archived: true } : item)) }
    rerender(<TodayView {...props} state={archived} />)
    expect(screen.queryByRole('textbox', { name: /^Edit goal/ })).toBeNull()
    // Restored, by Undo or from the Archived list.
    rerender(<TodayView {...props} state={state} />)
    expect(screen.queryByRole('textbox', { name: /^Edit goal/ })).toBeNull()
    expect(screen.getByLabelText('Add a goal')).toBeInTheDocument()
  })

  it('takes focus again when Edit is chosen for the goal already open', async () => {
    const user = userEvent.setup()
    renderToday(withTwo())
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('textbox', { name: /^Edit goal/ })).toHaveFocus()
  })

  it('keeps a skip made from the row while the editor is open', async () => {
    const user = userEvent.setup()
    const state = withTwo()
    const props = todayProps(state)
    const { rerender } = render(<TodayView {...props} />)
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const skipped = {
      ...state,
      goals: state.goals.map((item) => (item.id === 'a' ? { ...item, skippedDates: [TODAY] } : item)),
    }
    rerender(<TodayView {...props} state={skipped} />)
    await user.type(screen.getByRole('textbox', { name: /^Edit goal/ }), '!')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.onUpdateGoal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', title: 'Alpha!', skippedDates: [TODAY] }),
    )
  })
})

/** Today's check-in as stored, Bright unless told otherwise. */
function checkIn(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 'm',
    localDate: TODAY,
    level: 4,
    note: '',
    createdAt: `${TODAY}T08:00:00.000Z`,
    updatedAt: `${TODAY}T08:00:00.000Z`,
    ...overrides,
  }
}

describe('feelings and energy on Today', () => {
  // The choices are drafts beside the note; none may reach the next test.
  // Unmounted first, so forgetting the drafts redraws nothing.
  afterEach(() => {
    cleanup()
    resetDrafts()
  })

  const openExtras = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Add feelings or energy' }))

  it('offers them, and welcomes the weather, only once a weather is chosen', async () => {
    const user = userEvent.setup()
    renderToday(createInitialState('Tester', 'Test Garden'))
    expect(screen.queryByText('All weather is welcome.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add feelings or energy' })).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Rainy/ }))
    expect(screen.getByText('All weather is welcome.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add feelings or energy' })).toBeInTheDocument()
  })

  it('saves the feelings and energy chosen with the check-in', async () => {
    const user = userEvent.setup()
    const { onSaveMood } = renderToday(createInitialState('Tester', 'Test Garden'))
    await user.click(screen.getByRole('button', { name: /^Bright/ }))
    await openExtras(user)
    await user.click(screen.getByRole('button', { name: 'tired' }))
    await user.click(screen.getByRole('button', { name: 'hopeful' }))
    await user.click(screen.getByRole('radio', { name: 'low' }))
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))
    expect(onSaveMood).toHaveBeenCalledWith(4, '', { feelings: ['hopeful', 'tired'], energy: 'low' })
  })

  it('lets "Not sure today" carry them too', async () => {
    const user = userEvent.setup()
    const { onSaveMood } = renderToday(createInitialState('Tester', 'Test Garden'))
    await user.click(screen.getByRole('button', { name: 'Not sure today' }))
    await openExtras(user)
    await user.click(screen.getByRole('button', { name: 'numb' }))
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))
    expect(onSaveMood).toHaveBeenCalledWith('unsure', '', { feelings: ['numb'] })
  })

  it('keeps unsaved choices through a reload, beside the note', async () => {
    const user = userEvent.setup()
    renderToday(createInitialState('Tester', 'Test Garden'))
    await user.click(screen.getByRole('button', { name: /^Overcast/ }))
    await openExtras(user)
    await user.click(screen.getByRole('button', { name: 'restless' }))
    await user.click(screen.getByRole('radio', { name: 'steady' }))
    cleanup()

    const { onSaveMood } = renderToday(createInitialState('Tester', 'Test Garden'))
    await user.click(screen.getByRole('button', { name: /^Overcast/ }))
    expect(screen.getByText('Feeling restless · Energy steady')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))
    expect(onSaveMood).toHaveBeenCalledWith(3, '', { feelings: ['restless'], energy: 'steady' })
  })

  it('opens on what was saved today, and lets it change', async () => {
    const user = userEvent.setup()
    const { onSaveMood } = renderToday(
      gardenWith({}, { moods: [checkIn({ feelings: ['calm'], energy: 'steady' })] }),
    )
    expect(screen.getByText('Feeling calm · Energy steady')).toBeInTheDocument()
    await openExtras(user)
    expect(screen.getByRole('button', { name: 'calm' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'calm' }))
    await user.click(screen.getByRole('button', { name: 'proud' }))
    await user.click(screen.getByRole('button', { name: 'Clear energy' }))
    await user.click(screen.getByRole('button', { name: 'Update check-in' }))
    expect(onSaveMood).toHaveBeenCalledWith(4, '', { feelings: ['proud'] })
  })
})

describe('the next step after a check-in', () => {
  // Putting the offer away is a draft for the day; none may reach the next test.
  // Unmounted first, so forgetting the drafts redraws nothing.
  afterEach(() => {
    cleanup()
    resetDrafts()
  })

  const offer = () => screen.queryByRole('group', { name: /One small thing/ })
  const everything = { onSetGentleDay: vi.fn(), onOpenCare: vi.fn() }

  it('offers a gentle day, one line or a companion after heavy weather', () => {
    renderToday(gardenWith({}, { moods: [checkIn({ level: 2 })] }), everything)
    const group = screen.getByRole('group', {
      name: 'Heavy weather can make everything harder. One small thing, if it helps:',
    })
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Make today a gentle day',
      'Write one line',
      'Visit your companion',
      'Not now',
    ])
  })

  it('offers the same after a day low on energy, whatever its weather', () => {
    renderToday(gardenWith({}, { moods: [checkIn({ level: 5, energy: 'low' })] }), everything)
    const group = screen.getByRole('group', {
      name: 'A low-energy day can ask for less. One small thing, if it helps:',
    })
    expect(within(group).getByRole('button', { name: 'Make today a gentle day' })).toBeInTheDocument()
    expect(within(group).queryByRole('button', { name: 'Try today’s reflection' })).toBeNull()
  })

  it('offers today’s reflection after anything else, "not sure" included', () => {
    for (const mood of [checkIn(), checkIn({ level: 3, unsure: true, energy: 'steady' })]) {
      renderToday(gardenWith({}, { moods: [mood] }), everything)
      const group = screen.getByRole('group', { name: 'One small thing next, if you like:' })
      expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual([
        'Try today’s reflection',
        'Not now',
      ])
      cleanup()
    }
  })

  it('takes focus to the reflection, and puts itself away', async () => {
    const user = userEvent.setup()
    renderToday(gardenWith({}, { moods: [checkIn()] }), everything)
    await user.click(screen.getByRole('button', { name: 'Try today’s reflection' }))
    expect(screen.getByRole('textbox', { name: 'Your reflection' })).toHaveFocus()
    expect(offer()).toBeNull()
  })

  it('starts one line of writing after heavy weather', async () => {
    const user = userEvent.setup()
    renderToday(gardenWith({}, { moods: [checkIn({ level: 1 })] }), everything)
    await user.click(screen.getByRole('button', { name: 'Write one line' }))
    expect(screen.getByRole('textbox', { name: 'Your reflection' })).toHaveFocus()
    expect(offer()).toBeNull()
  })

  it('makes today a gentle day, handing focus to the switch it set', async () => {
    const user = userEvent.setup()
    const onSetGentleDay = vi.fn()
    renderToday(gardenWith({}, { moods: [checkIn({ level: 2 })] }), { ...everything, onSetGentleDay })
    await user.click(screen.getByRole('button', { name: 'Make today a gentle day' }))
    expect(onSetGentleDay).toHaveBeenCalledWith(true)
    expect(screen.getByRole('checkbox', { name: /gentle day/i })).toHaveFocus()
    expect(offer()).toBeNull()
  })

  it('leaves out a gentle day once today is one', () => {
    renderToday(gardenWith({ gentleDay: TODAY }, { moods: [checkIn({ level: 2 })] }), everything)
    expect(screen.queryByRole('button', { name: 'Make today a gentle day' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Write one line' })).toBeInTheDocument()
  })

  it('goes to the companions for free care', async () => {
    const user = userEvent.setup()
    const onOpenCare = vi.fn()
    renderToday(gardenWith({}, { moods: [checkIn({ level: 2 })] }), { ...everything, onOpenCare })
    await user.click(screen.getByRole('button', { name: 'Visit your companion' }))
    expect(onOpenCare).toHaveBeenCalledOnce()
  })

  it('suggests nothing already done', () => {
    const written = {
      id: 'r',
      localDate: TODAY,
      promptId: promptForDay(TODAY).id,
      body: 'A line.',
      createdAt: '',
      updatedAt: '',
    }
    renderToday(gardenWith({}, { moods: [checkIn()], reflections: [written] }), everything)
    expect(offer()).toBeNull()
  })

  it('goes for the day on "Not now", with focus on the check-in, until it is rewritten', async () => {
    const user = userEvent.setup()
    const state = gardenWith({}, { moods: [checkIn()] })
    renderToday(state, everything)
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(offer()).toBeNull()
    expect(screen.getByRole('button', { name: 'Update check-in' })).toHaveFocus()

    cleanup()
    renderToday(state, everything)
    expect(offer()).toBeNull()

    // A rewritten check-in is a new answer, with an offer of its own.
    cleanup()
    renderToday(
      gardenWith({}, { moods: [checkIn({ level: 1, updatedAt: `${TODAY}T18:00:00.000Z` })] }),
      everything,
    )
    expect(offer()).not.toBeNull()
  })

  it('says the check-in was kept, and offers the step without taking focus', async () => {
    const user = userEvent.setup()
    const empty = gardenWith({})
    const props = todayProps(empty, everything)
    const { rerender } = render(<TodayView {...props} />)
    expect(screen.queryByText('Kept in your journal.')).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Bright/ }))
    const save = screen.getByRole('button', { name: 'Save check-in' })
    await user.click(save)
    rerender(<TodayView {...props} state={{ ...empty, moods: [checkIn()] }} />)

    expect(screen.getByText('Kept in your journal.')).toBeInTheDocument()
    expect(offer()).not.toBeNull()
    // Both arrive in a polite live region, and focus stays where it was.
    expect(screen.getByText('Kept in your journal.').closest('[aria-live="polite"]')).toContainElement(
      offer(),
    )
    expect(screen.getByRole('button', { name: 'Update check-in' })).toHaveFocus()
  })

  it('keeps the support line after a stormy check-in, below the offer', () => {
    renderToday(gardenWith({}, { moods: [checkIn({ level: 1 })] }), {
      ...everything,
      onOpenSupport: vi.fn(),
    })
    const support = screen.getByRole('button', { name: 'If you need support now' })
    expect(offer()!.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
