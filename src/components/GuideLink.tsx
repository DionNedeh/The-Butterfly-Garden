import type { MouseEvent } from 'react'
import { hashForRoute } from '../lib/routes'
import './guideLink.css'

/**
 * A small "What does this do?" link from a currency or meter to the part of
 * the Guide that explains it.
 *
 * A real link, so it can be opened in a new tab, but an ordinary click goes
 * through `onOpen`, which remembers the page it came from: the Guide then
 * offers a way back, and Android's back gesture returns there. Its name
 * adds the topic after the visible words, which come first so voice control
 * can say what it sees.
 */
export function GuideLink({
  section,
  topic,
  onOpen,
}: {
  /** The Guide section it opens at, as the address names it. */
  section: string
  /** What it explains, in words: "Sunlight", "Bond levels". */
  topic: string
  onOpen: (section: string) => void
}) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window, asked for with a modifier key, keeps the link's
    // own behaviour.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    onOpen(section)
  }
  return (
    <a
      className="guide-link"
      href={hashForRoute({ view: 'guide', section })}
      onClick={open}
      aria-label={`What does this do? ${topic}, in the Guide`}
    >
      What does this do?
    </a>
  )
}
