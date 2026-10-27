import type { AppView } from '../types'
import { hashForRoute, type LinkPlace } from './routes'

/** What Android's back gesture should do, given where the gardener is. */
export type BackAction =
  | { kind: 'close-dialog'; dialog: HTMLDialogElement }
  | { kind: 'dismiss'; element: HTMLElement }
  | { kind: 'view'; view: AppView }
  | { kind: 'leave' }

/**
 * Back walks out one layer at a time: the top open dialog, then anything
 * open in place that Escape would put away (a goal's ⋯ menu, the goal
 * editor; each carries `data-dismiss-on-back`), then a page that
 * was opened from another page back to it (the Moonlight recap to Today; the
 * privacy policy, the notices and the support page to Settings; the Guide,
 * opened by a "What does this do?" link, breathing with a butterfly and the
 * comfort plan, to the page `from` that opened them), then any other page
 * back to the garden.
 * Only from the garden itself does it leave the app.
 */
export function backAction(
  view: AppView | undefined,
  root: ParentNode = document,
  from?: AppView,
): BackAction {
  const open = root.querySelectorAll<HTMLDialogElement>('dialog[open]')
  const top = open.item(open.length - 1) as HTMLDialogElement | null
  if (top) return { kind: 'close-dialog', dialog: top }
  const layer = root.querySelector<HTMLElement>('[data-dismiss-on-back]')
  if (layer) return { kind: 'dismiss', element: layer }
  if (view === 'recap') return { kind: 'view', view: 'today' }
  if ((view === 'guide' || view === 'breathe' || view === 'comfort') && from && from !== view)
    return { kind: 'view', view: from }
  if (view === 'privacy' || view === 'notices' || view === 'support')
    return { kind: 'view', view: 'settings' }
  if (view && view !== 'garden') return { kind: 'view', view: 'garden' }
  return { kind: 'leave' }
}

/**
 * Put away something open in place exactly as Escape would, so it closes
 * through its own handler and returns focus where that handler puts it.
 */
export function requestDismiss(element: HTMLElement): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

/**
 * Close a dialog exactly as the Escape key would: through its cancel event,
 * so a dialog that must not close yet (an image still saving) can refuse,
 * and one that tracks its own open state hears about it.
 */
export function requestDialogClose(dialog: HTMLDialogElement): void {
  const proceed = dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
  if (proceed) dialog.close()
}

/**
 * Put the gardener back where they pressed a "What does this do?" link, once
 * its page is drawn again: scrolled as it was, with focus on that link, so
 * the Back button that took them there (gone with the Guide) leaves focus
 * somewhere. If the link has gone since (a region cleared in another tab),
 * focus goes to the page's heading, never to the page itself.
 */
export function putBackAt(place: LinkPlace, root: ParentNode = document): void {
  window.scrollTo({ top: place.scrollY, behavior: 'instant' })
  const link = root.querySelector<HTMLElement>(
    `a.guide-link[href="${hashForRoute({ view: 'guide', section: place.section })}"]`,
  )
  const target = link ?? root.querySelector<HTMLElement>('#main-content h1')
  if (!target) return
  if (target !== link && !target.hasAttribute('tabindex')) target.tabIndex = -1
  // Not kept from scrolling: should the page have grown or shrunk since, the
  // link is brought into view rather than focused out of sight.
  target.focus()
}
