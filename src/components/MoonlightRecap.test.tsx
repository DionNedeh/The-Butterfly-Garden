import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDraft, resetDrafts, setDraft } from '../lib/drafts'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { MoonlightRecap } from './MoonlightRecap'

const TODAY = '2026-09-08'
/** 2026-09-07 is a Monday, which is what the grace-window label should read. */
const YESTERDAY = '2026-09-07'

function renderRecap(
  overrides: {
    targetDate?: string
    today?: string
    state?: AppState
    onFadeToNight?: () => void
    onOpenGuide?: (section: string) => void
  } = {},
) {
  const onCollect = vi.fn()
  const onClose = vi.fn()
  const { unmount } = render(
    <MoonlightRecap
      state={overrides.state ?? createInitialState('Tester', 'Test Garden')}
      targetDate={overrides.targetDate ?? TODAY}
      today={overrides.today ?? TODAY}
      onCollect={onCollect}
      onClose={onClose}
      onFadeToNight={overrides.onFadeToNight}
      onOpenGuide={overrides.onOpenGuide}
    />,
  )
  return { onCollect, onClose, unmount }
}

/** Walk to the notes for tomorrow, keeping whatever is already there. */
async function continueToTomorrow() {
  for (let step = 0; step < 4; step += 1) {
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  }
}

/** Walk to the final step without answering anything. */
async function skipToEnd() {
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  for (let step = 0; step < 4; step += 1) {
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
  }
}

describe('the Moonlight recap', () => {
  // Typed answers are kept as drafts in memory; none may reach the next test.
  afterEach(() => resetDrafts())

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
      tomorrow: [{ text: '', plan: false }],
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('can end by fading the garden to night, collected exactly as the ordinary finish', async () => {
    const onFadeToNight = vi.fn()
    const { onCollect, onClose } = renderRecap({ onFadeToNight })
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: /Bright/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.type(screen.getByRole('textbox'), 'Tea in the garden.')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.type(screen.getByRole('textbox'), 'The long meeting.')
    for (let step = 0; step < 2; step += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    }

    // Collect Moonlight stays the first choice; the quieter one follows it.
    const collect = screen.getByRole('button', { name: 'Collect Moonlight' })
    const fade = screen.getByRole('button', { name: 'Fade the garden to night and close' })
    expect(collect.compareDocumentPosition(fade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(collect).toHaveClass('primary-button')

    await userEvent.click(fade)
    expect(onCollect).toHaveBeenCalledOnce()
    expect(onCollect).toHaveBeenCalledWith({
      level: 4,
      wentWell: 'Tea in the garden.',
      settingDown: 'The long meeting.',
      tomorrow: [{ text: '', plan: false }],
    })
    expect(onFadeToNight).toHaveBeenCalledOnce()
    // It leaves its own way, not by the ordinary close to Today.
    expect(onClose).not.toHaveBeenCalled()
    // The drafts are spent, as after the ordinary finish.
    expect(getDraft(`recap:${TODAY}:wentWell`)).toBeUndefined()
  })

  it('offers only the ordinary finish when there is no other way to end', async () => {
    renderRecap()
    await skipToEnd()
    expect(screen.getByRole('button', { name: 'Collect Moonlight' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /fade the garden/i })).not.toBeInTheDocument()
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
      tomorrow: [{ text: '', plan: false }],
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
        tomorrow: [{ text: 'Book the appointment', plan: true }],
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
      expect.objectContaining({ tomorrow: [{ text: '', plan: false }] }),
    )
  })

  it('withdraws an answer that is skipped after being typed', async () => {
    // Skip has to mean "do not keep this". If it only advanced, it would do
    // exactly what Continue does and quietly store the thing being withdrawn.
    const { onCollect } = renderRecap()

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: /Bright/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await userEvent.type(screen.getByRole('textbox'), 'On second thoughts.')
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Collect Moonlight' }),
    )

    expect(onCollect).toHaveBeenCalledWith({
      level: undefined,
      wentWell: '',
      settingDown: '',
      tomorrow: [{ text: '', plan: false }],
    })
  })

  it('drops a planned goal when its note is skipped', async () => {
    const { onCollect } = renderRecap()

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(
        screen.getByRole('button', { name: 'Skip this one' }),
      )
    }
    await userEvent.type(screen.getByRole('textbox'), 'Book the appointment')
    await userEvent.click(
      screen.getByRole('button', { name: /Add to tomorrow/ }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Collect Moonlight' }),
    )

    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({ tomorrow: [{ text: '', plan: false }] }),
    )
  })

  it('keeps an answer that is passed with Continue', async () => {
    // The other half of the contract: Continue must not discard anything.
    const { onCollect } = renderRecap()

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: /Bright/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(
        screen.getByRole('button', { name: 'Skip this one' }),
      )
    }
    await userEvent.click(
      screen.getByRole('button', { name: 'Collect Moonlight' }),
    )

    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({ level: 4 }),
    )
  })

  it('names the day it is closing when that is not today', () => {
    renderRecap({ targetDate: YESTERDAY, today: TODAY })
    expect(screen.getByText('Rounding out Monday')).toBeInTheDocument()
  })

  it('shows the day back in words before asking about it, with no streak', () => {
    renderRecap()
    expect(screen.getByText('Here is your day.')).toBeInTheDocument()
    expect(screen.getByText('Sunlight earned')).toBeInTheDocument()
    expect(screen.getByText(/^You /)).toBeInTheDocument()
    expect(screen.queryByText(/in a row|streak/i)).toBeNull()
  })

  it('can be left without collecting', async () => {
    const { onCollect, onClose } = renderRecap()
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onClose).toHaveBeenCalled()
    expect(onCollect).not.toHaveBeenCalled()
  })

  it('takes up to three notes for tomorrow, each planned on its own', async () => {
    const { onCollect } = renderRecap()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    for (let step = 0; step < 3; step += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    }
    expect(screen.getByText('A reminder, not a promise.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull()
    await userEvent.type(screen.getByLabelText('Note 1 for tomorrow'), 'Call the vet')
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }))
    await userEvent.type(screen.getByLabelText('Note 2 for tomorrow'), 'Water the fern')
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }))
    await userEvent.type(screen.getByLabelText('Note 3 for tomorrow'), 'Rest')
    // Three is the most it takes.
    expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Add to tomorrow’s goals: Water the fern/ }))
    expect(screen.getByText(/They will be waiting on/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: 'Collect Moonlight' }))
    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({
        tomorrow: [
          { text: 'Call the vet', plan: false },
          { text: 'Water the fern', plan: true },
          { text: 'Rest', plan: false },
        ],
      }),
    )
  })

  it('brings back notes on separate lines as separate notes when it is opened again', async () => {
    const first = renderRecap()
    await continueToTomorrow()
    await userEvent.type(screen.getByLabelText('Note 1 for tomorrow'), 'Call the vet')
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }))
    await userEvent.type(screen.getByLabelText('Note 2 for tomorrow'), 'Water the fern')
    first.unmount()

    const { onCollect } = renderRecap()
    await continueToTomorrow()
    expect(screen.getByLabelText('Note 1 for tomorrow')).toHaveValue('Call the vet')
    expect(screen.getByLabelText('Note 2 for tomorrow')).toHaveValue('Water the fern')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: 'Collect Moonlight' }))
    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({
        tomorrow: [
          { text: 'Call the vet', plan: false },
          { text: 'Water the fern', plan: false },
        ],
      }),
    )
  })

  it('keeps every word of an older, longer draft in three notes', async () => {
    // The previous build's single text box, blank lines and all.
    setDraft(`recap:${TODAY}:forTomorrow`, 'One\n\nTwo\nThree\nFour')
    renderRecap()
    await continueToTomorrow()
    expect(screen.getByLabelText('Note 1 for tomorrow')).toHaveValue('One')
    expect(screen.getByLabelText('Note 2 for tomorrow')).toHaveValue('Two')
    expect(screen.getByLabelText('Note 3 for tomorrow')).toHaveValue('Three Four')
    expect(screen.queryByLabelText('Note 4 for tomorrow')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull()
  })

  it('takes focus to the note it adds', async () => {
    renderRecap()
    await continueToTomorrow()
    await userEvent.type(screen.getByLabelText('Note 1 for tomorrow'), 'Call the vet')
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }))
    expect(screen.getByLabelText('Note 2 for tomorrow')).toHaveFocus()
  })

  it('un-plans a note when it is pressed a second time', async () => {
    const { onCollect } = renderRecap()
    await continueToTomorrow()
    await userEvent.type(screen.getByLabelText('Note 1 for tomorrow'), 'Book the appointment')
    const plan = screen.getByRole('button', {
      name: 'Add to tomorrow’s goals: Book the appointment',
    })
    expect(plan).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(plan)
    expect(plan).toHaveAttribute('aria-pressed', 'true')
    // The name stays; the pressed state is what changes.
    expect(plan).toHaveAccessibleName('Add to tomorrow’s goals: Book the appointment')
    expect(screen.getByText(/They will be waiting on Wednesday/)).toBeInTheDocument()

    await userEvent.click(plan)
    expect(plan).toHaveAttribute('aria-pressed', 'false')
    expect(plan).toHaveAccessibleName('Add to tomorrow’s goals: Book the appointment')
    expect(screen.queryByText(/They will be waiting on/)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await userEvent.click(screen.getByRole('button', { name: 'Collect Moonlight' }))
    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({
        tomorrow: [{ text: 'Book the appointment', plan: false }],
      }),
    )
  })

  it('clears every note and every plan when the notes are skipped', async () => {
    const { onCollect } = renderRecap()
    await continueToTomorrow()
    await userEvent.type(screen.getByLabelText('Note 1 for tomorrow'), 'Call the vet')
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }))
    await userEvent.type(screen.getByLabelText('Note 2 for tomorrow'), 'Water the fern')
    await userEvent.click(
      screen.getByRole('button', { name: 'Add to tomorrow’s goals: Call the vet' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Add to tomorrow’s goals: Water the fern' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))

    // Going back finds the step as it was before anything was written.
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Note 1 for tomorrow')).toHaveValue('')
    expect(screen.queryByLabelText('Note 2 for tomorrow')).toBeNull()
    // Writing the same note again does not bring its old plan back with it.
    await userEvent.type(screen.getByLabelText('Note 1 for tomorrow'), 'Call the vet')
    expect(
      screen.getByRole('button', { name: 'Add to tomorrow’s goals: Call the vet' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Skip this one' }))
    await userEvent.click(screen.getByRole('button', { name: 'Collect Moonlight' }))

    expect(onCollect).toHaveBeenCalledWith(
      expect.objectContaining({ tomorrow: [{ text: '', plan: false }] }),
    )
  })
})

describe('the recap and the Guide', () => {
  it('links to what Moonlight does before any question, and only then', async () => {
    const onOpenGuide = vi.fn()
    renderRecap({ onOpenGuide })
    await userEvent.click(screen.getByRole('link', { name: 'What does this do? Moonlight, in the Guide' }))
    expect(onOpenGuide).toHaveBeenCalledWith('moonlight')
    // Leaving later would lose the answers, so the link is not offered there.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.queryByRole('link', { name: /^What does this do/ })).toBeNull()
  })
})

