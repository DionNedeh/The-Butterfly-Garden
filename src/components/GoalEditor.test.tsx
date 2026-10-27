import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Goal } from '../types'
import { GoalEditor, NO_DAYS_CHOSEN, WeekdayPicker, type GoalEdit } from './GoalEditor'

const TODAY = '2026-09-05'

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'water',
    title: 'Drink some water',
    schedule: 'daily',
    weekdays: [],
    createdDate: '2026-09-01',
    archived: false,
    ...overrides,
  }
}

function renderEditor(initial: Goal = goal(), completedBefore = false, completedToday = false) {
  const handlers = {
    onSave: vi.fn<(edit: GoalEdit) => void>(),
    onArchive: vi.fn(),
    onDelete: vi.fn(),
    onCancel: vi.fn(),
  }
  render(
    <GoalEditor
      goal={initial}
      today={TODAY}
      completedBefore={completedBefore}
      completedToday={completedToday}
      {...handlers}
    />,
  )
  return { ...handlers, user: userEvent.setup() }
}

const titleField = () => screen.getByRole('textbox', { name: /^Edit goal/ })
const repeat = () => screen.getByRole('combobox', { name: /^Repeat/ })
const day = (name: string) => screen.getByRole('checkbox', { name })
const save = () => screen.getByRole('button', { name: 'Save' })
const plannedFor = () => screen.queryByLabelText('Planned for')

describe('GoalEditor', () => {
  it('takes focus to the title field when it opens', () => {
    renderEditor()
    expect(titleField()).toHaveFocus()
    expect(titleField()).toHaveValue('Drink some water')
  })

  it('saves a trimmed title and drops the days and date a daily goal does not use', async () => {
    const { user, onSave } = renderEditor(
      goal({ schedule: 'weekdays', weekdays: [1, 3], scheduledDate: '2026-09-10' }),
    )
    await user.clear(titleField())
    await user.type(titleField(), '  Water the ferns  ')
    await user.selectOptions(repeat(), 'daily')
    await user.click(save())

    expect(onSave).toHaveBeenCalledTimes(1)
    // Only what the editor changes: a skip or snooze made meanwhile is the
    // goal's own business, and must survive the save.
    expect(onSave).toHaveBeenCalledWith({
      title: 'Water the ferns',
      schedule: 'daily',
      weekdays: [],
      scheduledDate: undefined,
    })
  })

  it('does not save a title that is only spaces', async () => {
    const { user, onSave } = renderEditor()
    await user.clear(titleField())
    await user.type(titleField(), '   ')
    await user.click(save())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('starts "Selected days" on the weekdays when the goal had none', async () => {
    const { user } = renderEditor()
    await user.selectOptions(repeat(), 'weekdays')

    const picker = screen.getByRole('group', { name: 'Days' })
    const checked = within(picker)
      .getAllByRole('checkbox')
      .filter((box) => (box as HTMLInputElement).checked)
      .map((box) => box.closest('label')?.textContent)
    expect(checked).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  })

  it('saves the chosen weekdays for "Selected days" and no planned date', async () => {
    const { user, onSave } = renderEditor(goal({ scheduledDate: '2026-09-10' }))
    await user.selectOptions(repeat(), 'weekdays')
    await user.click(day('Tue'))
    await user.click(day('Sun'))
    await user.click(save())

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ schedule: 'weekdays', weekdays: [0, 1, 3, 4, 5], scheduledDate: undefined }),
    )
  })

  it('keeps the days a "Selected days" goal already had', () => {
    renderEditor(goal({ schedule: 'weekdays', weekdays: [2, 6] }))
    expect(day('Tue')).toBeChecked()
    expect(day('Sat')).toBeChecked()
    expect(day('Mon')).not.toBeChecked()
  })

  it('saves the planned date for "Just once" and no weekdays', async () => {
    const { user, onSave } = renderEditor(goal({ schedule: 'weekdays', weekdays: [1, 2] }))
    await user.selectOptions(repeat(), 'once')
    fireEvent.change(plannedFor()!, { target: { value: '2026-09-12' } })
    await user.click(save())

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ schedule: 'once', weekdays: [], scheduledDate: '2026-09-12' }),
    )
  })

  it('saves "Just once" without a date when none is chosen', async () => {
    const { user, onSave } = renderEditor()
    await user.selectOptions(repeat(), 'once')
    await user.click(save())

    const saved = onSave.mock.calls[0][0]
    expect(saved.schedule).toBe('once')
    expect(saved.scheduledDate).toBeUndefined()
  })

  it('does not offer a planned date earlier than today', () => {
    renderEditor(goal({ schedule: 'once', scheduledDate: '2026-09-08' }))
    expect(plannedFor()).toHaveAttribute('min', TODAY)
    expect(plannedFor()).toHaveAttribute('max', '9999-12-31')
    expect(plannedFor()).toHaveValue('2026-09-08')
  })

  it('keeps a planned date already past, so an overdue goal can still be saved', async () => {
    // Planned for Tuesday, not done, still on Today on Saturday.
    const { user, onSave } = renderEditor(goal({ schedule: 'once', scheduledDate: '2026-09-01' }))
    expect(plannedFor()).toHaveAttribute('min', '2026-09-01')
    await user.type(titleField(), '!')
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Drink some water!', scheduledDate: '2026-09-01' }),
    )
  })

  it('will not plan a goal done today for a later day, which would retire it', async () => {
    const { user, onSave } = renderEditor(goal(), false, true)
    await user.selectOptions(repeat(), 'once')
    // Today itself is fine: done today, it simply retires tomorrow.
    expect(save()).toBeEnabled()
    fireEvent.change(plannedFor()!, { target: { value: '2026-09-12' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/already done today/)
    expect(save()).toBeDisabled()
    fireEvent.submit(save())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('refuses a date with more than four digits in its year', async () => {
    const { user, onSave } = renderEditor()
    await user.selectOptions(repeat(), 'once')
    fireEvent.change(plannedFor()!, { target: { value: '10000-01-01' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/four-digit year/)
    expect(save()).toBeDisabled()
    fireEvent.submit(save())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('keeps a date moved from the row while it was open, unless the gardener changed it', async () => {
    // Planned for the 5th; snoozed from its row to the 12th while the editor was open.
    const planned = goal({ schedule: 'once', scheduledDate: TODAY })
    const handlers = {
      onSave: vi.fn<(edit: GoalEdit) => void>(),
      onArchive: vi.fn(),
      onDelete: vi.fn(),
      onCancel: vi.fn(),
    }
    const props = { today: TODAY, completedBefore: false, completedToday: false, ...handlers }
    const { rerender } = render(<GoalEditor goal={planned} {...props} />)
    rerender(<GoalEditor goal={{ ...planned, scheduledDate: '2026-09-12', snoozedUntil: '2026-09-12' }} {...props} />)
    const user = userEvent.setup()
    await user.type(titleField(), '!')
    await user.click(save())
    expect(handlers.onSave).toHaveBeenLastCalledWith(expect.objectContaining({ scheduledDate: '2026-09-12' }))

    // A date the gardener picks still wins.
    fireEvent.change(plannedFor()!, { target: { value: '2026-09-20' } })
    await user.click(save())
    expect(handlers.onSave).toHaveBeenLastCalledWith(expect.objectContaining({ scheduledDate: '2026-09-20' }))
  })

  it('takes focus again when asked to', () => {
    const props = {
      goal: goal(),
      today: TODAY,
      completedBefore: false,
      completedToday: false,
      onSave: vi.fn(),
      onArchive: vi.fn(),
      onDelete: vi.fn(),
      onCancel: vi.fn(),
    }
    const { rerender } = render(<GoalEditor {...props} focusRequest={1} />)
    save().focus()
    rerender(<GoalEditor {...props} focusRequest={2} />)
    expect(titleField()).toHaveFocus()
  })

  it('puts itself away on Escape, and marks itself for Android’s back', () => {
    const { onCancel } = renderEditor()
    const form = titleField().closest('form')!
    expect(form).toHaveAttribute('data-dismiss-on-back')
    fireEvent.keyDown(titleField(), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('only shows the planned date for "Just once"', async () => {
    const { user } = renderEditor()
    expect(plannedFor()).toBeNull()
    await user.selectOptions(repeat(), 'once')
    expect(plannedFor()).toBeInTheDocument()
  })

  it('refuses "Selected days" with no day chosen until one is chosen again', async () => {
    const { user, onSave } = renderEditor(goal({ schedule: 'weekdays', weekdays: [1, 4] }))
    await user.click(day('Mon'))
    await user.click(day('Thu'))

    expect(screen.getByRole('alert')).toHaveTextContent(NO_DAYS_CHOSEN)
    expect(save()).toBeDisabled()
    await user.type(titleField(), '{Enter}')
    expect(onSave).not.toHaveBeenCalled()

    await user.click(day('Fri'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(save()).toBeEnabled()
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weekdays: [5] }))
  })

  it('will not turn a goal completed before into a one-time goal', async () => {
    const { user, onSave } = renderEditor(goal(), true)
    await user.selectOptions(repeat(), 'once')

    expect(screen.getByRole('alert')).toHaveTextContent(/completed before, so it keeps repeating/)
    expect(save()).toBeDisabled()
    expect(plannedFor()).toBeNull()
    await user.type(titleField(), '{Enter}')
    expect(onSave).not.toHaveBeenCalled()

    await user.selectOptions(repeat(), 'daily')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(save()).toBeEnabled()
  })

  it('still edits a one-time goal that was completed before', async () => {
    const { user, onSave } = renderEditor(
      goal({ schedule: 'once', scheduledDate: '2026-09-08' }),
      true,
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(save()).toBeEnabled()

    await user.clear(titleField())
    await user.type(titleField(), 'Book the appointment')
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Book the appointment',
        schedule: 'once',
        scheduledDate: '2026-09-08',
      }),
    )
  })

  it('archives, deletes and cancels through their own handlers', async () => {
    const { user, onSave, onArchive, onDelete, onCancel } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onArchive).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('WeekdayPicker', () => {
  function renderPicker(weekdays: number[]) {
    const onChange = vi.fn<(weekdays: number[]) => void>()
    render(<WeekdayPicker weekdays={weekdays} onChange={onChange} />)
    return { onChange, user: userEvent.setup() }
  }

  it('lists every day of the week, checking the chosen ones', () => {
    renderPicker([0, 6])
    const picker = screen.getByRole('group', { name: 'Days' })
    expect(within(picker).getAllByRole('checkbox')).toHaveLength(7)
    expect(day('Sun')).toBeChecked()
    expect(day('Sat')).toBeChecked()
    expect(day('Wed')).not.toBeChecked()
  })

  it('keeps the days in week order when one is added', async () => {
    const { user, onChange } = renderPicker([5, 1])
    await user.click(day('Wed'))
    expect(onChange).toHaveBeenCalledWith([1, 3, 5])
  })

  it('takes a checked day off again', async () => {
    const { user, onChange } = renderPicker([1, 3, 5])
    await user.click(day('Mon'))
    expect(onChange).toHaveBeenCalledWith([3, 5])
  })

  it('toggles a day on and off as the gardener clicks it', async () => {
    function Harness() {
      const [weekdays, setWeekdays] = useState<number[]>([])
      return <WeekdayPicker weekdays={weekdays} onChange={setWeekdays} />
    }
    render(<Harness />)
    const user = userEvent.setup()

    await user.click(day('Thu'))
    expect(day('Thu')).toBeChecked()
    await user.click(day('Thu'))
    expect(day('Thu')).not.toBeChecked()
  })
})
