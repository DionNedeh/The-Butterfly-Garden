import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatJournalDate } from '../../lib/date'
import { resetDrafts } from '../../lib/drafts'
import { addEarlierMood, addEarlierReflection } from '../../lib/gardenActions'
import { createInitialState } from '../../lib/progression'
import type { AppState, MoodEntry } from '../../types'
import { JournalView } from '../JournalView'
import { EarlierEntry } from './EarlierEntry'

/** Only the clock is fixed: timers stay real, so typing and drafts behave as they do. */
const NOW = new Date(2026, 9, 27, 10)
const PLANTED = new Date(2026, 9, 1, 9)

function garden(entries: Partial<AppState> = {}, planted = PLANTED): AppState {
  return { ...createInitialState('Tester', 'Test Garden', planted), ...entries }
}

function mood(localDate: string, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note: 'On the day',
    createdAt: `${localDate}T14:00:00.000Z`,
    updatedAt: `${localDate}T14:00:00.000Z`,
    ...overrides,
  }
}

function renderJournal(state: AppState, offer = true) {
  const handlers = {
    onAddEarlierMood: vi.fn(),
    onAddEarlierReflection: vi.fn(),
  }
  const view = (current: AppState) => (
    <JournalView
      state={current}
      onUpdateMood={vi.fn()}
      onDeleteMood={vi.fn()}
      onUpdateReflection={vi.fn()}
      onDeleteReflection={vi.fn()}
      onUpdateRecap={vi.fn()}
      onDeleteRecap={vi.fn()}
      {...(offer ? handlers : {})}
    />
  )
  const utils = render(view(state))
  return { ...utils, ...handlers, rerenderWith: (next: AppState) => utils.rerender(view(next)) }
}

const opener = () => screen.queryByRole('button', { name: 'Add an entry for an earlier day' })
const form = () => screen.getByRole('form', { name: 'Add an entry for an earlier day' })
const dayField = () => screen.getByLabelText('Which day?')
const save = () => screen.getByRole('button', { name: 'Save entry' })
const chooseDay = (localDate: string) => fireEvent.change(dayField(), { target: { value: localDate } })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
  resetDrafts()
})

describe('adding an entry for an earlier day', () => {
  it('opens on the day question, offering the garden’s first day to yesterday', async () => {
    const user = userEvent.setup()
    renderJournal(garden())
    await user.click(opener()!)
    expect(dayField()).toHaveFocus()
    expect(dayField()).toHaveAttribute('min', '2026-10-01')
    expect(dayField()).toHaveAttribute('max', '2026-10-26')
    expect(within(form()).getByText(/marked as written later/)).toBeInTheDocument()
    expect(save()).toBeDisabled()
    expect(save()).toHaveAccessibleDescription('Choose a day first.')
  })

  it('is not offered for a garden planted today, nor without somewhere to save it', () => {
    const { unmount } = renderJournal(garden({}, new Date(2026, 9, 27, 8)))
    expect(opener()).toBeNull()
    unmount()
    renderJournal(garden(), false)
    expect(opener()).toBeNull()
  })

  it('writes a check-in for the day, then opens that day once it is kept', async () => {
    const user = userEvent.setup()
    const state = garden()
    const { onAddEarlierMood, rerenderWith } = renderJournal(state)
    await user.click(opener()!)
    chooseDay('2026-10-20')
    expect(save()).toHaveAccessibleDescription(/Choose a weather, or Not sure/)
    await user.selectOptions(screen.getByLabelText('Inner weather that day'), 'Rainy')
    await user.type(screen.getByLabelText('A note about that day, if you want'), 'Stayed in')
    await user.click(save())
    expect(onAddEarlierMood).toHaveBeenCalledWith('2026-10-20', 2, 'Stayed in')
    expect(opener()).toBeInTheDocument()

    // The garden takes the entry; the journal shows the day and focuses it.
    rerenderWith(addEarlierMood(state, '2026-10-20', 2, 'Stayed in', NOW))
    const entry = document.getElementById('day-2026-10-20')!
    expect(within(entry).getByText(formatJournalDate('2026-10-20'))).toHaveFocus()
    expect(within(entry).getByText('Written later')).toBeInTheDocument()
  })

  it('takes "Not sure" as an answer like any other', async () => {
    const user = userEvent.setup()
    const { onAddEarlierMood } = renderJournal(garden())
    await user.click(opener()!)
    chooseDay('2026-10-02')
    await user.selectOptions(screen.getByLabelText('Inner weather that day'), 'Not sure')
    await user.click(save())
    expect(onAddEarlierMood).toHaveBeenCalledWith('2026-10-02', 'unsure', '')
    // Until the garden holds the entry, focus waits on the form's button.
    expect(opener()).toHaveFocus()
  })

  it('writes a reflection for the day', async () => {
    const user = userEvent.setup()
    const { onAddEarlierReflection } = renderJournal(garden())
    await user.click(opener()!)
    chooseDay('2026-10-12')
    await user.click(screen.getByRole('radio', { name: 'A reflection' }))
    expect(save()).toHaveAccessibleDescription('A few words are plenty.')
    await user.type(screen.getByLabelText('What would you like to remember about that day?'), 'The first frost')
    await user.click(save())
    expect(onAddEarlierReflection).toHaveBeenCalledWith('2026-10-12', 'The first frost')
  })

  it('keeps unsaved words of the other kind, with their day, after saving one', async () => {
    const user = userEvent.setup()
    const { onAddEarlierMood, onAddEarlierReflection } = renderJournal(garden())
    await user.click(opener()!)
    chooseDay('2026-10-12')
    await user.click(screen.getByRole('radio', { name: 'A reflection' }))
    await user.type(screen.getByLabelText('What would you like to remember about that day?'), 'Later words')
    await user.click(screen.getByRole('radio', { name: 'A check-in' }))
    await user.selectOptions(screen.getByLabelText('Inner weather that day'), 'Bright')
    await user.click(save())
    expect(onAddEarlierMood).toHaveBeenCalledWith('2026-10-12', 4, '')

    // Said, and focus goes to the words still waiting rather than to the page.
    expect(within(form()).getByRole('status')).toHaveTextContent(
      `Your check-in is kept with ${formatJournalDate('2026-10-12')}.`,
    )
    expect(screen.getByLabelText('What would you like to remember about that day?')).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'A reflection' })).toBeChecked()
    expect(dayField()).toHaveValue('2026-10-12')
    await user.click(save())
    expect(onAddEarlierReflection).toHaveBeenCalledWith('2026-10-12', 'Later words')
    expect(opener()).toBeInTheDocument()
  })

  it('turns to the weather question after a reflection, while a note is waiting', async () => {
    const user = userEvent.setup()
    const { onAddEarlierReflection } = renderJournal(garden())
    await user.click(opener()!)
    chooseDay('2026-10-12')
    await user.type(screen.getByLabelText('A note about that day, if you want'), 'A quiet one')
    await user.click(screen.getByRole('radio', { name: 'A reflection' }))
    await user.type(screen.getByLabelText('What would you like to remember about that day?'), 'Words')
    await user.click(save())
    expect(onAddEarlierReflection).toHaveBeenCalledWith('2026-10-12', 'Words')
    // Save is disabled until a weather is chosen, so it cannot keep focus.
    expect(screen.getByLabelText('Inner weather that day')).toHaveFocus()
    expect(screen.getByLabelText('A note about that day, if you want')).toHaveValue('A quiet one')
  })

  it('keeps the words when the device’s clock has gone back past the page’s day', async () => {
    const user = userEvent.setup()
    const onAddReflection = vi.fn()
    // The page last noticed the 28th; the clock now reads the 27th (a time
    // zone crossed westward), so the 27th is not yet past for the reducer.
    render(
      <EarlierEntry
        state={garden()}
        today="2026-10-28"
        onAddMood={vi.fn()}
        onAddReflection={onAddReflection}
        onOpenDay={vi.fn()}
      />,
    )
    await user.click(opener()!)
    chooseDay('2026-10-27')
    await user.click(screen.getByRole('radio', { name: 'A reflection' }))
    await user.type(screen.getByLabelText('What would you like to remember about that day?'), 'Kept')
    await user.click(save())
    expect(onAddReflection).not.toHaveBeenCalled()
    expect(screen.getByText('Today has a page of its own. Choose a day before today.')).toBeInTheDocument()
    expect(screen.getByLabelText('What would you like to remember about that day?')).toHaveValue('Kept')
    expect(save()).toBeDisabled()
    // Another day is a fresh question.
    chooseDay('2026-10-26')
    expect(save()).toBeEnabled()
  })

  it('says so when the day already has a check-in, and offers to open it instead', async () => {
    const user = userEvent.setup()
    renderJournal(garden({ moods: [mood('2026-10-15')] }))
    await user.click(opener()!)
    chooseDay('2026-10-15')
    const said = `${formatJournalDate('2026-10-15')} already has a check-in. The journal keeps one each day.`
    expect(screen.getByText(said)).toBeInTheDocument()
    expect(dayField()).toHaveAccessibleDescription(said)
    expect(save()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Open that day' }))
    const entry = document.getElementById('day-2026-10-15')!
    expect(within(entry).getByText(formatJournalDate('2026-10-15'))).toHaveFocus()

    // A reflection for the same day is still welcome.
    await user.click(screen.getByRole('radio', { name: 'A reflection' }))
    expect(screen.queryByText(said)).toBeNull()
  })

  it('explains a day before the garden, or one not yet past, typed past the field’s limits', async () => {
    const user = userEvent.setup()
    renderJournal(garden())
    await user.click(opener()!)
    chooseDay('2026-09-30')
    expect(
      screen.getByText(`Your garden began on ${formatJournalDate('2026-10-01')}. Choose that day or a later one.`),
    ).toBeInTheDocument()
    expect(save()).toBeDisabled()
    chooseDay('2026-10-27')
    expect(screen.getByText('Today has a page of its own. Choose a day before today.')).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it('cancels back to its button, forgetting what was typed', async () => {
    const user = userEvent.setup()
    renderJournal(garden())
    await user.click(opener()!)
    chooseDay('2026-10-12')
    await user.type(screen.getByLabelText('A note about that day, if you want'), 'Never mind')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(opener()).toHaveFocus()
    await user.click(opener()!)
    expect(dayField()).toHaveValue('')
    expect(screen.getByLabelText('A note about that day, if you want')).toHaveValue('')
  })

  it('keeps a half-written reflection and its day through leaving the Journal', async () => {
    const user = userEvent.setup()
    const { unmount } = renderJournal(garden())
    await user.click(opener()!)
    chooseDay('2026-10-12')
    await user.click(screen.getByRole('radio', { name: 'A reflection' }))
    await user.type(screen.getByLabelText('What would you like to remember about that day?'), 'Half')
    unmount()

    renderJournal(garden())
    expect(opener()).toBeNull()
    expect(dayField()).toHaveValue('2026-10-12')
    expect(screen.getByRole('radio', { name: 'A reflection' })).toBeChecked()
    expect(screen.getByLabelText('What would you like to remember about that day?')).toHaveValue('Half')
  })
})

describe('an entry written later, in the journal', () => {
  it('is marked as written later wherever it is shown, and only it', () => {
    const state = addEarlierReflection(
      addEarlierMood(garden({ moods: [mood('2026-10-19')] }), '2026-10-20', 5, 'Caught up', NOW),
      '2026-10-20',
      'Remembered',
      NOW,
    )
    renderJournal(state)
    const later = document.getElementById('day-2026-10-20')!
    expect(within(later).getAllByText('Written later')).toHaveLength(2)
    expect(within(document.getElementById('day-2026-10-19')!).queryByText('Written later')).toBeNull()
    // The calendar colours the day by it, and its name says so.
    expect(
      screen.getByRole('button', { name: /October 20: Radiant, written later$/ }),
    ).toBeInTheDocument()
  })

  it('is still marked when a search finds it', async () => {
    const user = userEvent.setup()
    const state = addEarlierMood(garden({ moods: [mood('2026-10-19')] }), '2026-10-20', 5, 'Caught up', NOW)
    renderJournal(state)
    await user.type(screen.getByRole('searchbox', { name: 'Search your journal' }), 'caught')
    await screen.findByText('1 day matches')
    const found = document.getElementById('day-2026-10-20')!
    expect(within(found).getByText('Written later')).toBeInTheDocument()
    expect(document.getElementById('day-2026-10-19')).toBeNull()
  })
})
