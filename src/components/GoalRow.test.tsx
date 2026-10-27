import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SWIPE_DISTANCE } from '../hooks/useSwipe'
import { formatJournalDate } from '../lib/date'
import type { Goal } from '../types'
import { GoalRow } from './GoalRow'

const TODAY = '2026-10-27'

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'ferns',
    title: 'Water the ferns',
    schedule: 'daily',
    weekdays: [],
    createdDate: '2026-10-01',
    archived: false,
    ...overrides,
  }
}

function renderRow(
  overrides: { goal?: Partial<Goal>; complete?: boolean; skipped?: boolean } = {},
) {
  const handlers = {
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    onSnooze: vi.fn(),
    onEdit: vi.fn(),
    onArchive: vi.fn(),
  }
  render(
    <GoalRow
      goal={goal(overrides.goal)}
      today={TODAY}
      complete={overrides.complete ?? false}
      skipped={overrides.skipped ?? false}
      {...handlers}
    />,
  )
  return { ...handlers, user: userEvent.setup() }
}

const toggle = () => screen.getByRole('button', { name: 'More for Water the ferns' })
const options = () => screen.queryByRole('group', { name: 'Water the ferns options' })
const option = (name: string | RegExp) => within(options()!).getByRole('button', { name })

describe('the check button', () => {
  it('completes the goal', async () => {
    const { onComplete, user } = renderRow()
    const check = screen.getByRole('button', { name: 'Care for Water the ferns' })
    expect(check).toBeEnabled()
    await user.click(check)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('says the goal is done, and cannot be pressed again, once it is complete', () => {
    renderRow({ complete: true })
    expect(screen.queryByRole('button', { name: 'Care for Water the ferns' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Done: Water the ferns' })).toBeDisabled()
  })

  it('cannot be pressed on a goal skipped today', () => {
    renderRow({ skipped: true })
    expect(screen.getByRole('button', { name: 'Care for Water the ferns' })).toBeDisabled()
  })
})

describe('the schedule under the title', () => {
  it('names a daily goal', () => {
    renderRow()
    expect(screen.getByText('Every day')).toBeInTheDocument()
  })

  it('names a goal kept on selected days', () => {
    renderRow({ goal: { schedule: 'weekdays', weekdays: [1, 3, 5] } })
    expect(screen.getByText('Selected days')).toBeInTheDocument()
  })

  it('names a one-time goal', () => {
    renderRow({ goal: { schedule: 'once' } })
    expect(screen.getByText('One time')).toBeInTheDocument()
  })

  it('gives the day a planned one-time goal was planned for', () => {
    renderRow({ goal: { schedule: 'once', scheduledDate: '2026-11-03' } })
    expect(screen.getByText(`Planned · ${formatJournalDate('2026-11-03')}`)).toBeInTheDocument()
    expect(screen.getByText(/^Planned · .*November 3/)).toBeInTheDocument()
  })

  it('says when the goal was skipped today', () => {
    renderRow({ skipped: true })
    expect(screen.getByText('Every day · skipped today')).toBeInTheDocument()
  })
})

describe('the ⋯ menu', () => {
  it('opens and closes from its button', async () => {
    const { user } = renderRow()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(options()).toBeNull()

    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(options()).toBeInTheDocument()
    expect(toggle()).toHaveAttribute('aria-controls', options()!.id)

    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(options()).toBeNull()
  })

  it('closes on Escape and hands focus back to its button', async () => {
    const { user } = renderRow()
    await user.click(toggle())
    await user.tab()
    expect(option('Skip today')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(options()).toBeNull()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(toggle()).toHaveFocus()
  })

  it('keeps that Escape from the page only while it is open', async () => {
    const { user } = renderRow()
    const page = vi.fn()
    document.addEventListener('keydown', page)
    try {
      await user.click(toggle())
      await user.keyboard('{Escape}')
      expect(page).not.toHaveBeenCalled()

      await user.keyboard('{Escape}')
      expect(page).toHaveBeenCalledOnce()
    } finally {
      document.removeEventListener('keydown', page)
    }
  })

  it('closes when the gardener presses anywhere else, and starts over next time', async () => {
    const { user } = renderRow()
    await user.click(toggle())
    await user.click(option('Snooze…'))
    // Pressing inside the menu leaves it open.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(options()).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    expect(options()).toBeNull()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle())
    expect(option('Snooze…')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Snooze until' })).toBeNull()
  })

  it('stops listening for presses elsewhere once it is closed', async () => {
    const { user } = renderRow()
    const listening = vi.spyOn(document, 'removeEventListener')
    await user.click(toggle())
    await user.click(toggle())
    expect(listening).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    listening.mockRestore()
  })
})

describe('skipping from the menu', () => {
  it('skips today and closes', async () => {
    const { onSkip, user } = renderRow()
    await user.click(toggle())
    await user.click(option('Skip today'))
    expect(onSkip).toHaveBeenCalledOnce()
    expect(options()).toBeNull()
    // The row stays, so focus goes back to where it came from.
    expect(toggle()).toHaveFocus()
  })

  it('brings back a goal skipped today', async () => {
    const { onSkip, user } = renderRow({ skipped: true })
    await user.click(toggle())
    expect(within(options()!).queryByRole('button', { name: 'Skip today' })).toBeNull()
    await user.click(option('Bring back today'))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('offers neither skipping nor snoozing once the goal is complete', async () => {
    const { user } = renderRow({ complete: true })
    await user.click(toggle())
    const menu = within(options()!)
    expect(menu.queryByRole('button', { name: 'Skip today' })).toBeNull()
    expect(menu.queryByRole('button', { name: 'Bring back today' })).toBeNull()
    expect(menu.queryByRole('button', { name: 'Snooze…' })).toBeNull()
    expect(menu.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(menu.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  })

  it('does not offer to snooze a goal already skipped today', async () => {
    const { user } = renderRow({ skipped: true })
    await user.click(toggle())
    expect(within(options()!).queryByRole('button', { name: 'Snooze…' })).toBeNull()
  })
})

describe('snoozing from the menu', () => {
  it.each([
    ['Tomorrow', 1],
    ['3 days', 3],
    ['Next week', 7],
  ])('snoozes until %s and closes', async (label, days) => {
    const { onSnooze, user } = renderRow()
    await user.click(toggle())
    expect(screen.queryByRole('group', { name: 'Snooze until' })).toBeNull()
    await user.click(option('Snooze…'))
    const choices = within(screen.getByRole('group', { name: 'Snooze until' }))
    expect(within(options()!).queryByRole('button', { name: 'Snooze…' })).toBeNull()

    await user.click(choices.getByRole('button', { name: label }))
    expect(onSnooze).toHaveBeenCalledExactlyOnceWith(days)
    expect(options()).toBeNull()
  })

  it('snoozes until a later date picked from the calendar', async () => {
    const { onSnooze, user } = renderRow()
    await user.click(toggle())
    await user.click(option('Snooze…'))
    const picker = screen.getByLabelText('Pick a date')
    expect(picker).toHaveAttribute('min', '2026-10-28')
    expect(picker).toHaveAttribute('max', '9999-12-31')

    // Choosing a date does nothing until it is confirmed: the arrow keys step
    // through dates nobody chose. Across the clocks going back, still a week.
    fireEvent.change(picker, { target: { value: '2026-11-03' } })
    expect(onSnooze).not.toHaveBeenCalled()
    await user.click(option(`Snooze until ${formatJournalDate('2026-11-03')}`))
    expect(onSnooze).toHaveBeenCalledExactlyOnceWith(7)
    expect(options()).toBeNull()
  })

  it('takes focus to the first snooze length when the choices open', async () => {
    const { user } = renderRow()
    await user.click(toggle())
    await user.click(option('Snooze…'))
    expect(option('Tomorrow')).toHaveFocus()
  })

  it('ignores today, an earlier day, or a cleared date', async () => {
    const { onSnooze, user } = renderRow()
    await user.click(toggle())
    await user.click(option('Snooze…'))
    const picker = screen.getByLabelText('Pick a date')

    const confirm = () => option(/^Snooze until/)
    expect(confirm()).toBeDisabled()
    for (const value of [TODAY, '2026-10-20', '', '30000-01-01']) {
      fireEvent.change(picker, { target: { value } })
      expect(confirm()).toBeDisabled()
    }
    expect(onSnooze).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Snooze until' })).toBeInTheDocument()
  })
})

describe('editing and archiving from the menu', () => {
  it('edits and closes', async () => {
    const { onEdit, user } = renderRow()
    await user.click(toggle())
    await user.click(option('Edit'))
    expect(onEdit).toHaveBeenCalledOnce()
    expect(options()).toBeNull()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('archives and closes', async () => {
    const { onArchive, user } = renderRow()
    await user.click(toggle())
    await user.click(option('Archive'))
    expect(onArchive).toHaveBeenCalledOnce()
    expect(options()).toBeNull()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('swiping a row', () => {
  const row = () => screen.getByRole('article')

  function swipe(distance: number) {
    const touch = { pointerType: 'touch', pointerId: 1, clientY: 0 }
    fireEvent.pointerDown(row(), { ...touch, clientX: 0 })
    fireEvent.pointerMove(row(), { ...touch, clientX: distance })
  }

  it('follows the finger, completes on a swipe right, and skips on a swipe left', () => {
    const { onComplete, onSkip } = renderRow()
    swipe(40)
    expect(row()).toHaveStyle({ transform: 'translateX(40px)' })
    expect(row()).toHaveClass('swiping')
    swipe(SWIPE_DISTANCE)
    fireEvent.pointerUp(row(), { pointerType: 'touch', pointerId: 1, clientX: SWIPE_DISTANCE })
    expect(onComplete).toHaveBeenCalledOnce()
    expect(row().style.transform).toBe('')
    expect(row()).not.toHaveClass('swiping')

    swipe(-SWIPE_DISTANCE)
    fireEvent.pointerUp(row(), { pointerType: 'touch', pointerId: 1, clientX: -SWIPE_DISTANCE })
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it.each([
    ['complete', { complete: true }],
    ['skipped', { skipped: true }],
  ])('stays put once the goal is %s', (_, settled) => {
    const { onComplete, onSkip } = renderRow(settled)
    swipe(SWIPE_DISTANCE + 20)
    expect(row().style.transform).toBe('')
    fireEvent.pointerUp(row(), { pointerType: 'touch', pointerId: 1, clientX: SWIPE_DISTANCE + 20 })
    swipe(-SWIPE_DISTANCE - 20)
    expect(row().style.transform).toBe('')
    fireEvent.pointerUp(row(), { pointerType: 'touch', pointerId: 1, clientX: -SWIPE_DISTANCE - 20 })
    expect(onComplete).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
  })
})

describe('the open menu', () => {
  it('closes when focus tabs on past it, and stays for a press on its own padding', async () => {
    const { user } = renderRow()
    const outside = document.createElement('button')
    document.body.append(outside)
    await user.click(toggle())
    // Focus that goes nowhere in particular (a press on the panel) keeps it.
    fireEvent.blur(option('Skip today'), { relatedTarget: null })
    expect(options()).toBeInTheDocument()
    // Moving on to the next thing on the page closes it.
    fireEvent.blur(option('Skip today'), { relatedTarget: outside })
    expect(options()).toBeNull()
    outside.remove()
  })

  it('lifts its row above the rows below it, and closes on Android’s back', async () => {
    const { user } = renderRow()
    await user.click(toggle())
    expect(screen.getByRole('article')).toHaveClass('menu-open')
    expect(options()).toHaveAttribute('data-dismiss-on-back')
    // The back gesture sends the Escape the menu already answers.
    fireEvent.keyDown(options()!, { key: 'Escape' })
    expect(options()).toBeNull()
    expect(screen.getByRole('article')).not.toHaveClass('menu-open')
    expect(toggle()).toHaveFocus()
  })
})
