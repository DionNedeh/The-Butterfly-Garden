import { afterEach, describe, expect, it, vi } from 'vitest'
import { backAction, requestDialogClose, requestDismiss } from './backNavigation'

/** An open dialog, with a stand-in close() since jsdom has none. */
function openDialog() {
  const dialog = document.createElement('dialog')
  dialog.setAttribute('open', '')
  const close = vi.fn(() => dialog.removeAttribute('open'))
  dialog.close = close
  document.body.append(dialog)
  return { dialog, close }
}

describe('backAction', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('closes the dialog on top before anything else', () => {
    openDialog()
    const { dialog: top } = openDialog()
    expect(backAction('shop')).toEqual({ kind: 'close-dialog', dialog: top })
  })

  it('puts away something open in place before leaving the page', () => {
    const menu = document.createElement('div')
    menu.setAttribute('data-dismiss-on-back', '')
    document.body.append(menu)
    expect(backAction('today')).toEqual({ kind: 'dismiss', element: menu })
    // A dialog is still the top layer.
    const { dialog } = openDialog()
    expect(backAction('today')).toEqual({ kind: 'close-dialog', dialog })
  })

  it('dismisses as Escape would', () => {
    const menu = document.createElement('div')
    const heard = vi.fn((event: KeyboardEvent) => event.key)
    document.body.append(menu)
    document.body.addEventListener('keydown', heard)
    requestDismiss(menu)
    // It bubbles, so the handler of whatever holds the menu hears it.
    expect(heard).toHaveReturnedWith('Escape')
  })

  it('ignores dialogs that are not open', () => {
    document.body.append(document.createElement('dialog'))
    expect(backAction('shop')).toEqual({ kind: 'view', view: 'garden' })
  })

  it('returns from the Moonlight recap to Today, where it was opened', () => {
    expect(backAction('recap')).toEqual({ kind: 'view', view: 'today' })
  })

  it('returns the privacy policy, notices and support page to Settings', () => {
    expect(backAction('privacy')).toEqual({ kind: 'view', view: 'settings' })
    expect(backAction('notices')).toEqual({ kind: 'view', view: 'settings' })
    expect(backAction('support')).toEqual({ kind: 'view', view: 'settings' })
  })

  it('returns the Guide to the page a "What does this do?" link left', () => {
    expect(backAction('guide', document, 'care')).toEqual({ kind: 'view', view: 'care' })
    expect(backAction('guide', document, 'recap')).toEqual({ kind: 'view', view: 'recap' })
    // Opened from the navigation, it goes back to the garden as before.
    expect(backAction('guide')).toEqual({ kind: 'view', view: 'garden' })
    expect(backAction('guide', document, 'guide')).toEqual({ kind: 'view', view: 'garden' })
    // Only the Guide remembers where it came from.
    expect(backAction('journal', document, 'care')).toEqual({ kind: 'view', view: 'garden' })
  })

  it('returns any other page to the garden', () => {
    for (const view of ['care', 'today', 'journal', 'settings'] as const)
      expect(backAction(view)).toEqual({ kind: 'view', view: 'garden' })
  })

  it('leaves the app only from the garden itself', () => {
    expect(backAction('garden')).toEqual({ kind: 'leave' })
    expect(backAction(undefined)).toEqual({ kind: 'leave' })
  })
})

describe('requestDialogClose', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('closes a dialog that does not object', () => {
    const { dialog, close } = openDialog()
    requestDialogClose(dialog)
    expect(close).toHaveBeenCalled()
  })

  it('lets a dialog refuse, as a busy editor does', () => {
    const { dialog, close } = openDialog()
    const onCancel = vi.fn((event: Event) => event.preventDefault())
    dialog.addEventListener('cancel', onCancel)
    requestDialogClose(dialog)
    expect(onCancel).toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})
