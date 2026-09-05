import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState, MoodEntry, ReflectionEntry } from '../types'
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
