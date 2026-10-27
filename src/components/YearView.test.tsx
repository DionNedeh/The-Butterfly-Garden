import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState, MoodEntry, ReflectionEntry } from '../types'
import { YearView } from './YearView'

const TODAY = '2026-10-27'

function mood(localDate: string, extra: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note: '',
    createdAt: `${localDate}T16:00:00.000Z`,
    updatedAt: `${localDate}T16:00:00.000Z`,
    ...extra,
  }
}

function reflection(localDate: string, extra: Partial<ReflectionEntry> = {}): ReflectionEntry {
  return {
    id: `reflection-${localDate}`,
    localDate,
    promptId: 'notice',
    body: 'Something noticed',
    createdAt: `${localDate}T21:00:00.000Z`,
    updatedAt: `${localDate}T21:00:00.000Z`,
    ...extra,
  }
}

/** A garden begun in 2025, written in through two years. */
function garden(extra: Partial<AppState> = {}): AppState {
  const base = createInitialState('Robin', 'Quiet Corner', new Date(2025, 2, 1, 9))
  return {
    ...base,
    moods: [
      mood('2025-06-01', { note: 'Last year’s starred line', starred: true }),
      mood('2026-04-05', { note: 'The light on the river after work', starred: true }),
      mood('2026-04-06', { note: 'A line kept to myself' }),
    ],
    reflections: [reflection('2026-05-06', { body: 'Tea with Ana', starred: true })],
    sunlight: [
      { id: 's1', localDate: '2026-04-05', source: 'mood', awardedAt: '2026-04-05T16:00:00.000Z' },
      { id: 's2', localDate: '2026-04-06', source: 'mood', awardedAt: '2026-04-06T16:00:00.000Z' },
    ],
    ...extra,
  }
}

function renderYear(state = garden(), year?: number) {
  const onChooseYear = vi.fn()
  const onBack = vi.fn()
  const view = render(
    <YearView state={state} today={TODAY} year={year} onChooseYear={onChooseYear} onBack={onBack} />,
  )
  return { ...view, onChooseYear, onBack }
}

describe('your garden’s year', () => {
  it('opens on this year at its heading, and says what the year held', () => {
    renderYear()
    const heading = screen.getByRole('heading', { level: 1, name: 'Your garden’s 2026' })
    expect(heading).toHaveFocus()
    const journal = screen.getByRole('region', { name: 'What you wrote' })
    expect(journal).toHaveTextContent(
      'In 2026 you checked in on two days and wrote a reflection.',
    )
    expect(journal).toHaveTextContent('Days you cared for yourself: 2.')
    expect(screen.getByRole('region', { name: 'The year’s weather' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Who arrived' })).toHaveTextContent(
      'No new arrivals this year. Marigold kept the garden company.',
    )
  })

  it('quotes only lines the gardener starred, from that year', () => {
    renderYear()
    const lines = screen.getByRole('region', { name: 'Lines you starred' })
    expect(within(lines).getAllByRole('blockquote').map((quote) => quote.textContent)).toEqual([
      'The light on the river after work',
      'Tea with Ana',
    ])
    expect(lines).not.toHaveTextContent('A line kept to myself')
    expect(lines).not.toHaveTextContent('Last year’s starred line')
  })

  it('quotes nothing when Settings says never, and says why', () => {
    const base = garden()
    renderYear({ ...base, profile: { ...base.profile!, letterQuotes: 'never' } })
    const lines = screen.getByRole('region', { name: 'Lines you starred' })
    expect(within(lines).queryAllByRole('blockquote')).toHaveLength(0)
    expect(lines).toHaveTextContent('Your words are never quoted, as you chose in Settings.')
  })

  it('keeps day counts out when Settings hides them, as the letters do', () => {
    const base = garden()
    renderYear({ ...base, profile: { ...base.profile!, hideDayCounts: true } })
    const journal = screen.getByRole('region', { name: 'What you wrote' })
    expect(journal).toHaveTextContent('In 2026 you checked in and wrote a reflection.')
    expect(journal).toHaveTextContent('Day counts are hidden, as you chose.')
    expect(journal).not.toHaveTextContent(/\b2\b/)
  })

  it('offers earlier years with entries, and asks for the one chosen', async () => {
    const { onChooseYear } = renderYear()
    const years = screen.getByRole('group', { name: 'Years' })
    const buttons = within(years).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['2026', '2025'])
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    await userEvent.setup().click(buttons[1])
    expect(onChooseYear).toHaveBeenCalledWith(2025)
    await userEvent.setup().click(buttons[0])
    expect(onChooseYear).toHaveBeenCalledTimes(1)
  })

  it('shows an earlier year as asked, and this year for one it has nothing for', () => {
    const { unmount } = renderYear(garden(), 2025)
    expect(screen.getByRole('heading', { level: 1, name: 'Your garden’s 2025' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Lines you starred' })).toHaveTextContent(
      'Last year’s starred line',
    )
    unmount()
    renderYear(garden(), 1999)
    expect(screen.getByRole('heading', { level: 1, name: 'Your garden’s 2026' })).toBeInTheDocument()
  })

  it('gives a quiet year a kind, true page, with no empty calendar', () => {
    renderYear(createInitialState('Robin', 'Quiet Corner', new Date(2026, 9, 1, 9)))
    expect(screen.queryByRole('group', { name: 'Years' })).toBeNull()
    expect(screen.getByRole('region', { name: 'What you wrote' })).toHaveTextContent(
      'A quiet year in the journal. Nothing was asked of it, and the garden kept your place.',
    )
    expect(screen.queryByRole('region', { name: 'The year’s weather' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Lines you starred' })).toHaveTextContent(
      'A line you star in your journal can be kept here.',
    )
  })

  it('goes back by its button, or by Escape unless a dialog takes it', async () => {
    const { onBack } = renderYear()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to the Journal' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledTimes(2)
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledTimes(2)
    dialog.remove()
  })

  it('ends in a postcard that is not made until asked', () => {
    renderYear()
    const postcard = screen.getByRole('region', { name: 'A postcard of your garden' })
    expect(within(postcard).getByRole('button', { name: 'Make a postcard' })).toBeInTheDocument()
    expect(within(postcard).queryByRole('img')).toBeNull()
  })
})
