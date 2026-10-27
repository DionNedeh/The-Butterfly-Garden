import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { addDaysToLocalDate, formatJournalDate, toLocalDate } from '../lib/date'
import { createInitialState } from '../lib/progression'
import { dayWeatherLabel } from '../lib/weatherCalendar'
import type { AppState, Goal, MoodEntry, RecapEntry, ReflectionEntry } from '../types'
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

/** A one-time goal, as planning a note for tomorrow makes one. */
function goal(id: string, title: string): Goal {
  return {
    id,
    title,
    schedule: 'once',
    weekdays: [],
    createdDate: '2026-01-01',
    archived: false,
    scheduledDate: '2026-01-02',
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

describe('butterflies welcomed', () => {
  it('counts species, so two monarchs are one of the set', () => {
    const base = gardenWithDays(1)
    const monarch = (id: string) => ({
      id,
      speciesId: 'monarch',
      name: id,
      stage: 'butterfly' as const,
      careDates: {},
      actionLog: {},
      bond: 0,
      outfit: {},
      carePoints: 0,
      discoveredAt: '2026-01-01T00:00:00.000Z',
    })
    renderJournal({ ...base, creatures: [monarch('a'), monarch('b')] })
    expect(document.querySelector('.field-notes .count-badge')?.textContent).toMatch(/^1 \/ \d+$/)
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

  it('lists each note for tomorrow when there were several', () => {
    renderJournal({
      ...base(),
      recaps: [recap(DAY, { forTomorrow: 'Call the vet\nWater the fern\nRest' })],
    })

    expect(screen.getAllByText('For tomorrow')).toHaveLength(1)
    const notes = within(screen.getByText('For tomorrow').parentElement as HTMLElement)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(notes).toEqual(['Call the vet', 'Water the fern', 'Rest'])
  })

  it('leaves blank lines out of the notes for tomorrow', () => {
    renderJournal({
      ...base(),
      recaps: [recap(DAY, { forTomorrow: 'Call the vet\n  \nRest' })],
    })

    const notes = within(screen.getByText('For tomorrow').parentElement as HTMLElement)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(notes).toEqual(['Call the vet', 'Rest'])
  })

  it('shows a single note for tomorrow as a line, not a list', () => {
    // A note left with an empty second line, from "Add another", is still one.
    renderJournal({
      ...base(),
      recaps: [recap(DAY, { forTomorrow: 'Book the appointment\n' })],
    })

    expect(screen.getByText('For tomorrow')).toBeInTheDocument()
    const note = screen.getByText('Book the appointment')
    const entry = note.closest('article') as HTMLElement
    expect(within(entry).queryByRole('list')).not.toBeInTheDocument()
  })

  it('names every note that became a goal', () => {
    const state = base()
    renderJournal({
      ...state,
      goals: [
        ...state.goals,
        goal('vet', 'Call the vet'),
        goal('fern', 'Water the fern'),
        goal('rest', 'Rest'),
      ],
      recaps: [
        recap(DAY, {
          forTomorrow: 'Call the vet\nWater the fern\nRest',
          plannedGoalId: 'vet',
          plannedGoalIds: ['vet', 'fern'],
        }),
      ],
    })

    expect(
      screen.getByText('Became goals: Call the vet and Water the fern'),
    ).toBeInTheDocument()
  })

  it('names three planned goals as a list', () => {
    const state = base()
    renderJournal({
      ...state,
      goals: [
        ...state.goals,
        goal('vet', 'Call the vet'),
        goal('fern', 'Water the fern'),
        goal('rest', 'Rest'),
      ],
      recaps: [recap(DAY, { plannedGoalIds: ['vet', 'fern', 'rest'] })],
    })

    expect(
      screen.getByText('Became goals: Call the vet, Water the fern and Rest'),
    ).toBeInTheDocument()
  })

  it('names one planned goal in the singular', () => {
    const state = base()
    renderJournal({
      ...state,
      goals: [...state.goals, goal('fern', 'Water the fern')],
      recaps: [recap(DAY, { plannedGoalIds: ['fern'] })],
    })

    expect(screen.getByText('Became a goal: Water the fern')).toBeInTheDocument()
  })

  it('skips planned goals that have since been deleted', () => {
    const state = base()
    renderJournal({
      ...state,
      goals: [
        ...state.goals,
        goal('vet', 'Call the vet'),
        goal('rest', 'Rest'),
      ],
      recaps: [
        recap(DAY, { plannedGoalIds: ['gone', 'vet', 'also-gone', 'rest'] }),
      ],
    })

    expect(screen.getByText('Became goals: Call the vet and Rest')).toBeInTheDocument()
  })

  it('names one goal in the singular when the others were deleted', () => {
    const state = base()
    renderJournal({
      ...state,
      goals: [...state.goals, goal('rest', 'Rest')],
      recaps: [recap(DAY, { plannedGoalIds: ['gone', 'rest'] })],
    })

    expect(screen.getByText('Became a goal: Rest')).toBeInTheDocument()
  })

  it('says nothing of goals when every planned one was deleted', () => {
    renderJournal({
      ...base(),
      recaps: [
        recap(DAY, { plannedGoalId: 'gone', plannedGoalIds: ['gone', 'also-gone'] }),
      ],
    })

    expect(screen.queryByText(/Became/)).not.toBeInTheDocument()
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


describe('the rhythm of care', () => {
  const award = (localDate: string) => ({ id: localDate, localDate, source: `mood:${localDate}`, awardedAt: '' })

  it('counts days cared for without ever showing a broken streak', () => {
    const today = new Date()
    const iso = (offset: number) => {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    }
    // Yesterday was missed; the old streak would read nothing at all today.
    renderJournal({
      ...createInitialState('Tester', 'Test Garden'),
      sunlight: [award(iso(2)), award(iso(3)), award(iso(4))],
    })
    expect(screen.getByRole('heading', { name: 'Your rhythm' })).toBeInTheDocument()
    expect(screen.getByLabelText('3 of the last 7 days cared for')).toBeInTheDocument()
    expect(screen.getByText(/longest run so far is 3 days/)).toBeInTheDocument()
    expect(screen.queryByText(/streak/i)).toBeNull()
  })

  it('keeps the journal free of numbers when the gardener asks', () => {
    const seed = createInitialState('Tester', 'Test Garden')
    renderJournal({ ...seed, profile: { ...seed.profile!, hideDayCounts: true } })
    expect(screen.getByText(/Day counts are hidden, as you chose/)).toBeInTheDocument()
    expect(screen.queryByText(/of the last 7/)).toBeNull()
  })
})

describe('a check-in that was not sure', () => {
  it('reads "Not sure", and can be changed to a weather or back', async () => {
    const user = userEvent.setup()
    const unsure: MoodEntry = { ...mood('2026-03-01', 'Hard to say'), level: 3, unsure: true }
    const { onUpdateMood } = renderJournal({ ...createInitialState('Tester', 'Test Garden'), moods: [unsure] })
    expect(within(document.getElementById('day-2026-03-01')!).getByText('Not sure')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const select = screen.getByLabelText('Inner weather')
    expect(select).toHaveValue('unsure')
    await user.selectOptions(select, '5')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const saved = onUpdateMood.mock.calls[0][0] as MoodEntry
    expect(saved.level).toBe(5)
    expect(saved.unsure).toBeUndefined()
  })
})

describe('finding a day in the journal', () => {
  // Real days, ending today: the calendar opens on the month the clock says.
  const today = toLocalDate(new Date())
  const days = Array.from({ length: 35 }, (_, index) => addDaysToLocalDate(today, -index))
  const journal = (): AppState => ({
    ...createInitialState('Tester', 'Test Garden'),
    moods: days.map((day, index) => mood(day, index === 3 ? 'Walked by the río' : 'Quiet')),
  })
  const shownDays = () => document.querySelectorAll('.timeline-entry').length

  it('narrows the timeline to the days whose words match', async () => {
    const user = userEvent.setup()
    renderJournal(journal())
    expect(shownDays()).toBe(30)
    // Accents and case are forgiven.
    await user.type(screen.getByRole('searchbox', { name: 'Search your journal' }), 'RIO')
    await waitFor(() => expect(shownDays()).toBe(1))
    expect(document.getElementById(`day-${days[3]}`)).toBeInTheDocument()
    expect(screen.getByText('1 day matches')).toHaveAttribute('role', 'status')

    await user.clear(screen.getByRole('searchbox', { name: 'Search your journal' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search your journal' }), 'nowhere')
    await waitFor(() => expect(screen.getByText('Nothing in the journal matches that yet.')).toBeInTheDocument())
  })

  it('opens a day from the calendar, past the first page, and gives it focus', async () => {
    const user = userEvent.setup()
    renderJournal(journal())
    const oldest = days[days.length - 1]
    expect(document.getElementById(`day-${oldest}`)).toBeNull()
    if (oldest.slice(0, 7) !== today.slice(0, 7)) {
      await user.click(screen.getByRole('button', { name: 'Previous month' }))
    }
    await user.click(
      screen.getByRole('button', { name: dayWeatherLabel(oldest, journal().moods[days.length - 1]) }),
    )
    const entry = document.getElementById(`day-${oldest}`)
    expect(entry).toBeInTheDocument()
    expect(within(entry!).getByText(formatJournalDate(oldest))).toHaveFocus()
  })

  it('opens a day already on the first page at once, and takes no focus later', async () => {
    const user = userEvent.setup()
    renderJournal(journal())
    await user.click(
      // Today: always in the month the calendar opens on.
      screen.getByRole('button', { name: dayWeatherLabel(days[0], journal().moods[0]) }),
    )
    const entry = document.getElementById(`day-${days[0]}`)!
    expect(within(entry).getByText(formatJournalDate(days[0]))).toHaveFocus()

    // Typing in the search afterwards stays in the search.
    const search = screen.getByRole('searchbox', { name: 'Search your journal' })
    await user.click(search)
    await user.type(search, 'quiet')
    expect(search).toHaveValue('quiet')
    expect(search).toHaveFocus()
  })

  it('offers readable copies of the journal', () => {
    renderJournal(journal())
    expect(screen.getByRole('heading', { name: 'Take your words with you' })).toBeInTheDocument()
  })
})
