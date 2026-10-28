import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useMemo, useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { formatDayInWords } from '../lib/fieldNotes'
import { toLocalDate } from '../lib/date'
import { prepareSightingPhoto } from '../lib/imageImport'
import { createInitialState } from '../lib/progression'
import { PHOTO_NOT_KEPT, type ChangeSightings } from '../lib/sightings'
import type { AppState, RegionId, Sighting } from '../types'
import { LAZY_PAGE_MS } from '../test/lazyPage'
import { GuideView } from './GuideView'

/** A lazily loaded form or page may take a while on a loaded machine. */
const LAZY = { timeout: LAZY_PAGE_MS }
/** Room for that wait and what comes around it, as the whole-app tests have. */
const LAZY_TEST = { timeout: 20_000 }

// A photo as the form makes one, without a canvas to draw it on.
vi.mock('../lib/imageImport', () => ({ prepareSightingPhoto: vi.fn() }))

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

describe('logging a sighting from the Guide', LAZY_TEST, () => {
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

describe('logging a sighting with a photo from the Guide', LAZY_TEST, () => {
  const photo = new Blob([new Uint8Array([1])], { type: 'image/webp' })

  /** The Guide, in a garden that answers for each new photo as `stored` says. */
  function PhotoHarness({ stored }: { stored: () => Promise<{ ok: boolean }> }) {
    const initial = createInitialState('Tester', 'Wild Garden')
    const garden = useRef(initial)
    const [state, setState] = useState(initial)
    const change = useMemo(() => {
      const changeSightings: ChangeSightings = (recipe) => {
        garden.current = { ...garden.current, sightings: recipe(garden.current.sightings, new Date()) }
        setState(garden.current)
        return true
      }
      changeSightings.photoSaved = stored
      return changeSightings
    }, [stored])
    return <GuideView state={state} onShowSeed={vi.fn()} onChangeSightings={change} />
  }

  async function logWithPhoto(stored: () => Promise<{ ok: boolean }>) {
    vi.mocked(prepareSightingPhoto).mockResolvedValue(photo)
    render(<PhotoHarness stored={stored} />)
    const user = userEvent.setup()
    await user.click(within(speciesCard('Monarch')).getByRole('button', { name: 'Log a sighting of Monarch' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log a sighting' }, LAZY)
    await user.upload(within(dialog).getByLabelText('Add a photo, if you like'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await within(dialog).findByRole('img', { name: 'Your photo for this sighting' })
    await user.click(within(dialog).getByRole('button', { name: 'Save sighting' }))
  }

  it('says it is saved once the photo is stored', async () => {
    let answer: (result: { ok: boolean }) => void = () => undefined
    await logWithPhoto(() => new Promise((resolve) => (answer = resolve)))
    expect(screen.queryByText(/Saved to your field book/)).toBeNull()
    answer({ ok: true })
    expect(await screen.findByText('Saved to your field book, in the Journal’s field notes.')).toBeInTheDocument()
  })

  it('says the photo was not kept when it would not go in', async () => {
    await logWithPhoto(() => Promise.resolve({ ok: false }))
    expect(await screen.findByText(PHOTO_NOT_KEPT)).toBeInTheDocument()
    expect(screen.queryByText(/Saved to your field book/)).toBeNull()
  })
})
