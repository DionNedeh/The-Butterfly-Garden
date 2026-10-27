import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatDayInWords } from '../lib/fieldNotes'
import { createInitialState } from '../lib/progression'
import type { AppState, Sighting } from '../types'
import { JournalView } from './JournalView'

/** A lazily loaded form or page may take a while on a loaded machine. */
const LAZY = { timeout: 8000 }

const sightings: Sighting[] = [
  { id: 'a', date: '2026-09-02', kind: 'butterfly', speciesId: 'monarch', createdAt: '2026-09-02T09:00:00.000Z' },
  { id: 'b', date: '2026-10-03', kind: 'butterfly', speciesId: 'monarch', createdAt: '2026-10-03T09:00:00.000Z' },
  { id: 'c', date: '2026-10-05', kind: 'butterfly', speciesId: 'red-admiral', createdAt: '2026-10-05T09:00:00.000Z' },
]

function renderJournal(state: Partial<AppState> = {}, withFieldBook = true) {
  const garden = { ...createInitialState('Tester', 'Wild Garden'), sightings, ...state }
  render(
    <JournalView
      state={garden}
      onUpdateMood={vi.fn()}
      onDeleteMood={vi.fn()}
      onUpdateReflection={vi.fn()}
      onDeleteReflection={vi.fn()}
      onUpdateRecap={vi.fn()}
      onDeleteRecap={vi.fn()}
      onChangeSightings={withFieldBook ? vi.fn(() => true) : undefined}
    />,
  )
  return userEvent.setup()
}

function card(name: string) {
  return screen.getByText(name, { selector: '.species-card strong' }).closest('article')!
}

describe('the field notes and the wild', () => {
  it('says when a species was last seen in the wild, and how often, with a pressed flower', async () => {
    const user = renderJournal({
      creatures: [
        {
          ...createInitialState('Tester', 'Wild Garden').creatures[0],
          stage: 'butterfly',
          discoveredAt: '2026-08-01T12:00:00.000Z',
        },
      ],
    })
    await user.click(screen.getByText('Butterflies welcomed'))
    const monarch = within(card('Monarch'))
    expect(monarch.getByText(`Welcomed in your garden on ${formatDayInWords('2026-08-01')}`)).toBeInTheDocument()
    expect(monarch.getByText(`Seen in the wild on ${formatDayInWords('2026-10-03')} (2 times)`)).toBeInTheDocument()
    expect(card('Monarch').querySelector('svg.pressed-flower')).toHaveAttribute('aria-hidden', 'true')
  })

  it('stamps a species seen in the wild but not yet welcomed, and no other', async () => {
    const user = renderJournal()
    await user.click(screen.getByText('Butterflies welcomed'))
    const admiral = card('Red Admiral')
    expect(admiral).toHaveClass('undiscovered')
    expect(within(admiral).getByText('Not yet welcomed')).toBeInTheDocument()
    expect(within(admiral).getByText(`Seen in the wild on ${formatDayInWords('2026-10-05')}`)).toBeInTheDocument()
    expect(card('Queen').querySelector('.pressed-flower')).toBeNull()
  })

  it('opens the field book with the field notes, once there is a way to change it', async () => {
    const user = renderJournal()
    expect(screen.queryByRole('heading', { name: 'Seen in the wild' })).toBeNull()
    await user.click(screen.getByText('Butterflies welcomed'))
    expect(await screen.findByRole('heading', { name: 'Seen in the wild' }, LAZY)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log a sighting' })).toBeInTheDocument()
  })

  it('offers no field book where nothing can be written', async () => {
    const user = renderJournal({}, false)
    await user.click(screen.getByText('Butterflies welcomed'))
    expect(screen.queryByRole('heading', { name: 'Seen in the wild' })).toBeNull()
  })
})
