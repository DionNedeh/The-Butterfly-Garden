import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushDrafts, resetDrafts } from '../lib/drafts'
import { createInitialState } from '../lib/progression'
import { gardenRepository } from '../repository/gardenRepository'
import type { AppState } from '../types'
import { TodayView } from './TodayView'

/*
 * 6.2: a small "Draft kept" under Today's check-in note and reflection once
 * what is typed has reached storage as a draft; gone once the entry is
 * saved, never for a write kept out, and never announced while typing.
 */
const TODAY = '2026-09-05'

function renderToday(state: AppState = createInitialState('Tester', 'Test Garden')) {
  const handlers = Object.fromEntries(
    [
      'onSaveMood',
      'onSaveReflection',
      'onAddGoal',
      'onUpdateGoal',
      'onDeleteGoal',
      'onCompleteGoal',
      'onSkipGoal',
      'onSnoozeGoal',
      'onWakeGoal',
      'onPlanGoal',
      'onSetGoalArchived',
      'onUncompleteGoal',
      'onRestoreGoal',
      'onAdoptGoal',
      'onOpenRecap',
    ].map((name) => [name, vi.fn()]),
  )
  render(
    <TodayView
      state={state}
      today={TODAY}
      moonlightCollected={false}
      {...(handlers as unknown as Omit<
        Parameters<typeof TodayView>[0],
        'state' | 'today' | 'moonlightCollected'
      >)}
    />,
  )
  return handlers
}

const reflection = () => screen.getByRole('textbox', { name: 'Your reflection' })
const note = () => screen.getByRole('textbox', { name: 'A note, if you want' })
const hints = () => screen.queryAllByText('Draft kept')

afterEach(() => {
  resetDrafts()
  vi.restoreAllMocks()
})

describe('6.2 “Draft kept” on Today', () => {
  it('shows under the reflection once typing pauses and the draft is written', async () => {
    const write = vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(true)
    renderToday()
    fireEvent.change(reflection(), { target: { value: 'A slow morning' } })
    // Not while typing: only once the pause has passed and the write is done.
    expect(hints()).toHaveLength(0)
    expect(await screen.findByText('Draft kept', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(write).toHaveBeenCalledWith({ [`reflection:${TODAY}`]: 'A slow morning' })
    expect(reflection()).toHaveAccessibleDescription(expect.stringContaining('Draft kept'))
    // Quiet: not a live region, so nothing is announced as it comes and goes.
    const hint = screen.getByText('Draft kept')
    expect(hint.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull()
  })

  it('goes once the reflection is kept', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(true)
    const { onSaveReflection } = renderToday()
    fireEvent.change(reflection(), { target: { value: 'A slow morning' } })
    await act(async () => {
      await flushDrafts()
    })
    expect(hints()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep this reflection' }))
    expect(onSaveReflection).toHaveBeenCalled()
    expect(hints()).toHaveLength(0)
    expect(reflection()).not.toHaveAccessibleDescription(expect.stringContaining('Draft kept'))
  })

  it('shows under the check-in note, and goes once the check-in is saved', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(true)
    const { onSaveMood } = renderToday()
    fireEvent.change(note(), { target: { value: 'Tired but fine' } })
    await act(async () => {
      await flushDrafts()
    })
    expect(note()).toHaveAccessibleDescription('Draft kept')
    fireEvent.click(screen.getByRole('button', { name: 'Not sure today' }))
    fireEvent.click(screen.getByRole('button', { name: /^Save check-in/ }))
    expect(onSaveMood).toHaveBeenCalled()
    expect(hints()).toHaveLength(0)
  })

  it('never shows for a draft the write kept out, as under the garden lock', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(undefined)
    renderToday()
    fireEvent.change(reflection(), { target: { value: 'Not stored' } })
    fireEvent.change(note(), { target: { value: 'Nor this' } })
    await act(async () => {
      await flushDrafts()
    })
    expect(hints()).toHaveLength(0)
  })
})
