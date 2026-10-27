import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_SIGHTING_PHOTOS, MAX_SIGHTINGS } from '../../lib/customBackdrops'
import { prepareSightingPhoto } from '../../lib/imageImport'
import type { SightingInput } from '../../lib/sightings'
import { readText } from '../../test/woff2'
import type { RegionId, Sighting, SightingSubject } from '../../types'
import SightingForm from './SightingForm'

vi.mock('../../lib/imageImport', () => ({ prepareSightingPhoto: vi.fn() }))

const TODAY = '2026-10-27'

// Through a variable: Vite turns `new URL('…', import.meta.url)` written out
// in full into a served asset's address, and the files are wanted on disk
// (a `?raw` import of a stylesheet comes to a test empty).
const here = import.meta.url
const stylesheet = (path: string) => readText(new URL(path, here))

afterEach(() => {
  vi.mocked(prepareSightingPhoto).mockReset()
})

function renderForm({
  sightings = [],
  region,
  editing,
  subject,
  saves = true,
  container,
}: {
  sightings?: Sighting[]
  region?: RegionId
  editing?: Sighting
  subject?: SightingSubject
  saves?: boolean
  container?: HTMLElement
} = {}) {
  const onSave = vi.fn<(input: SightingInput) => boolean>(() => saves)
  const onClose = vi.fn()
  render(
    <SightingForm
      sightings={sightings}
      region={region}
      today={TODAY}
      editing={editing}
      subject={subject}
      onSave={onSave}
      onClose={onClose}
    />,
    container ? { container } : undefined,
  )
  return { onSave, onClose, user: userEvent.setup(), dialog: screen.getByRole('dialog') }
}

const sighting = (id: string, extra: Partial<Sighting> = {}) =>
  ({
    id,
    date: '2026-10-01',
    kind: 'butterfly',
    speciesId: 'monarch',
    createdAt: '2026-10-01T09:00:00.000Z',
    ...extra,
  }) as Sighting

/**
 * jsdom lays nothing out, so the choice list is given a layout to measure: a
 * 256px window (inside a 1px border) 300px down the screen, onto rows 44px
 * tall below 4px of padding, moved by the list's own scrollTop.
 */
const LIST_TOP = 300
const ROW = 44
function layOutChoiceList() {
  const at = (top: number, height: number) =>
    ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect
  const choiceList = (element: Element) => element.classList.contains('sighting-choice-list')
  const spies = [
    vi.spyOn(Element.prototype, 'clientTop', 'get').mockImplementation(function (this: Element) {
      return choiceList(this) ? 1 : 0
    }),
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      return choiceList(this) ? 256 : 0
    }),
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (choiceList(this)) return at(LIST_TOP, 258)
      const list = this.parentElement
      if (this.classList.contains('sighting-choice') && list) {
        const index = [...list.children].indexOf(this)
        return at(LIST_TOP + 1 + 4 + index * ROW - list.scrollTop, ROW)
      }
      return at(0, 0)
    }),
  ]
  return () => spies.forEach((spy) => spy.mockRestore())
}

/** Where a radio's row sits in its list, and whether the list's window shows all of it. */
function placeOf(radio: HTMLElement) {
  const row = radio.closest('label')!
  const list = row.parentElement!
  const index = [...list.children].indexOf(row)
  const top = LIST_TOP + 1 + 4 + index * ROW - list.scrollTop
  return { index, inSight: top >= LIST_TOP + 1 && top + ROW <= LIST_TOP + 1 + 256 }
}

describe('the sighting form', () => {
  it('opens as a dialog with focus on its heading, and the gentle words first', () => {
    const { dialog } = renderForm()
    expect(screen.getByRole('heading', { name: 'Log a sighting' })).toHaveFocus()
    expect(within(dialog).getByText(/nothing needs to be caught or touched/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Nothing about where it was taken is kept/)).toBeInTheDocument()
  })

  it('logs a butterfly from the list, today, with a few words', async () => {
    const { user, onSave, onClose } = renderForm()
    await user.click(screen.getByRole('radio', { name: 'Painted Lady' }))
    await user.type(screen.getByLabelText('A few words, if you like'), 'On the buddleia')
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(onSave).toHaveBeenCalledWith({
      kind: 'butterfly',
      speciesId: 'painted-lady',
      date: TODAY,
      note: 'On the buddleia',
    })
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('searches the field guide, keeping the choice made in view', async () => {
    const { user } = renderForm()
    await user.click(screen.getByRole('radio', { name: 'Monarch' }))
    await user.type(screen.getByRole('searchbox', { name: 'Find a butterfly' }), 'lady')
    const list = screen.getByRole('group', { name: 'Which butterfly?' })
    expect(within(list).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'butterfly:monarch',
      'butterfly:painted-lady',
      'butterfly:american-lady',
    ])
    expect(within(list).getByRole('status')).toHaveTextContent('2 butterflies found.')
    await user.clear(screen.getByRole('searchbox', { name: 'Find a butterfly' }))
    await user.type(screen.getByRole('searchbox', { name: 'Find a butterfly' }), 'dragonfly')
    expect(within(list).getByRole('status')).toHaveTextContent('No butterfly by that name.')
  })

  it('lists the region’s own first, and logs a plant', async () => {
    const { user, onSave } = renderForm({ region: 'europe' })
    const butterflies = within(screen.getByRole('group', { name: 'Which butterfly?' })).getAllByRole('radio')
    expect(butterflies[0]).toHaveAccessibleName('Red Admiral Native to the UK and Europe')
    expect(screen.getByText('Those that live where you garden come first.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'A plant' }))
    const plants = within(screen.getByRole('group', { name: 'Which plant?' })).getAllByRole('radio')
    expect(plants[0]).toHaveAccessibleName(/Native to/)
    await user.click(screen.getByRole('radio', { name: /^Stinging Nettle/ }))
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kind: 'plant', plantId: 'nettle' }))
  })

  it('says what is missing rather than saving it', async () => {
    const { user, onSave } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a butterfly from the list.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('stops at today, and refuses a day still to come', async () => {
    const { user, onSave } = renderForm({ subject: { kind: 'butterfly', speciesId: 'monarch' } })
    const day = screen.getByLabelText('The day you saw it')
    expect(day).toHaveAttribute('max', TODAY)
    expect(day).toHaveValue(TODAY)
    fireEvent.change(day, { target: { value: '2026-11-02' } })
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/today or an earlier day/)
    fireEvent.change(day, { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the day you saw it.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('starts on the butterfly or plant whose card opened it', () => {
    renderForm({ subject: { kind: 'plant', plantId: 'milkweed' } })
    expect(screen.getByRole('radio', { name: 'A plant' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Milkweed' })).toBeChecked()
  })

  // Milkweed is the UK and Europe's eleventh plant, natives first; Zinnia,
  // with no region, the guide's twenty-fifth.
  const milkweedCard = { region: 'europe', subject: { kind: 'plant', plantId: 'milkweed' } } as const
  const zinniaSighting = sighting('z', { kind: 'plant', plantId: 'zinnia', speciesId: undefined } as Partial<Sighting>)
  it.each([
    ['a card', milkweedCard, /^Milkweed/],
    ['a sighting being changed', { editing: zinniaSighting }, /^Zinnia/],
  ])('shows the choice it opens on from %s within its list, focus on the heading', (_, options, name) => {
    const restore = layOutChoiceList()
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      renderForm(options)
      const chosen = screen.getByRole('radio', { name })
      expect(chosen).toBeChecked()
      // Far down the list, which is moved just far enough to show its row
      // whole at the foot of the window; nothing else is scrolled.
      const { index, inSight } = placeOf(chosen)
      expect(index).toBeGreaterThan(6)
      expect(inSight).toBe(true)
      expect(chosen.closest('.sighting-choice-list')!.scrollTop).toBe(index * ROW + 4 + ROW - 256)
      expect(scrollIntoView).not.toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: /sighting$/ })).toHaveFocus()
    } finally {
      restore()
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })

  it('shows each kind’s choice again as the kind changes, from the top where none is made', async () => {
    const restore = layOutChoiceList()
    try {
      const { user } = renderForm(milkweedCard)
      const list = document.querySelector<HTMLElement>('.sighting-choice-list')!
      expect(placeOf(screen.getByRole('radio', { name: /^Milkweed/ })).inSight).toBe(true)
      const below = list.scrollTop
      // No butterfly chosen yet: the butterflies start at the top.
      await user.click(screen.getByRole('radio', { name: 'A butterfly' }))
      expect(list.scrollTop).toBe(0)
      await user.click(screen.getByRole('radio', { name: /^Red Admiral/ }))
      // Back to the plants, scrolled down again to Milkweed.
      await user.click(screen.getByRole('radio', { name: 'A plant' }))
      expect(list.scrollTop).toBe(below)
      expect(placeOf(screen.getByRole('radio', { name: /^Milkweed/ })).inSight).toBe(true)
      // And to the butterflies, scrolled up to the Red Admiral at their head.
      await user.click(screen.getByRole('radio', { name: 'A butterfly' }))
      const admiral = screen.getByRole('radio', { name: /^Red Admiral/ })
      expect(admiral).toBeChecked()
      expect(placeOf(admiral)).toEqual({ index: 0, inSight: true })
      expect(screen.getByRole('radio', { name: 'A butterfly' })).toHaveFocus()
    } finally {
      restore()
    }
  })

  it('keeps each radio a small dot beside its name, never a text field’s width, by night at the largest text', () => {
    // The app's own stylesheets, in the order it loads them: index.css gives
    // every input a text field's full width and padding.
    const style = document.createElement('style')
    style.textContent = [
      '../../index.css',
      '../../App.css',
      '../../theme-aurora.css',
      '../../garden-3.css',
      './sightings.css',
    ]
      .map(stylesheet)
      .join('\n')
    document.head.append(style)
    document.documentElement.dataset.textSize = 'largest'
    const shell = document.createElement('div')
    shell.className = 'app-shell theme-night'
    document.body.append(shell)
    try {
      renderForm({ ...milkweedCard, container: shell })
      const radios = screen.getAllByRole('radio')
      expect(radios.length).toBeGreaterThan(10)
      for (const radio of [...radios.slice(0, 4), screen.getByRole('radio', { name: /^Milkweed/ })]) {
        const look = getComputedStyle(radio)
        expect({ width: look.width, height: look.height, padding: look.padding, flex: look.flex }).toEqual({
          width: '22px',
          height: '22px',
          padding: '0px',
          flex: '0 0 auto',
        })
      }
    } finally {
      style.remove()
      shell.remove()
      delete document.documentElement.dataset.textSize
    }
  })

  it('adds a photo, shows it, and takes it away again with focus kept', async () => {
    const photo = new Blob([new Uint8Array([1])], { type: 'image/webp' })
    vi.mocked(prepareSightingPhoto).mockResolvedValue(photo)
    const { user, onSave } = renderForm({ subject: { kind: 'butterfly', speciesId: 'monarch' } })
    const input = screen.getByLabelText('Add a photo, if you like')
    await user.upload(input, new File(['x'], 'monarch.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByRole('img', { name: 'Your photo for this sighting' })).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a different photo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByLabelText('Add a photo, if you like')).toHaveFocus()

    await user.upload(screen.getByLabelText('Add a photo, if you like'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await screen.findByRole('img', { name: 'Your photo for this sighting' })
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photo }))
  })

  it('says why a photo could not be used', async () => {
    vi.mocked(prepareSightingPhoto).mockRejectedValue(new Error('That image has too many pixels to work with here.'))
    const { user } = renderForm()
    await user.upload(screen.getByLabelText('Add a photo, if you like'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/too many pixels/))
  })

  it('offers no new photo once the field book holds as many as it keeps', () => {
    const full = Array.from({ length: MAX_SIGHTING_PHOTOS }, (_, index) =>
      sighting(`p-${index}`, { photo: new Blob([new Uint8Array([1])], { type: 'image/webp' }) }),
    )
    renderForm({ sightings: full })
    expect(screen.queryByLabelText(/Add a photo/)).toBeNull()
    expect(screen.getByText(/keeps 50 photos, and has them all/)).toBeInTheDocument()
  })

  it('says so when the field book is full', async () => {
    const full = Array.from({ length: MAX_SIGHTINGS }, (_, index) => sighting(`s-${index}`))
    const { user, onSave } = renderForm({ sightings: full, subject: { kind: 'butterfly', speciesId: 'monarch' } })
    expect(screen.getByText(/Your field book is full/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/full: it keeps 2,000 sightings/)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('changes a sighting, starting from what it says', async () => {
    const editing = sighting('a', { kind: 'plant', plantId: 'violet', speciesId: undefined, note: 'By the path' } as Partial<Sighting>)
    const { user, onSave } = renderForm({ editing, sightings: [editing] })
    expect(screen.getByRole('heading', { name: 'Change this sighting' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Violet' })).toBeChecked()
    expect(screen.getByLabelText('A few words, if you like')).toHaveValue('By the path')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledWith({ kind: 'plant', plantId: 'violet', date: '2026-10-01', note: 'By the path' })
  })

  it('keeps its words when the garden would not take them', async () => {
    const { user, onClose } = renderForm({ subject: { kind: 'butterfly', speciesId: 'monarch' }, saves: false })
    await user.click(screen.getByRole('button', { name: 'Save sighting' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be saved just now/)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Cancel and on Escape, keeping nothing', async () => {
    const { user, onClose, onSave } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledWith(false)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('stays open while a photo is being prepared', async () => {
    let finish: (photo: Blob) => void = () => undefined
    vi.mocked(prepareSightingPhoto).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const { user, onClose, dialog } = renderForm()
    await user.upload(screen.getByLabelText('Add a photo, if you like'), new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    expect(screen.getByText('Preparing your photo…')).toBeInTheDocument()
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    finish(new Blob([new Uint8Array([1])], { type: 'image/webp' }))
    await screen.findByRole('img', { name: 'Your photo for this sighting' })
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledWith(false)
  })
})
