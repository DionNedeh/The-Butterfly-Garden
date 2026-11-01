import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SightingInput } from '../../lib/sightings'
import SightingForm from './SightingForm'

vi.mock('../../lib/imageImport', () => ({ prepareSightingPhoto: vi.fn() }))

const TODAY = '2026-10-27'

function renderForm() {
  const onClose = vi.fn()
  render(
    <SightingForm
      sightings={[]}
      today={TODAY}
      subject={{ kind: 'butterfly', speciesId: 'monarch' }}
      onSave={vi.fn<(input: SightingInput) => boolean>(() => true)}
      onClose={onClose}
    />,
  )
  return { onClose, user: userEvent.setup(), dialog: screen.getByRole<HTMLDialogElement>('dialog') }
}

describe('3.4 a photo chooser put away without a photo', () => {
  it('leaves the form open, with the words typed in it', async () => {
    const { onClose, user, dialog } = renderForm()
    const note = screen.getByRole('textbox', { name: 'A few words, if you like' })
    await user.type(note, 'Two of them, over the fennel')
    // Chromium (and so Android's WebView) fires a bubbling `cancel` at the
    // file field when its chooser is dismissed.
    fireEvent(
      screen.getByLabelText('Add a photo, if you like'),
      new Event('cancel', { bubbles: true, cancelable: true }),
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.open).toBe(true)
    expect(note).toHaveValue('Two of them, over the fennel')
  })

  it('is still put away by Escape, the dialog’s own cancel', () => {
    const { onClose, dialog } = renderForm()
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledWith(false)
  })
})
