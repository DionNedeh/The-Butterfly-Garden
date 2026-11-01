import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomBackdrop } from '../types'
import CustomBackdropEditor from './CustomBackdropEditor'

vi.mock('../lib/imageImport', () => ({ prepareBackdrop: vi.fn(), turnBackdrop: vi.fn() }))

const meadow: CustomBackdrop = {
  id: 'meadow',
  name: 'Meadow',
  createdAt: '2026-10-26T10:00:00.000Z',
  updatedAt: '2026-10-26T10:00:00.000Z',
  mimeType: 'image/webp',
  width: 400,
  height: 300,
  byteLength: 3,
  imageData: 'AAAA',
  crop: { x: 0.5, y: 0.5, zoom: 1 },
}

function renderEditor() {
  const onClose = vi.fn()
  render(
    <CustomBackdropEditor
      initial={meadow}
      onSave={() => Promise.resolve({ ok: true })}
      onClose={onClose}
    />,
  )
  return { onClose, dialog: screen.getByRole<HTMLDialogElement>('dialog', { hidden: true }) }
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('3.4 an image chooser put away without an image', () => {
  it('leaves the editor open, with the image as it was being framed', () => {
    const { onClose, dialog } = renderEditor()
    const name = screen.getByLabelText('Image name')
    fireEvent.change(name, { target: { value: 'Meadow at dusk' } })
    // Chromium (and so Android's WebView) fires a bubbling `cancel` at the
    // file field when its chooser is dismissed.
    fireEvent(
      screen.getByLabelText('Choose a garden image'),
      new Event('cancel', { bubbles: true, cancelable: true }),
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.open).toBe(true)
    expect(name).toHaveValue('Meadow at dusk')
  })

  it('is still put away by Escape, the dialog’s own cancel', () => {
    const { onClose, dialog } = renderEditor()
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
