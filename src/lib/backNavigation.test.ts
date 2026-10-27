import { afterEach, describe, expect, it, vi } from 'vitest'
import { backAction, putBackAt, requestDialogClose, requestDismiss } from './backNavigation'

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

  it('returns breathing to the page that offered it, or else the garden', () => {
    expect(backAction('breathe', document, 'today')).toEqual({ kind: 'view', view: 'today' })
    expect(backAction('breathe', document, 'support')).toEqual({ kind: 'view', view: 'support' })
    // Opened from a link or a reload, it knows of no page before it.
    expect(backAction('breathe')).toEqual({ kind: 'view', view: 'garden' })
    expect(backAction('breathe', document, 'breathe')).toEqual({ kind: 'view', view: 'garden' })
  })

  it('returns a year looked back on to the page that opened it, or else the Journal', () => {
    expect(backAction('year', document, 'journal')).toEqual({ kind: 'view', view: 'journal' })
    // Opened from a link or a reload, it goes back to the Journal, where it lives.
    expect(backAction('year')).toEqual({ kind: 'view', view: 'journal' })
    expect(backAction('year', document, 'year')).toEqual({ kind: 'view', view: 'journal' })
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

describe('putBackAt', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  /** A page with a heading and two "What does this do?" links far down it. */
  function page() {
    document.body.innerHTML = `
      <main id="main-content">
        <h1>Settings</h1>
        <a class="guide-link" href="#/guide/moonlight">What does this do?</a>
        <a class="guide-link" href="#/guide/seeds">What does this do?</a>
      </main>`
    return {
      heading: document.querySelector('h1')!,
      seeds: document.querySelector<HTMLElement>('a[href="#/guide/seeds"]')!,
    }
  }

  it('scrolls back to where the page was and focuses the link pressed', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const { seeds } = page()
    putBackAt({ section: 'seeds', scrollY: 1200 })
    expect(scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'instant' })
    expect(seeds).toHaveFocus()
  })

  it('focuses the page’s heading when the link has gone, never the page itself', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const { heading } = page()
    putBackAt({ section: 'region', scrollY: 900 })
    expect(heading).toHaveFocus()
    expect(heading).toHaveAttribute('tabindex', '-1')
  })

  it('does nothing more than scroll on a page with neither', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    putBackAt({ section: 'seeds', scrollY: 40 })
    expect(scrollTo).toHaveBeenCalledOnce()
    expect(document.body).toHaveFocus()
  })
})

describe('putBackAt, back from breathing', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  /**
   * Today as breathing leaves it: two breathing goals, one of them done (its
   * link gone, its ⋯ menu still there), and a check-in already saved.
   */
  function today() {
    document.body.innerHTML = `
      <main id="main-content">
        <h1>Today</h1>
        <button class="primary-button check-in-save">Update check-in</button>
        <article class="goal-row" data-goal-id="a&quot;]">
          <a class="breathe-link" href="#/breathe">Breathe now</a>
          <button class="goal-menu-button">More for Take three slow breaths</button>
        </article>
        <article class="goal-row complete" data-goal-id="done">
          <button class="goal-menu-button">More for Breathe slowly</button>
        </article>
      </main>`
    return {
      heading: document.querySelector('h1')!,
      save: document.querySelector<HTMLElement>('.check-in-save')!,
      link: document.querySelector<HTMLElement>('a.breathe-link')!,
      doneMenu: document.querySelector<HTMLElement>('[data-goal-id="done"] .goal-menu-button')!,
    }
  }

  it('focuses the "Breathe now" of the goal it was, found by the goal however it is named', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const { link } = today()
    putBackAt({ breathe: 'goal', goalId: 'a"]', scrollY: 2315 })
    expect(scrollTo).toHaveBeenCalledWith({ top: 2315, behavior: 'instant' })
    expect(link).toHaveFocus()
  })

  it('falls back to the goal’s ⋯ menu once it is done, and to the heading once it is gone', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const { doneMenu, heading } = today()
    putBackAt({ breathe: 'goal', goalId: 'done', scrollY: 600 })
    expect(doneMenu).toHaveFocus()
    putBackAt({ breathe: 'goal', goalId: 'deleted', scrollY: 600 })
    expect(heading).toHaveFocus()
  })

  it('stands the check-in in for the step offered after it, which goes once taken', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const { save } = today()
    putBackAt({ breathe: 'next-step', scrollY: 700 })
    expect(save).toHaveFocus()
  })

  it('focuses Today’s heading back from the recap, collected on the way', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const { heading } = today()
    putBackAt({ breathe: 'recap', scrollY: 0 })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(heading).toHaveFocus()
  })

  it('focuses the support page’s own link', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    document.body.innerHTML = `
      <main id="main-content">
        <h1>If you need support now</h1>
        <p>If a quiet minute would help, you can
          <a class="breathe-link" href="#/breathe">breathe with Marigold</a>.</p>
      </main>`
    putBackAt({ breathe: 'support', scrollY: 1400 })
    expect(document.querySelector('a.breathe-link')).toHaveFocus()
  })
})
