import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushDrafts, resetDrafts } from '../lib/drafts'
import { createInitialState } from '../lib/progression'
import { gardenRepository } from '../repository/gardenRepository'
import { MoonlightRecap } from './MoonlightRecap'

/* 6.2: "Draft kept" under each recap answer once it has reached storage. */
const TODAY = '2026-09-08'

function renderRecap() {
  const onCollect = vi.fn()
  render(
    <MoonlightRecap
      state={createInitialState('Tester', 'Test Garden')}
      targetDate={TODAY}
      today={TODAY}
      onCollect={onCollect}
      onClose={vi.fn()}
    />,
  )
  return onCollect
}

const next = () => userEvent.click(screen.getByRole('button', { name: 'Continue' }))
const hints = () => screen.queryAllByText('Draft kept')
const written = () =>
  act(async () => {
    await flushDrafts()
  })

afterEach(() => {
  resetDrafts()
  vi.restoreAllMocks()
})

describe('6.2 “Draft kept” in the recap', () => {
  it('shows under each answer once it is written, and goes once the night is collected', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(true)
    const onCollect = renderRecap()
    await next()
    await next()
    const wentWell = screen.getByRole('textbox')
    fireEvent.change(wentWell, { target: { value: 'A walk at lunch' } })
    expect(hints()).toHaveLength(0)
    await written()
    expect(wentWell).toHaveAccessibleDescription('Draft kept')

    await next()
    const settingDown = screen.getByRole('textbox')
    expect(hints()).toHaveLength(0)
    fireEvent.change(settingDown, { target: { value: 'The long email' } })
    await written()
    expect(settingDown).toHaveAccessibleDescription('Draft kept')

    await next()
    const tomorrow = screen.getByRole('textbox', { name: 'Note 1 for tomorrow' })
    expect(hints()).toHaveLength(0)
    fireEvent.change(tomorrow, { target: { value: 'Water the basil' } })
    await written()
    expect(tomorrow).toHaveAccessibleDescription('Draft kept')

    await next()
    await userEvent.click(screen.getByRole('button', { name: 'Collect Moonlight' }))
    expect(onCollect).toHaveBeenCalled()
    expect(hints()).toHaveLength(0)
  })

  it('never shows for an answer the write kept out', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(undefined)
    renderRecap()
    await next()
    await next()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Kept out' } })
    await written()
    expect(hints()).toHaveLength(0)
  })
})
