import type { MouseEvent } from 'react'
import { hashForRoute } from '../lib/routes'
import './comfort/comfortLink.css'

/**
 * A quiet way to the comfort plan (plan c.8): from the support page,
 * Settings, and Today while a day is gentle. Never anywhere it would read as
 * a prompt to fill the plan in.
 *
 * A real link to the page, like BreatheLink, but an ordinary click goes
 * through `onOpen`, which remembers the page it came from so the plan's
 * page, and Android's back gesture, can return there.
 */
export function ComfortLink({ children, onOpen }: { children: string; onOpen: () => void }) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window, asked for with a modifier key, keeps the link's
    // own behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    onOpen()
  }
  return (
    <a className="comfort-link" href={hashForRoute({ view: 'comfort' })} onClick={open}>
      {children}
    </a>
  )
}
