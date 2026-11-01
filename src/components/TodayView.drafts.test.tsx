import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDraft, resetDrafts, setDraft } from '../lib/drafts'
import { createInitialState } from '../lib/progression'
import type { AppState, Goal } from '../types'
import { TodayView } from './TodayView'

const TODAY = '2026-09-05'

function goal(id: string, title: string): Goal {
  return { id, title, schedule: 'daily', weekdays: [], createdDate: '2026-09-01', archived: false }
}

const withTwo = (): AppState => ({
  ...createInitialState('Tester', 'Test Garden'),
  goals: [goal('a', 'Alpha'), goal('b', 'Beta')],
})

/** Today as the app draws it, each handler a fresh mock. */
function renderToday(state: AppState = withTwo()) {
  const props = {
    state,
    today: TODAY,
    onSaveMood: vi.fn(),
    onSaveReflection: vi.fn(),
    onAddGoal: vi.fn(),
    onUpdateGoal: vi.fn(),
    onDeleteGoal: vi.fn(),
    onCompleteGoal: vi.fn(),
    onSkipGoal: vi.fn(),
    onSnoozeGoal: vi.fn(),
    onWakeGoal: vi.fn(),
    onPlanGoal: vi.fn(),
    onSetGoalArchived: vi.fn(),
    onUncompleteGoal: vi.fn(),
    onRestoreGoal: vi.fn(),
    onAdoptGoal: vi.fn(),
    onOpenRecap: vi.fn(),
    moonlightCollected: false,
  }
  render(<TodayView {...props} />)
  return { ...props, user: userEvent.setup() }
}

const newTitle = () => screen.getByRole('combobox', { name: 'Add a goal' })
const newTiny = () => screen.getByRole('textbox', { name: 'A two-minute version (optional)' })
const editTitle = () => screen.getByRole('textbox', { name: /^Edit goal/ })

afterEach(() => resetDrafts())

describe('3.2 a goal being added on Today', () => {
  it('is kept as a draft, so it is still there when Today is drawn again', async () => {
    const { user } = renderToday()
    await user.type(newTitle(), 'Water the fern')
    await user.type(newTiny(), 'One glass')
    // Gone and back, as a lock, a reload or another page takes the app down.
    cleanup()
    renderToday()
    expect(newTitle()).toHaveValue('Water the fern')
    expect(newTiny()).toHaveValue('One glass')
  })

  it('lets the draft go once the goal is added', async () => {
    const { user, onAddGoal } = renderToday()
    await user.type(newTitle(), 'Water the fern')
    await user.click(screen.getByRole('button', { name: 'Add goal' }))
    expect(onAddGoal).toHaveBeenCalledWith('Water the fern', 'daily', [], undefined)
    cleanup()
    renderToday()
    expect(newTitle()).toHaveValue('')
  })
})

describe('3.2 a goal being edited on Today', () => {
  it('is kept as a draft, open, with what was typed in it', async () => {
    const { user } = renderToday()
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(editTitle(), ' by the window')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Repeat/ }), 'Selected days')
    await user.click(screen.getByRole('checkbox', { name: 'Fri' }))
    cleanup()
    const { user: again, onUpdateGoal } = renderToday()
    expect(editTitle()).toHaveValue('Alpha by the window')
    expect(screen.getByRole('checkbox', { name: 'Fri' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Mon' })).toBeChecked()
    await again.click(screen.getByRole('button', { name: 'Save' }))
    expect(onUpdateGoal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', title: 'Alpha by the window', schedule: 'weekdays', weekdays: [1, 2, 3, 4] }),
    )
  })

  it('lets the draft go once the editor is put away', async () => {
    const { user } = renderToday()
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(editTitle(), '!')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getDraft('goal-edit')).toBeUndefined()
    cleanup()
    renderToday()
    expect(screen.queryByRole('textbox', { name: /^Edit goal/ })).toBeNull()
  })

  it('opens nothing for a goal that is no longer there, and lets that draft go', () => {
    setDraft('goal-edit', JSON.stringify({ id: 'gone', title: 'Something else' }))
    renderToday()
    expect(screen.queryByRole('textbox', { name: /^Edit goal/ })).toBeNull()
    expect(getDraft('goal-edit')).toBeUndefined()
  })

  it('opens on the goal itself where a draft cannot be read', () => {
    setDraft('goal-edit', JSON.stringify({ id: 'b', title: 7, schedule: 'yearly', weekdays: [9], plannedFor: null }))
    renderToday()
    expect(editTitle()).toHaveValue('Beta')
    expect(screen.getByRole('combobox', { name: /^Repeat/ })).toHaveValue('daily')
  })
})

describe('3.2 a goal being edited on Today, as a draft, and the auto-lock and focus', () => {
  it('holds no auto-lock, open or put back from its draft, its words being kept', async () => {
    const { user } = renderToday()
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(editTitle(), ' by the window')
    expect(document.querySelector('[data-auto-lock-waits]')).toBeNull()
    // Today left without Cancel, and drawn again.
    cleanup()
    renderToday()
    expect(editTitle()).toHaveValue('Alpha by the window')
    expect(document.querySelector('[data-auto-lock-waits]')).toBeNull()
  })

  it('put back from its draft, leaves focus where it was, and takes it once Edit is chosen', async () => {
    setDraft('goal-edit', JSON.stringify({ id: 'a', title: 'Alpha by the window' }))
    const elsewhere = document.body.appendChild(document.createElement('button'))
    elsewhere.textContent = 'Somewhere else'
    elsewhere.focus()
    try {
      const { user } = renderToday()
      expect(editTitle()).toHaveValue('Alpha by the window')
      expect(elsewhere).toHaveFocus()
      await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
      await user.click(screen.getByRole('button', { name: 'Edit' }))
      expect(editTitle()).toHaveFocus()
      expect(editTitle()).toHaveValue('Alpha by the window')
    } finally {
      elsewhere.remove()
    }
  })
})
