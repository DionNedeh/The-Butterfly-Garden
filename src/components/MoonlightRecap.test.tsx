import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { MoonlightRecap } from './MoonlightRecap'

const TODAY = '2026-09-08'
/** 2026-09-07 is a Monday, which is what the grace-window label should read. */
const YESTERDAY = '2026-09-07'

function renderRecap(
  overrides: { targetDate?: string; today?: string; state?: AppState } = {},
) {
  const onCollect = vi.fn()
  const onClose = vi.fn()
  render(
    <MoonlightRecap
      state={overrides.state ?? createInitialState('Tester', 'Test Garden')}
      targetDate={overrides.targetDate ?? TODAY}
      today={overrides.today ?? TODAY}
      onCollect={onCollect}
      onClose={onClose}
    />,
  )
  return { onCollect, onClose }
}

/** Walk to the final step without answering anything. */
async function skipToEnd() {
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  for (let step = 0; step < 4; step += 1) {
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
  }
}

describe('the Moonlight recap', () => {
  it('collects with every question skipped', async () => {
    // The reward is for closing the day, not for filling anything in.
    const { onCollect, onClose } = renderRecap()
    await skipToEnd()
    await userEvent.click(
      screen.getByRole('button', { name: 'Collect Moonlight' }),
    )

    expect(onCollect).toHaveBeenCalledWith({
      level: undefined,
      wentWell: '',
      settingDown: '',
      forTomorrow: '',
      planForTomorrow: false,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('carries the answers it was given', async () => {
    const { onCollect } = renderRecap()

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: /Bright/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.type(
      screen.getByRole('textbox'),
      'Walked to the river.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.type(
      screen.getByRole('textbox'),
      'The unanswered email.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Collect Moonlight' }),
    )

    expect(onCollect).toHaveBeenCalledWith({
      level: 4,
      wentWell: 'Walked to the river.',
      settingDown: 'The unanswered email.',
      forTomorrow: '',
      planForTomorrow: false,
    })
  })

  it('offers to plan the tomorrow note, but only once there is one', async () => {
    const { onCollect } = renderRecap()

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(
        screen.getByRole('button', { name: 'Skip this one' }),
      )
    }

    expect(
      screen.queryByRole('button', { name: /Add to tomorrow/ }),
    ).not.toBeInTheDocument()

    await userEvent.type(
      screen.getByRole('textbox'),
      'Book the appointment',
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Add to tomorrow/ }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Collect Moonlight' }),
    )

    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({
        forTomorrow: 'Book the appointment',
        planForTomorrow: true,
      }),
    )
  })

  it('does not plan a note that was emptied again', async () => {
    const { onCollect } = renderRecap()

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(
        screen.getByRole('button', { name: 'Skip this one' }),
      )
    }
    const note = screen.getByRole('textbox')
    await userEvent.type(note, 'Book the appointment')
    await userEvent.click(
      screen.getByRole('button', { name: /Add to tomorrow/ }),
    )
    await userEvent.clear(note)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Collect Moonlight' }),
    )

    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({ planForTomorrow: false }),
    )
  })

  it('names the day it is closing when that is not today', () => {
    renderRecap({ targetDate: YESTERDAY, today: TODAY })
    expect(screen.getByText('Rounding out Monday')).toBeInTheDocument()
  })

  it('shows the day back before asking about it', () => {
    renderRecap()
    expect(screen.getByText('Here is your day.')).toBeInTheDocument()
    expect(screen.getByText('Sunlight earned')).toBeInTheDocument()
  })

  it('can be left without collecting', async () => {
    const { onCollect, onClose } = renderRecap()
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onClose).toHaveBeenCalled()
    expect(onCollect).not.toHaveBeenCalled()
  })
})
