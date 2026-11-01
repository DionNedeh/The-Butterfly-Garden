import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { prepareSightingPhoto } from '../lib/imageImport'
import { createInitialState } from '../lib/progression'
import { PHOTO_NOT_KEPT, type ChangeSightings } from '../lib/sightings'
import { LAZY_PAGE_MS } from '../test/lazyPage'
import { GuideView } from './GuideView'

/** A lazily loaded form may take a while on a loaded machine. */
const LAZY = { timeout: LAZY_PAGE_MS }
const LAZY_TEST = { timeout: 20_000 }

// A photo as the form makes one, without a canvas to draw it on.
vi.mock('../lib/imageImport', () => ({ prepareSightingPhoto: vi.fn() }))

/** The Guide, in a garden whose every new photo is lost to another tab's change. */
function Harness() {
  const initial = createInitialState('Tester', 'Wild Garden')
  const garden = useRef(initial)
  const [state, setState] = useState(initial)
  const change = useMemo(() => {
    const changeSightings: ChangeSightings = (recipe) => {
      garden.current = { ...garden.current, sightings: recipe(garden.current.sightings, new Date()) }
      setState(garden.current)
      return true
    }
    changeSightings.photoSaved = () => Promise.resolve({ ok: false, reason: 'conflict' })
    return changeSightings
  }, [])
  return <GuideView state={state} onShowSeed={vi.fn()} onChangeSightings={change} />
}

describe('6.10 a sighting logged from the Guide, lost to another tab’s change', LAZY_TEST, () => {
  it('says the sighting was not saved, not that its photo was not kept', async () => {
    vi.mocked(prepareSightingPhoto).mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/webp' }))
    render(<Harness />)
    const user = userEvent.setup()
    const card = screen.getByRole('heading', { level: 3, name: 'Monarch' }).closest('article')!
    await user.click(within(card).getByRole('button', { name: 'Log a sighting of Monarch' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log a sighting' }, LAZY)
    await user.upload(within(dialog).getByLabelText('Add a photo, if you like'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await within(dialog).findByRole('img', { name: 'Your photo for this sighting' })
    await user.click(within(dialog).getByRole('button', { name: 'Save sighting' }))
    expect(
      await screen.findByText('The garden changed in another tab, so this sighting was not saved.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(PHOTO_NOT_KEPT)).toBeNull()
    expect(screen.queryByText(/Saved to your field book/)).toBeNull()
  })
})
