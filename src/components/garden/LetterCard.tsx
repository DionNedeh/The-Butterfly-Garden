import { useId } from 'react'
import { useLatestLetter } from '../../hooks/useLatestLetter'
import { isLetterWaiting } from '../../lib/letterTiming'
import type { Profile } from '../../types'
import './letterCard.css'

/** An envelope, drawn beside the words; the words say everything it does. */
function Envelope() {
  return (
    <svg
      className="letter-card-envelope"
      viewBox="0 0 24 24"
      width="26"
      height="26"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="5.5" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m3.8 7 8.2 6 8.2-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The garden's note that Marigold's weekly letter is waiting (lib/letters),
 * from Sunday evening until it is read, put away, or the next one replaces
 * it; nothing at all otherwise. In the page, never over it, and it asks
 * nothing: the letter itself is in the Journal. It works out for itself
 * whether a letter waits, and is loaded once the garden is drawn, so the
 * garden's first load carries none of it.
 */
export function LetterCard({
  profile,
  onRead,
  onPutAway,
}: {
  profile: Profile | undefined
  /** Open the letter in the Journal. */
  onRead: () => void
  /** Stop saying the letter for the week ending on this Sunday is waiting; it stays in the Journal. */
  onPutAway: (sunday: string) => void
}) {
  const titleId = useId()
  const latest = useLatestLetter(profile)
  if (!isLetterWaiting(profile, latest)) return null
  return (
    <section className="card letter-card" aria-labelledby={titleId}>
      <Envelope />
      <div className="letter-card-words">
        <h2 id={titleId}>A letter from Marigold is waiting</h2>
        <p>A few lines about your week, kept in your journal.</p>
      </div>
      <div className="letter-card-actions">
        <button type="button" className="secondary-button" onClick={onRead}>
          Read the letter
        </button>
        <button
          type="button"
          className="text-button letter-card-dismiss"
          onClick={() => onPutAway(latest)}
        >
          Put away
        </button>
      </div>
    </section>
  )
}
