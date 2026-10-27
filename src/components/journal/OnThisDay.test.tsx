import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatJournalDate } from '../../lib/date'
import { resetDrafts } from '../../lib/drafts'
import { createInitialState } from '../../lib/progression'
import type { AppState, MoodEntry, ReflectionEntry } from '../../types'
import { JournalView } from '../JournalView'

/** Only the clock is fixed: timers stay real, so typing and drafts behave as they do. */
const NOW = new Date(2026, 9, 27, 10)

function mood(localDate: string, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 2,
    note: '',
    createdAt: `${localDate}T14:00:00.000Z`,
    updatedAt: `${localDate}T14:00:00.000Z`,
    ...overrides,
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

/** A garden planted long ago, unless told otherwise. */
function garden(entries: Partial<AppState> = {}, planted = new Date(2024, 0, 1, 9)): AppState {
  return { ...createInitialState('Tester', 'Test Garden', planted), ...entries }
}

function renderJournal(state: AppState) {
  return render(
    <JournalView
      state={state}
      onUpdateMood={vi.fn()}
      onDeleteMood={vi.fn()}
      onUpdateReflection={vi.fn()}
      onDeleteReflection={vi.fn()}
      onUpdateRecap={vi.fn()}
      onDeleteRecap={vi.fn()}
    />,
  )
}

const card = () => screen.queryByRole('region', { name: /ago today$/ })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
  resetDrafts()
})

describe('on this day', () => {
  it('offers the day a year ago, with its weather and the first line of its words', () => {
    renderJournal(
      garden({
        moods: [mood('2025-10-27', { note: 'Rain on the roof.\nA long bath.' }), mood('2026-09-27')],
      }),
    )
    const offered = card()!
    expect(within(offered).getByRole('heading', { name: 'A year ago today' })).toBeInTheDocument()
    expect(within(offered).getByText(formatJournalDate('2025-10-27'))).toBeInTheDocument()
    expect(within(offered).getByText('Rainy')).toBeInTheDocument()
    expect(within(offered).getByText('Rain on the roof.')).toBeInTheDocument()
    expect(within(offered).queryByText(/A long bath/)).toBeNull()
  })

  it('offers the day a month ago when a year ago has nothing', () => {
    renderJournal(garden({ reflections: [reflection('2026-09-27', 'The light on the wall.')] }))
    const offered = card()!
    expect(within(offered).getByRole('heading', { name: 'A month ago today' })).toBeInTheDocument()
    expect(within(offered).getByText('The light on the wall.')).toBeInTheDocument()
  })

  it('opens that day in the timeline and gives it focus', async () => {
    const user = userEvent.setup()
    renderJournal(garden({ moods: [mood('2026-09-27', { note: 'Then' }), mood('2026-10-26')] }))
    await user.click(within(card()!).getByRole('button', { name: 'Read that day' }))
    const entry = document.getElementById('day-2026-09-27')!
    expect(within(entry).getByText(formatJournalDate('2026-09-27'))).toHaveFocus()
  })

  it('is put away until tomorrow, and focus goes to the top of the page', async () => {
    const user = userEvent.setup()
    const state = garden({ moods: [mood('2026-09-27')] })
    const { unmount } = renderJournal(state)
    await user.click(within(card()!).getByRole('button', { name: 'Put away for today' }))
    expect(card()).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Journal' })).toHaveFocus()

    // Still away when the Journal is opened again today…
    unmount()
    renderJournal(state)
    expect(card()).toBeNull()
  })

  it('…and back the next day', async () => {
    const user = userEvent.setup()
    const state = garden({ moods: [mood('2026-09-27'), mood('2026-09-28')] })
    const { unmount } = renderJournal(state)
    await user.click(within(card()!).getByRole('button', { name: 'Put away for today' }))
    unmount()

    vi.setSystemTime(new Date(2026, 9, 28, 10))
    renderJournal(state)
    expect(within(card()!).getByText(formatJournalDate('2026-09-28'))).toBeInTheDocument()
  })

  it('is never shown for an empty journal, nor in the garden’s first month', () => {
    const { unmount } = renderJournal(garden())
    expect(card()).toBeNull()
    unmount()

    // Planted on 1 October: a month old only on 1 November.
    renderJournal(garden({ moods: [mood('2026-09-27')] }, new Date(2026, 9, 1, 9)))
    expect(card()).toBeNull()
  })
})
