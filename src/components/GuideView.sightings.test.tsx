import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { formatDayInWords } from '../lib/fieldNotes'
import { toLocalDate } from '../lib/date'
import { createInitialState } from '../lib/progression'
import type { ChangeSightings } from '../lib/sightings'
import type { AppState, RegionId, Sighting } from '../types'
import { GuideView } from './GuideView'

/** A lazily loaded form or page may take a while on a loaded machine. */
const LAZY = { timeout: 8000 }

function Harness({ sightings, region }: { sightings: Sighting[]; region?: RegionId }) {
  const start = createInitialState('Tester', 'Wild Garden')
  const initial: AppState = { ...start, profile: { ...start.profile!, region }, sightings }
  const garden = useRef(initial)
  const [state, setState] = useState(initial)
  const change = useCallback<ChangeSightings>((recipe) => {
    const next = recipe(garden.current.sightings, new Date())
    if (next === garden.current.sightings) return false
    garden.current = { ...garden.current, sightings: next }
    setState(garden.current)
    return true
  }, [])
  return <GuideView state={state} onShowSeed={vi.fn()} onChangeSightings={change} />
}

function speciesCard(name: string) {
  return screen.getByRole('heading', { level: 3, name }).closest('article')!
}

describe('logging a sighting from the Guide', () => {
  it('stamps a butterfly and a host plant seen in the wild', () => {
    render(
      <Harness
        sightings={[
          { id: 'a', date: '2026-10-03', kind: 'butterfly', speciesId: 'monarch', createdAt: '' },
          { id: 'b', date: '2026-09-12', kind: 'plant', plantId: 'milkweed', createdAt: '' },
        ]}
      />,
    )
    const monarch = within(speciesCard('Monarch'))
    expect(monarch.getByText(`Seen in the wild on ${formatDayInWords('2026-10-03')}`)).toBeInTheDocument()
    expect(monarch.getByText(`seen in the wild on ${formatDayInWords('2026-09-12')}`)).toBeInTheDocument()
    expect(monarch.getByText('Milkweed:')).toBeInTheDocument()
    expect(speciesCard('Monarch').querySelectorAll('.pressed-flower')).toHaveLength(2)
    expect(speciesCard('Queen').querySelectorAll('.pressed-flower')).toHaveLength(1)
  })

  it('opens the form on a species, saves to the field book, and hands focus back', async () => {
    const user = userEvent.setup()
    render(<Harness sightings={[]} region="north-america" />)
    const log = within(speciesCard('Monarch')).getByRole('button', { name: 'Log a sighting of Monarch' })
    await user.click(log)
    const dialog = await screen.findByRole('dialog', { name: 'Log a sighting' }, LAZY)
    expect(within(dialog).getByRole('radio', { name: /^Monarch/ })).toBeChecked()
    expect(within(dialog).getByText(/What to look for in/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save sighting' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(log).toHaveFocus()
    expect(screen.getByText(/Saved to your field book/)).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(speciesCard('Monarch')).getByText(`Seen in the wild on ${formatDayInWords(toLocalDate())}`),
      ).toBeInTheDocument(),
    )
  })

  it('opens the form on a host plant', async () => {
    const user = userEvent.setup()
    render(<Harness sightings={[]} />)
    await user.click(within(speciesCard('Monarch')).getByRole('button', { name: 'Log a sighting of Milkweed' }))
    const dialog = await screen.findByRole('dialog', {}, LAZY)
    expect(within(dialog).getByRole('radio', { name: 'A plant' })).toBeChecked()
    expect(within(dialog).getByRole('radio', { name: 'Milkweed' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Saved to your field book/)).toBeNull()
  })

  it('offers nothing to log where nothing can be written', () => {
    render(<GuideView state={createInitialState('Tester', 'Wild Garden')} onShowSeed={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^Log a sighting/ })).toBeNull()
  })

  it('links to a nature project in the region’s own section', () => {
    render(<Harness sightings={[]} region="australasia" />)
    const region = screen.getByRole('heading', { name: 'Butterflies where you live' }).closest('section')!
    expect(within(region).getByRole('link', { name: 'Butterflies Australia (opens in your browser)' })).toHaveAttribute(
      'href',
      'https://www.butterflies.org.au/',
    )
  })
})
