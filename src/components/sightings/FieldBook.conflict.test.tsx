import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDayInWords } from '../../lib/fieldNotes'
import { prepareSightingPhoto } from '../../lib/imageImport'
import { createInitialState } from '../../lib/progression'
import { PHOTO_NOT_KEPT, type ChangeSightings } from '../../lib/sightings'
import type { AppState, Sighting } from '../../types'
import { LAZY_PAGE_MS } from '../../test/lazyPage'
import FieldBook from './FieldBook'

/** A lazily loaded form may take a while on a loaded machine. */
const LAZY = { timeout: LAZY_PAGE_MS }
const LAZY_TEST = { timeout: 20_000 }

const TODAY = '2026-10-27'

// A photo as the form makes one, without a canvas to draw it on.
vi.mock('../../lib/imageImport', () => ({ prepareSightingPhoto: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-27T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

type Stored = () => Promise<{ ok: boolean; reason?: 'conflict' | 'storage' }>

/** The field book, in a garden that answers for each new photo as `stored` says. */
function Harness({ sightings = [], stored }: { sightings?: Sighting[]; stored?: Stored }) {
  const initial: AppState = { ...createInitialState('Tester', 'Wild Garden'), sightings }
  const garden = useRef(initial)
  const [state, setState] = useState(initial)
  const change = useMemo(() => {
    const changeSightings: ChangeSightings = (recipe) => {
      const next = recipe(garden.current.sightings, new Date())
      if (next === garden.current.sightings) return false
      garden.current = { ...garden.current, sightings: next }
      setState(garden.current)
      return true
    }
    if (stored) changeSightings.photoSaved = stored
    return changeSightings
  }, [stored])
  return (
    <>
      <FieldBook state={state} today={TODAY} onChangeSightings={change} />
      <output data-testid="stored">{JSON.stringify(state.sightings.map(({ date, note }) => ({ date, note })))}</output>
    </>
  )
}

describe('6.10 a sighting dated ahead of the clock, in the field book', LAZY_TEST, () => {
  it('has its note changed and saved, keeping its day', async () => {
    const ahead: Sighting = {
      id: 'ahead',
      date: '2026-11-02',
      kind: 'butterfly',
      speciesId: 'monarch',
      note: 'By the gate',
      createdAt: '2026-11-02T09:00:00.000Z',
    }
    render(<Harness sightings={[ahead]} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Edit Monarch, ${formatDayInWords(ahead.date)}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Change this sighting' }, LAZY)
    const note = within(dialog).getByLabelText('A few words, if you like')
    await user.clear(note)
    await user.type(note, 'By the gate, two of them')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Your changes are saved.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(JSON.parse(screen.getByTestId('stored').textContent)).toEqual([
      { date: '2026-11-02', note: 'By the gate, two of them' },
    ])
  })
})

describe('6.10 a new sighting lost to another tab’s change', LAZY_TEST, () => {
  const photo = new Blob([new Uint8Array([1])], { type: 'image/webp' })

  it('says the sighting was not saved, not that its photo was not kept', async () => {
    vi.mocked(prepareSightingPhoto).mockResolvedValue(photo)
    render(<Harness stored={() => Promise.resolve({ ok: false, reason: 'conflict' })} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Log a sighting' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log a sighting' }, LAZY)
    await user.click(within(dialog).getByRole('radio', { name: 'Monarch' }))
    await user.upload(within(dialog).getByLabelText('Add a photo, if you like'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await within(dialog).findByRole('img', { name: 'Your photo for this sighting' })
    await user.click(within(dialog).getByRole('button', { name: 'Save sighting' }))
    expect(
      await screen.findByText('The garden changed in another tab, so this sighting was not saved.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(PHOTO_NOT_KEPT)).toBeNull()
    await waitFor(() => expect(screen.queryByText('Saved to your field book.')).toBeNull())
  })
})

describe('6.10 a change to a sighting lost to another tab’s change', LAZY_TEST, () => {
  const photo = new Blob([new Uint8Array([1])], { type: 'image/webp' })

  it('says the changes were not saved, not that the sighting was not, nor its photo', async () => {
    const kept: Sighting = {
      id: 'kept',
      date: '2026-10-20',
      kind: 'butterfly',
      speciesId: 'monarch',
      note: 'By the gate',
      createdAt: '2026-10-20T09:00:00.000Z',
    }
    vi.mocked(prepareSightingPhoto).mockResolvedValue(photo)
    render(<Harness sightings={[kept]} stored={() => Promise.resolve({ ok: false, reason: 'conflict' })} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Edit Monarch, ${formatDayInWords(kept.date)}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Change this sighting' }, LAZY)
    await user.upload(within(dialog).getByLabelText('Add a photo, if you like'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await within(dialog).findByRole('img', { name: 'Your photo for this sighting' })
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(
      await screen.findByText('The garden changed in another tab, so your changes were not saved.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('The garden changed in another tab, so this sighting was not saved.')).toBeNull()
    expect(screen.queryByText(PHOTO_NOT_KEPT)).toBeNull()
    expect(screen.queryByText('Your changes are saved.')).toBeNull()
  })
})
