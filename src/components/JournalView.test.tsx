import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState, MoodEntry, RecapEntry, ReflectionEntry } from '../types'
import { JournalView } from './JournalView'

function mood(localDate: string, note: string): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note,
    createdAt: `${localDate}T09:00:00.000Z`,
    updatedAt: `${localDate}T09:00:00.000Z`,
  }
}

function reflection(localDate: string, body: string): ReflectionEntry {
  return {
    id: `reflection-${localDate}`,
    localDate,
    promptId: 'notice',
    body,
    createdAt: `${localDate}T21:00:00.000Z`,
    updatedAt: `${localDate}T21:00:00.000Z`,
  }
}

function recap(localDate: string, overrides: Partial<RecapEntry> = {}): RecapEntry {
  return {
    id: `recap-${localDate}`,
    localDate,
    level: 2,
    wentWell: 'Walked to the river.',
    settingDown: 'The unanswered email.',
    forTomorrow: 'Book the appointment',
    createdAt: `${localDate}T22:00:00.000Z`,
    updatedAt: `${localDate}T22:00:00.000Z`,
    ...overrides,
  }
}

/** A garden with `days` consecutive days of entries, newest last. */
function gardenWithDays(days: number): AppState {
  const moods: MoodEntry[] = []
  const reflections: ReflectionEntry[] = []
  const start = Date.UTC(2026, 0, 1)
  for (let day = 0; day < days; day += 1) {
    const localDate = new Date(start + day * 86_400_000)
      .toISOString()
      .slice(0, 10)
    moods.push(mood(localDate, `Note for day ${day + 1}`))
    reflections.push(reflection(localDate, `Reflection for day ${day + 1}`))
  }
  return { ...createInitialState('Tester', 'Test Garden'), moods, reflections }
}

function renderJournal(state: AppState, overrides: Record<string, unknown> = {}) {
  const handlers = {
    onUpdateMood: vi.fn(),
    onDeleteMood: vi.fn(),
    onUpdateReflection: vi.fn(),
    onDeleteReflection: vi.fn(),
    onUpdateRecap: vi.fn(),
    onDeleteRecap: vi.fn(),
    ...overrides,
  }
  render(<JournalView state={state} {...handlers} />)
  return handlers
}

describe('JournalView', () => {
  it('asks before deleting a check-in, and does nothing until confirmed', async () => {
    const user = userEvent.setup()
    const state = gardenWithDays(1)
    const { onDeleteMood } = renderJournal(state)

    const block = screen.getByText('Note for day 1').closest('.journal-block')
    expect(block).not.toBeNull()
    const scope = within(block as HTMLElement)

    await user.click(scope.getByRole('button', { name: 'Delete' }))
    expect(onDeleteMood).not.toHaveBeenCalled()
    expect(scope.getByText(/delete this check-in for good/i)).toBeInTheDocument()

    await user.click(scope.getByRole('button', { name: 'Keep' }))
    expect(onDeleteMood).not.toHaveBeenCalled()

    await user.click(scope.getByRole('button', { name: 'Delete' }))
    await user.click(scope.getByRole('button', { name: 'Yes, delete' }))
    expect(onDeleteMood).toHaveBeenCalledWith('mood-2026-01-01')
  })

  it('asks before deleting a reflection', async () => {
    const user = userEvent.setup()
    const { onDeleteReflection } = renderJournal(gardenWithDays(1))

    const block = screen
      .getByText('Reflection for day 1')
      .closest('.journal-block')
    const scope = within(block as HTMLElement)

    await user.click(scope.getByRole('button', { name: 'Delete' }))
    expect(onDeleteReflection).not.toHaveBeenCalled()
    await user.click(scope.getByRole('button', { name: 'Yes, delete' }))
    expect(onDeleteReflection).toHaveBeenCalledWith('reflection-2026-01-01')
  })

  it('pages a long timeline instead of rendering every day at once', async () => {
    const user = userEvent.setup()
    renderJournal(gardenWithDays(45))

    // Newest first, so day 45 is on the first page and day 1 is not.
    expect(screen.getByText('Note for day 45')).toBeInTheDocument()
    expect(screen.queryByText('Note for day 1')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.timeline-entry')).toHaveLength(30)

    await user.click(screen.getByRole('button', { name: /show earlier days/i }))

    expect(screen.getByText('Note for day 1')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /show earlier days/i }),
    ).not.toBeInTheDocument()
  })

  it('builds the species field notes only once the section is opened', async () => {
    const user = userEvent.setup()
    renderJournal(gardenWithDays(1))

    expect(document.querySelectorAll('.species-card')).toHaveLength(0)
    await user.click(screen.getByText('Butterflies welcomed'))
    expect(
      document.querySelectorAll('.species-card').length,
    ).toBeGreaterThan(0)
  })
})

describe('recaps in the journal', () => {
  const DAY = '2026-01-01'
  const base = () => createInitialState('Tester', 'Test Garden')

  it('renders the answers that were given', () => {
    renderJournal({ ...base(), recaps: [recap(DAY)] })

    expect(screen.getByText(/Rounded out the day/)).toBeInTheDocument()
    expect(screen.getByText('Walked to the river.')).toBeInTheDocument()
    expect(screen.getByText('The unanswered email.')).toBeInTheDocument()
  })

  it('shows a day whose only entry is a recap', () => {
    // The timeline is built from moods and reflections; a day someone only
    // closed out is still a day they showed up for.
    renderJournal({ ...base(), recaps: [recap(DAY, { wentWell: 'Got here.' })] })

    expect(screen.getByText('Got here.')).toBeInTheDocument()
  })

  it('leaves out the questions that were skipped', () => {
    renderJournal({
      ...base(),
      recaps: [
        recap(DAY, {
          level: undefined,
          wentWell: '',
          settingDown: 'Only this.',
          forTomorrow: '',
        }),
      ],
    })

    expect(screen.getByText('Only this.')).toBeInTheDocument()
    expect(screen.queryByText('What went well')).not.toBeInTheDocument()
    expect(screen.queryByText('For tomorrow')).not.toBeInTheDocument()
  })

  it('notes when the tomorrow note became a goal', () => {
    const state = base()
    renderJournal({
      ...state,
      goals: [
        ...state.goals,
        {
          id: 'planned-goal',
          title: 'Book the appointment',
          schedule: 'once' as const,
          weekdays: [],
          createdDate: DAY,
          archived: false,
          scheduledDate: '2026-01-02',
        },
      ],
      recaps: [recap(DAY, { plannedGoalId: 'planned-goal' })],
    })

    expect(
      screen.getByText(/Became a goal: Book the appointment/),
    ).toBeInTheDocument()
  })

  it('asks before deleting a recap, and does nothing until confirmed', async () => {
    const handlers = renderJournal({ ...base(), recaps: [recap(DAY)] })

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(handlers.onDeleteRecap).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(handlers.onDeleteRecap).toHaveBeenCalledWith(`recap-${DAY}`)
  })

  it('edits a recap in place', async () => {
    const handlers = renderJournal({ ...base(), recaps: [recap(DAY)] })

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const wentWell = screen.getByLabelText('What went well')
    await userEvent.clear(wentWell)
    await userEvent.type(wentWell, 'Sat in the sun.')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(handlers.onUpdateRecap).toHaveBeenCalledWith(
      expect.objectContaining({ wentWell: 'Sat in the sun.' }),
    )
  })
})

