import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDayInWords } from '../../lib/fieldNotes'
import { createInitialState } from '../../lib/progression'
import type { ChangeSightings } from '../../lib/sightings'
import type { AppState, RegionId, Sighting } from '../../types'
import FieldBook from './FieldBook'

/** A lazily loaded form or page may take a while on a loaded machine. */
const LAZY = { timeout: 8000 }

const TODAY = '2026-10-27'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-27T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

function sighting(id: string, extra: Partial<Sighting> = {}): Sighting {
  return {
    id,
    date: '2026-10-20',
    kind: 'butterfly',
    speciesId: 'monarch',
    createdAt: '2026-10-20T09:00:00.000Z',
    ...extra,
  } as Sighting
}

/** The field book in a garden of its own, changed the way useGardenState changes it. */
function Harness({ sightings, region }: { sightings: Sighting[]; region?: RegionId }) {
  const start = createInitialState('Tester', 'Wild Garden')
  const initial: AppState = { ...start, profile: { ...start.profile!, region }, sightings }
  const garden = useRef(initial)
  const [state, setState] = useState(initial)
  const change = useCallback<ChangeSightings>((recipe) => {
    const current = garden.current
    const next = recipe(current.sightings, new Date())
    if (next === current.sightings) return false
    garden.current = { ...current, sightings: next }
    setState(garden.current)
    return true
  }, [])
  return <FieldBook state={state} today={TODAY} onChangeSightings={change} />
}

function renderBook(sightings: Sighting[] = [], region?: RegionId) {
  render(<Harness sightings={sightings} region={region} />)
  return userEvent.setup()
}

describe('the field book', () => {
  it('starts empty, earning nothing, with ways to share that leave the app', () => {
    renderBook([], 'europe')
    expect(screen.getByRole('heading', { name: 'Seen in the wild' })).toBeInTheDocument()
    expect(screen.getByText(/They earn nothing here/)).toBeInTheDocument()
    expect(screen.getByText(/Nothing written down yet/)).toBeInTheDocument()
    expect(screen.getByText('What to look for in October')).toBeInTheDocument()
    const count = screen.getByRole('link', { name: 'Big Butterfly Count (opens in your browser)' })
    expect(count).toHaveAttribute('href', 'https://bigbutterflycount.butterfly-conservation.org/')
    expect(count).toHaveAttribute('target', '_blank')
    expect(count).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'iNaturalist (opens in your browser)' })).toBeInTheDocument()
    expect(screen.getByText(/leave the garden and open in your browser/)).toBeInTheDocument()
  })

  it('offers iNaturalist alone, and no month line, without a region', () => {
    renderBook()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByText(/What to look for/)).toBeNull()
  })

  it('logs a sighting, then gives it focus', async () => {
    const user = renderBook()
    await user.click(screen.getByRole('button', { name: 'Log a sighting' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log a sighting' }, LAZY)
    await user.click(within(dialog).getByRole('radio', { name: 'Monarch' }))
    await user.type(within(dialog).getByLabelText('A few words, if you like'), 'Over the allotments')
    await user.click(within(dialog).getByRole('button', { name: 'Save sighting' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const entry = screen.getByRole('heading', { name: 'Monarch' })
    await waitFor(() => expect(entry).toHaveFocus())
    expect(screen.getByText('Over the allotments')).toBeInTheDocument()
    expect(screen.getByText('Saved to your field book.')).toBeInTheDocument()
  })

  it('hands focus back to the button that opened the form when nothing is kept', async () => {
    const user = renderBook()
    const log = screen.getByRole('button', { name: 'Log a sighting' })
    await user.click(log)
    await user.click(within(await screen.findByRole('dialog', {}, LAZY)).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(log).toHaveFocus()
  })

  it('changes a sighting, and gives it focus', async () => {
    const user = renderBook([sighting('a', { note: 'One' })])
    const day = formatDayInWords('2026-10-20')
    await user.click(screen.getByRole('button', { name: `Edit Monarch, ${day}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Change this sighting' }, LAZY)
    const note = within(dialog).getByLabelText('A few words, if you like')
    await user.clear(note)
    await user.type(note, 'Two')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Monarch' })).toHaveFocus())
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.getByText('Your changes are saved.')).toBeInTheDocument()
  })

  it('crosses one out with focus on the book, and Undo puts it back with focus on it', async () => {
    const user = renderBook([sighting('a'), sighting('b', { kind: 'plant', plantId: 'violet', speciesId: undefined } as Partial<Sighting>)])
    const day = formatDayInWords('2026-10-20')
    await user.click(screen.getByRole('button', { name: `Delete Violet, ${day}` }))
    expect(screen.queryByRole('heading', { name: 'Violet' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Seen in the wild' })).toHaveFocus()
    expect(screen.getByText(`Violet, ${day}, deleted.`)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Violet' })).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('shows the newest ten first, and the next page with focus on its first', async () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      sighting(`s-${index}`, { date: `2026-10-${String(index + 1).padStart(2, '0')}`, note: `Note ${index}` }),
    )
    const user = renderBook(many)
    expect(screen.getAllByRole('listitem').filter((item) => item.className === 'field-book-entry')).toHaveLength(10)
    expect(screen.getByText('Note 11')).toBeInTheDocument()
    expect(screen.queryByText('Note 1')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show earlier sightings (2 more)' }))
    await waitFor(() => expect(document.getElementById('sighting-s-1')).toHaveFocus())
    expect(screen.getByText('Note 0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show earlier sightings/ })).toBeNull()
  })

  it('shows a sighting’s photo, named for what it shows', () => {
    renderBook([sighting('a', { photo: new Blob([new Uint8Array([1])], { type: 'image/webp' }) })])
    expect(screen.getByRole('img', { name: 'Your photo of Monarch' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
  })
})
