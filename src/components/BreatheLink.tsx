import type { MouseEvent } from 'react'
import { hashForRoute } from '../lib/routes'
import './breathe/breatheLink.css'

/**
 * A quiet way into breathing with a butterfly (plan c.1), where it helps: a
 * breathing goal on Today, and the support page.
 *
 * A real link to the page, like GuideLink, but an ordinary click goes
 * through `onOpen`, which remembers the page it came from so the breathing
 * page, and Android's back gesture, can return there.
 */
export function BreatheLink({ children, onOpen }: { children: string; onOpen: () => void }) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window, asked for with a modifier key, keeps the link's
    // own behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    onOpen()
  }
  return (
    <a className="breathe-link" href={hashForRoute({ view: 'breathe' })} onClick={open}>
      {children}
    </a>
  )
}
