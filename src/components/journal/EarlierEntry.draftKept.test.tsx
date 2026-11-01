import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushDrafts, resetDrafts } from '../../lib/drafts'
import { createInitialState } from '../../lib/progression'
import { gardenRepository } from '../../repository/gardenRepository'
import { EarlierEntry } from './EarlierEntry'

/* 6.2: "Draft kept" under an earlier day's note and reflection once written. */
const NOW = new Date(2026, 9, 27, 10)
const TODAY = '2026-10-27'

function renderForm() {
  const handlers = { onAddMood: vi.fn(), onAddReflection: vi.fn(), onOpenDay: vi.fn() }
  render(
    <EarlierEntry
      state={createInitialState('Tester', 'Test Garden', new Date(2026, 9, 1, 9))}
      today={TODAY}
      {...handlers}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add an entry for an earlier day' }))
  return handlers
}

const hints = () => screen.queryAllByText('Draft kept')
const written = () =>
  act(async () => {
    await flushDrafts()
  })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
  resetDrafts()
  vi.restoreAllMocks()
})

describe('6.2 “Draft kept” for an earlier day', () => {
  it('shows under the note, and goes once the check-in is saved', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(true)
    const { onAddMood } = renderForm()
    fireEvent.change(screen.getByLabelText('Which day?'), { target: { value: '2026-10-20' } })
    // A day is not writing: no hint for it alone.
    await written()
    expect(hints()).toHaveLength(0)
    const note = screen.getByLabelText('A note about that day, if you want')
    fireEvent.change(note, { target: { value: 'Rain all day' } })
    await written()
    expect(note).toHaveAccessibleDescription('Draft kept')
    fireEvent.change(screen.getByLabelText('Inner weather that day'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    expect(onAddMood).toHaveBeenCalled()
    expect(hints()).toHaveLength(0)
  })

  it('shows under the reflection, and goes once it is saved', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(true)
    const { onAddReflection } = renderForm()
    fireEvent.change(screen.getByLabelText('Which day?'), { target: { value: '2026-10-20' } })
    fireEvent.click(screen.getByRole('radio', { name: 'A reflection' }))
    const body = screen.getByLabelText('What would you like to remember about that day?')
    fireEvent.change(body, { target: { value: 'The heron came back' } })
    await written()
    expect(body).toHaveAccessibleDescription('Draft kept')
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }))
    expect(onAddReflection).toHaveBeenCalled()
    expect(hints()).toHaveLength(0)
  })

  it('never shows for words the write kept out', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(undefined)
    renderForm()
    fireEvent.change(screen.getByLabelText('Which day?'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('A note about that day, if you want'), {
      target: { value: 'Kept out' },
    })
    await written()
    expect(hints()).toHaveLength(0)
  })
})
