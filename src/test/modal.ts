/**
 * What a browser does while a dialog is open as a modal, and jsdom does not:
 * everything outside it is inert, so focus() on it does nothing. Without
 * this, a test cannot tell focus handed back once a dialog has gone from
 * focus handed back while it was still open, which a browser refuses and
 * which then falls to nothing as the dialog is taken away.
 *
 * Returns how to put jsdom back as it was.
 */
export function inertOutsideModals(): () => void {
  const showing = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
  const focusing = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'focus')
  if (!showing || !focusing) throw new Error('jsdom has no showModal or focus to stand in for.')
  const showModal = showing.value as (this: HTMLDialogElement) => void
  const focus = focusing.value as (this: HTMLElement, options?: FocusOptions) => void
  const modals = new Set<HTMLDialogElement>()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    ...showing,
    value: function (this: HTMLDialogElement) {
      showModal.call(this)
      modals.add(this)
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'focus', {
    ...focusing,
    value: function (this: HTMLElement, options?: FocusOptions) {
      for (const modal of modals) {
        // Closed, or taken out of the page, a dialog leaves the rest alone.
        if (!modal.open || !modal.isConnected) modals.delete(modal)
        else if (!modal.contains(this)) return
      }
      focus.call(this, options)
    },
  })
  return () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showing)
    Object.defineProperty(HTMLElement.prototype, 'focus', focusing)
  }
}
