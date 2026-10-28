import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// Unmount between tests so one render cannot be found by the next one.
afterEach(() => {
  cleanup()
})

// jsdom has no modal dialogs. Open and close them the way a browser does, so
// components built on <dialog> can be tested like any other.
if (typeof HTMLDialogElement !== 'undefined') {
  const dialog = HTMLDialogElement.prototype
  if (!Reflect.has(dialog, 'showModal'))
    dialog.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  if (!Reflect.has(dialog, 'show'))
    dialog.show = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  if (!Reflect.has(dialog, 'close'))
    dialog.close = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
}
