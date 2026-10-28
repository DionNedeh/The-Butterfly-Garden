import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDrafts } from '../../lib/drafts'
import { createInitialState } from '../../lib/progression'
import type { AppState, MoodEntry, ReflectionEntry } from '../../types'
import { JournalView } from '../JournalView'

/** A Tuesday: the letter for the week of 19 to 25 October has arrived. */
const NOW = new Date(2026, 9, 27, 10)

function mood(localDate: string, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note: '',
    createdAt: `${localDate}T14:00:00.000Z`,
    updatedAt: `${localDate}T14:00:00.000Z`,
    ...overrides,
  }
}

function reflection(localDate: string, overrides: Partial<ReflectionEntry> = {}): ReflectionEntry {
  return {
    id: `reflection-${localDate}`,
    localDate,
    promptId: 'notice',
    body: 'A slow walk home',
    createdAt: `${localDate}T21:00:00.000Z`,
    updatedAt: `${localDate}T21:00:00.000Z`,
    ...overrides,
  }
}

/** A garden planted in September, unless told otherwise. */
function garden(entries: Partial<AppState> = {}, planted = new Date(2026, 8, 1, 9)): AppState {
  return { ...createInitialState('Robin', 'Test Garden', planted), ...entries }
}

function renderJournal(
  state: AppState,
  props: { openLetter?: boolean; letters?: boolean; stars?: boolean } = {},
) {
  const onReadLetter = vi.fn()
  const onSetStarred = vi.fn()
  render(
    <JournalView
      state={state}
      onUpdateMood={vi.fn()}
      onDeleteMood={vi.fn()}
      onUpdateReflection={vi.fn()}
      onDeleteReflection={vi.fn()}
      onUpdateRecap={vi.fn()}
      onDeleteRecap={vi.fn()}
      openLetter={props.openLetter}
      onReadLetter={props.letters === false ? undefined : onReadLetter}
      onSetStarred={props.stars === false ? undefined : onSetStarred}
    />,
  )
  return { onReadLetter, onSetStarred }
}

const letters = () => screen.queryByRole('region', { name: 'Letters from Marigold' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
  resetDrafts()
})

describe('letters in the Journal', () => {
  it('waits folded at the top, and the letter opened is a letter read', async () => {
    const user = userEvent.setup()
    const { onReadLetter } = renderJournal(
      garden({ moods: [mood('2026-10-21'), mood('2026-10-22')] }),
    )
    const section = letters()!
    expect(within(section).getByText('A new letter is waiting')).toBeInTheDocument()
    expect(within(section).queryByRole('heading')).toBeNull()
    expect(onReadLetter).not.toHaveBeenCalled()

    await user.click(within(section).getByText('Letters from Marigold'))
    const letter = within(section).getByRole('article', { name: /^The week of October 19/ })
    expect(within(letter).getByText('Dear Robin,')).toBeInTheDocument()
    expect(within(letter).getByText('This week you checked in twice.')).toBeInTheDocument()
    expect(within(letter).getByText('Marigold', { exact: false })).toBeInTheDocument()
    expect(onReadLetter).toHaveBeenCalledWith('2026-10-25')
  })

  it('opens on the newest letter, with focus on it, when the garden’s card sent the gardener', () => {
    const { onReadLetter } = renderJournal(garden(), { openLetter: true })
    const heading = screen.getByRole('heading', { name: /^The week of October 19/ })
    expect(heading).toHaveFocus()
    expect(screen.getByText('A quiet week. The garden kept your place.')).toBeInTheDocument()
    expect(onReadLetter).toHaveBeenCalledWith('2026-10-25')
  })

  it('keeps the last few weeks to read again, each its own week, once the newest is read', async () => {
    const user = userEvent.setup()
    const state = garden({
      moods: [mood('2026-10-14', { note: 'Rain all week' })],
      profile: { ...garden().profile!, lastLetterRead: '2026-10-25' },
    })
    const { onReadLetter } = renderJournal(state, { openLetter: true })
    expect(within(letters()!).getByText('A letter each Sunday evening')).toBeInTheDocument()
    const weeks = screen.getByRole('group', { name: 'Letters by week' })
    const buttons = within(weeks).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^October 19\s–\s25$/),
      expect.stringMatching(/^October 12\s–\s18$/),
      expect.stringMatching(/^October 5\s–\s11$/),
      expect.stringMatching(/^September 28\s–\sOctober 4$/),
    ])
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')

    await user.click(buttons[1])
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[1]).toHaveFocus()
    expect(screen.getByRole('heading', { name: /^The week of October 12/ })).toBeInTheDocument()
    expect(screen.getByText('This week you checked in once.')).toBeInTheDocument()
    // Reading an older letter again is passed on; the garden keeps the newest.
    expect(onReadLetter).toHaveBeenLastCalledWith('2026-10-18')
  })

  it('quotes a starred line, and says so when quoting is turned off', () => {
    const starred = garden({
      moods: [mood('2026-10-21', { note: 'The light on the river after work', starred: true })],
    })
    renderJournal(starred, { openLetter: true })
    const letter = screen.getByRole('article', { name: /^The week of October 19/ })
    expect(within(letter).getByText('You wrote, on Wednesday:')).toBeInTheDocument()
    expect(within(letter).getByText('The light on the river after work')).toBeInTheDocument()
    expect(
      screen.getByText('A letter quotes your words only where you star a line in your journal.'),
    ).toBeInTheDocument()
  })

  it('quotes nothing at all when the gardener chose never', () => {
    const state = garden({
      moods: [mood('2026-10-21', { note: 'The light on the river after work', starred: true })],
    })
    renderJournal(
      { ...state, profile: { ...state.profile!, letterQuotes: 'never' } },
      { openLetter: true },
    )
    const letter = screen.getByRole('article', { name: /^The week of October 19/ })
    expect(within(letter).queryByText(/You wrote/)).toBeNull()
    expect(within(letter).queryByText('The light on the river after work')).toBeNull()
    expect(
      screen.getByText('Letters never quote your words, as you chose in Settings.'),
    ).toBeInTheDocument()
  })

  it('has nothing to show before the garden’s first Sunday, or where the app offers none', () => {
    renderJournal(garden({}, new Date(2026, 9, 25, 9)))
    expect(letters()).toBeNull()
    renderJournal(garden(), { letters: false })
    expect(letters()).toBeNull()
  })
})

describe('starring a line', () => {
  it('stars a check-in’s note and a reflection, each with one button that keeps its name', async () => {
    const user = userEvent.setup()
    const state = garden({
      moods: [mood('2026-10-21', { note: 'Rain on the roof', starred: true })],
      reflections: [reflection('2026-10-22')],
    })
    const { onSetStarred } = renderJournal(state)
    const checkIn = document.getElementById('day-2026-10-21')!
    const star = within(checkIn).getByRole('button', { name: 'Star this line' })
    expect(star).toHaveAttribute('aria-pressed', 'true')
    await user.click(star)
    expect(onSetStarred).toHaveBeenLastCalledWith('check-in', 'mood-2026-10-21', false)
    expect(star).toHaveFocus()

    const day = document.getElementById('day-2026-10-22')!
    const reflectionStar = within(day).getByRole('button', { name: 'Star this line' })
    expect(reflectionStar).toHaveAttribute('aria-pressed', 'false')
    await user.click(reflectionStar)
    expect(onSetStarred).toHaveBeenLastCalledWith('reflection', 'reflection-2026-10-22', true)
  })

  it('offers no star for a check-in without words, or where the app offers none', () => {
    renderJournal(garden({ moods: [mood('2026-10-21')] }))
    expect(screen.queryByRole('button', { name: 'Star this line' })).toBeNull()
    renderJournal(garden({ reflections: [reflection('2026-10-22')] }), { stars: false })
    expect(screen.queryByRole('button', { name: 'Star this line' })).toBeNull()
  })
})
