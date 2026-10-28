import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareBackdrop, turnBackdrop } from '../lib/imageImport'
import type { CustomBackdrop } from '../types'
import CustomBackdropEditor from './CustomBackdropEditor'

vi.mock('../lib/imageImport', () => ({ prepareBackdrop: vi.fn(), turnBackdrop: vi.fn() }))
const prepare = vi.mocked(prepareBackdrop)
const turn = vi.mocked(turnBackdrop)

function image(overrides: Partial<CustomBackdrop> = {}): CustomBackdrop {
  return {
    id: 'fresh',
    name: 'Meadow',
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    mimeType: 'image/webp',
    width: 400,
    height: 300,
    byteLength: 3,
    imageData: 'AAAA',
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    ...overrides,
  }
}

/** A promise the test settles when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function renderEditor(initial?: CustomBackdrop, saveLabel?: string) {
  const onSave = vi.fn<(saved: CustomBackdrop) => Promise<{ ok: boolean; message?: string }>>(
    () => Promise.resolve({ ok: true }),
  )
  const onClose = vi.fn()
  render(
    <CustomBackdropEditor
      initial={initial}
      onSave={onSave}
      onClose={onClose}
      saveLabel={saveLabel}
    />,
  )
  return { onSave, onClose, user: userEvent.setup() }
}

const picture = new File(['x'], 'meadow.webp', { type: 'image/webp' })
const chooser = () => screen.getByLabelText('Choose a garden image')
const slider = (name: string) => screen.getByRole('slider', { name, hidden: true })

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  if (!Reflect.has(Element.prototype, 'setPointerCapture'))
    Element.prototype.setPointerCapture = () => undefined
})

afterEach(() => {
  prepare.mockReset()
  turn.mockReset()
  vi.unstubAllGlobals()
})

describe('framing a new image', () => {
  it('opens as a dialog, prepares the chosen image, and shows it while it works', async () => {
    const pending = deferred<CustomBackdrop>()
    prepare.mockReturnValue(pending.promise)
    const { user } = renderEditor()
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('open')
    // The auto-lock waits while it is open: the image being framed is no
    // draft, and locking would take it away (components/lock/LockWatch).
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('data-auto-lock-waits')
    expect(screen.queryByLabelText('Image name')).toBeNull()

    await user.upload(chooser(), picture)
    expect(prepare).toHaveBeenCalledWith(picture)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent(/Preparing your image/)
    expect(chooser()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close', hidden: true })).toBeDisabled()

    await act(async () => {
      pending.resolve(image())
      await pending.promise
    })
    expect(screen.getByLabelText('Image name')).toHaveValue('Meadow')
    expect(screen.queryByRole('status', { hidden: true })).toBeNull()
    expect(chooser()).toHaveValue('')
  })

  it('says why an image could not be used', async () => {
    prepare.mockRejectedValueOnce(new Error('That image has too many pixels to work with here.'))
    const { user } = renderEditor()
    await user.upload(chooser(), picture)
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('too many pixels')

    prepare.mockRejectedValueOnce('not an error')
    await user.upload(chooser(), picture)
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('That image could not be read.')
  })

  it('keeps only the last of two quick choices', async () => {
    const first = deferred<CustomBackdrop>()
    const second = deferred<CustomBackdrop>()
    prepare.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    renderEditor()
    // The input is disabled while busy, so the second choice arrives the way
    // a fast second change event would.
    fireEvent.change(chooser(), { target: { files: [picture] } })
    fireEvent.change(chooser(), { target: { files: [picture] } })
    await act(async () => {
      second.resolve(image({ name: 'Second' }))
      first.resolve(image({ name: 'First' }))
      await Promise.all([second.promise, first.promise])
    })
    expect(screen.getByLabelText('Image name')).toHaveValue('Second')

    // A late failure from an older choice is not shown either.
    const third = deferred<CustomBackdrop>()
    const fourth = deferred<CustomBackdrop>()
    prepare.mockReturnValueOnce(third.promise).mockReturnValueOnce(fourth.promise)
    fireEvent.change(chooser(), { target: { files: [picture] } })
    fireEvent.change(chooser(), { target: { files: [picture] } })
    await act(async () => {
      fourth.resolve(image({ name: 'Fourth' }))
      third.reject(new Error('stale'))
      await Promise.allSettled([fourth.promise, third.promise])
    })
    expect(screen.queryByRole('alert', { hidden: true })).toBeNull()
  })

  it('ignores a change that carries no file', () => {
    renderEditor()
    fireEvent.change(chooser(), { target: { files: [] } })
    expect(prepare).not.toHaveBeenCalled()
  })
})

describe('adjusting and saving', () => {
  it('replaces the picture of an image being edited without changing which image it is', async () => {
    prepare.mockResolvedValue(image({ id: 'new', createdAt: 'later', name: 'Replacement' }))
    const { onSave, user } = renderEditor(image({ id: 'kept', createdAt: 'first' }))
    await user.upload(chooser(), picture)
    await screen.findByDisplayValue('Replacement')
    await user.click(screen.getByRole('button', { name: 'Save & use backdrop', hidden: true }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'kept', createdAt: 'first' }))
  })

  it('moves, zooms and resets the crop, and previews either shape', async () => {
    const { user } = renderEditor(image())
    fireEvent.change(slider('Zoom'), { target: { value: '2' } })
    fireEvent.change(slider('Horizontal position'), { target: { value: '0.2' } })
    fireEvent.change(slider('Vertical position'), { target: { value: '0.9' } })
    expect(slider('Zoom')).toHaveValue('2')
    expect(slider('Vertical position')).toHaveValue('0.9')

    await user.click(screen.getByRole('button', { name: 'Reset crop', hidden: true }))
    expect(slider('Zoom')).toHaveValue('1')
    expect(slider('Horizontal position')).toHaveValue('0.5')

    const phone = screen.getByRole('button', { name: 'Phone preview', hidden: true })
    await user.click(phone)
    expect(phone).toHaveAttribute('aria-pressed', 'true')
    expect(document.querySelector('.crop-preview')).toHaveClass('phone')
    await user.click(screen.getByRole('button', { name: 'Wide preview', hidden: true }))
    expect(document.querySelector('.crop-preview')).toHaveClass('wide')
  })

  it('drags the picture to reposition it, and lets go', () => {
    renderEditor(image())
    const preview = document.querySelector('.crop-preview')!
    fireEvent.pointerMove(preview, { clientX: 50, clientY: 50 }) // not dragging yet
    expect(slider('Horizontal position')).toHaveValue('0.5')

    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 101, clientY: 99 })
    expect(slider('Horizontal position')).toHaveValue('0')
    expect(slider('Vertical position')).toHaveValue('1')
    fireEvent.pointerUp(preview)
    fireEvent.pointerMove(preview, { clientX: 0, clientY: 0 })
    expect(slider('Horizontal position')).toHaveValue('0')

    fireEvent.pointerDown(preview, { pointerId: 2, clientX: 0, clientY: 0 })
    fireEvent.pointerCancel(preview)
    fireEvent.pointerMove(preview, { clientX: 9, clientY: 9 })
    expect(slider('Horizontal position')).toHaveValue('0')
  })

  it('saves a blank name as a friendly one and closes', async () => {
    const { onSave, onClose, user } = renderEditor(image())
    await user.clear(screen.getByLabelText('Image name'))
    await user.type(screen.getByLabelText('Image name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Save & use backdrop', hidden: true }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'My garden image' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the draft open when saving is refused or fails', async () => {
    const { onSave, onClose, user } = renderEditor(image())
    const save = screen.getByRole('button', { name: 'Save & use backdrop', hidden: true })

    onSave.mockResolvedValueOnce({ ok: false, message: 'There is no room for another image.' })
    await user.click(save)
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('no room')

    onSave.mockResolvedValueOnce({ ok: false })
    await user.click(save)
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('Your image could not be saved.')

    onSave.mockRejectedValueOnce(new Error('quota'))
    await user.click(save)
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('Your draft is still here.')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Image name')).toHaveValue('Meadow')
  })

  it('shows that it is saving, and cannot be closed until it is done', async () => {
    const pending = deferred<{ ok: boolean }>()
    const { onSave, onClose, user } = renderEditor(image())
    onSave.mockReturnValueOnce(pending.promise)
    await user.click(screen.getByRole('button', { name: 'Save & use backdrop', hidden: true }))
    expect(screen.getByRole('button', { name: 'Preparing…', hidden: true })).toBeDisabled()

    const dialog = screen.getByRole('dialog', { hidden: true })
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.pointerDown(document.querySelector('.crop-preview')!, { clientX: 0, clientY: 0 })

    await act(async () => {
      pending.resolve({ ok: true })
      await pending.promise
    })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('closing', () => {
  it('closes from its button, or from Escape without the browser closing it first', async () => {
    const { onClose, user } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Close', hidden: true }))
    expect(onClose).toHaveBeenCalledOnce()

    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(screen.getByRole('dialog', { hidden: true }), cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('turning the picture', () => {
  const turned = {
    mimeType: 'image/webp' as const,
    width: 300,
    height: 400,
    byteLength: 3,
    imageData: 'BBBB',
  }
  const preview = () => document.querySelector<HTMLImageElement>('.crop-preview img')!
  const button = (name: string) => screen.getByRole('button', { name, hidden: true })

  it('turns a saved image from its stored copy, keeping focus on the button pressed', async () => {
    const pending = deferred<typeof turned>()
    turn.mockReturnValueOnce(pending.promise)
    const kept = image({ crop: { x: 0.2, y: 0.1, zoom: 1.5 } })
    const { onSave, user } = renderEditor(kept)
    const right = button('Turn right')
    await user.click(right)

    expect(turn).toHaveBeenCalledWith(kept, 1)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Turning your image.')
    // Unavailable while it works, but still where focus is.
    expect(right).toHaveAttribute('aria-disabled', 'true')
    expect(right).not.toBeDisabled()
    expect(right).toHaveFocus()
    await user.click(right)
    expect(turn).toHaveBeenCalledOnce()

    await act(async () => {
      pending.resolve(turned)
      await pending.promise
    })
    expect(preview().src).toContain('BBBB')
    // The framed part turns with it: near the top left, now the top right.
    expect(slider('Horizontal position')).toHaveValue('0.9')
    expect(slider('Vertical position')).toHaveValue('0.2')
    expect(right).toHaveAttribute('aria-disabled', 'false')
    expect(right).toHaveFocus()

    // Back to as it was: the stored copy itself, not a new copy of it.
    await user.click(button('Turn left'))
    expect(turn).toHaveBeenCalledOnce()
    expect(preview().src).toContain('AAAA')
    await user.click(button('Save & use backdrop'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        imageData: 'AAAA',
        width: 400,
        height: 300,
        crop: { x: 0.2, y: 0.1, zoom: 1.5 },
      }),
    )
  })

  it('turns a newly chosen picture from the file, and saves it turned', async () => {
    prepare.mockResolvedValue(image({ name: 'Fresh' }))
    turn.mockResolvedValue(turned)
    const { onSave, user } = renderEditor()
    await user.upload(chooser(), picture)
    await screen.findByDisplayValue('Fresh')

    await user.click(button('Turn left'))
    expect(turn).toHaveBeenCalledWith(picture, 3)
    await waitFor(() => expect(preview().src).toContain('BBBB'))
    // Every turn is asked of the file, as a total, never of the last copy.
    await user.click(button('Turn left'))
    expect(turn).toHaveBeenLastCalledWith(picture, 2)
    await waitFor(() => expect(button('Turn left')).toHaveAttribute('aria-disabled', 'false'))

    await user.click(button('Save & use backdrop'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fresh', imageData: 'BBBB', width: 300, height: 400 }),
    )
  })

  it('says why a turn did not work, and keeps the picture as it was', async () => {
    turn.mockRejectedValueOnce(new Error('This image is too detailed to fit. Try a smaller image.'))
    const { user } = renderEditor(image())
    await user.click(button('Turn right'))
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('too detailed')
    expect(preview().src).toContain('AAAA')

    turn.mockRejectedValueOnce('not an error')
    await user.click(button('Turn right'))
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent(
      'That image could not be turned.',
    )
  })

  it('lets a newer choice of picture win over a turn still being made', async () => {
    const pending = deferred<typeof turned>()
    turn.mockReturnValueOnce(pending.promise)
    prepare.mockResolvedValue(image({ name: 'Newer', imageData: 'CCCC' }))
    const { user } = renderEditor(image())
    await user.click(button('Turn right'))
    // The chooser is disabled while busy; a change still arriving is honoured.
    fireEvent.change(chooser(), { target: { files: [picture] } })
    await screen.findByDisplayValue('Newer')
    await act(async () => {
      pending.reject(new Error('stale'))
      await pending.promise.catch(() => undefined)
    })
    expect(preview().src).toContain('CCCC')
    expect(screen.queryByRole('alert', { hidden: true })).toBeNull()
  })
})

describe('brightness', () => {
  it('lightens or darkens the picture only, says by how much, and saves it', async () => {
    const { onSave, user } = renderEditor(image())
    const brightness = slider('Brightness')
    expect(brightness).toHaveAttribute('aria-valuetext', 'As taken')
    expect(brightness).toHaveAttribute('min', '-40')
    expect(brightness).toHaveAttribute('max', '20')
    const picture = document.querySelector<HTMLImageElement>('.crop-preview img')!
    expect(picture.style.filter).toBe('')

    fireEvent.change(brightness, { target: { value: '-20' } })
    expect(brightness).toHaveAttribute('aria-valuetext', '20% darker')
    expect(screen.getByText('20% darker')).toBeInTheDocument()
    expect(picture.style.filter).toBe('brightness(0.8)')
    // The caption standing in for the heading is never filtered.
    expect(document.querySelector<HTMLElement>('.crop-caption')!.style.filter).toBe('')

    fireEvent.change(brightness, { target: { value: '10' } })
    expect(brightness).toHaveAttribute('aria-valuetext', '10% brighter')
    await user.click(screen.getByRole('button', { name: 'Save & use backdrop', hidden: true }))
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ brightness: 10 }))
  })

  it('saves no brightness at all once it is back to as taken', async () => {
    const { onSave, user } = renderEditor(image({ brightness: -30 }))
    expect(slider('Brightness')).toHaveValue('-30')
    fireEvent.change(slider('Brightness'), { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'Save & use backdrop', hidden: true }))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('brightness')
  })
})

describe('saving an image kept for the night', () => {
  it('says what saving does when it is not choosing the image for the day', () => {
    renderEditor(image(), 'Save night image')
    expect(screen.getByRole('button', { name: 'Save night image', hidden: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save & use backdrop', hidden: true })).toBeNull()
  })
})

