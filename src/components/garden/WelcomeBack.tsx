import { useId, useState } from 'react'
import { welcomeBackLine } from '../../lib/welcomeBack'
import type { AppState } from '../../types'
import './welcomeBack.css'

/**
 * The garden's small welcome after a few days away (lib/visits): one line
 * about something it holds, in the page and never over it. It gives nothing
 * and asks nothing; "Put away" is the only thing to do with it. Loaded only
 * on such a day, so the garden's first load carries none of it.
 */
export function WelcomeBack({
  garden,
  returnedOn,
  onPutAway,
}: {
  garden: Pick<AppState, 'plants' | 'creatures'>
  /** The day of the return, which the line is chosen by. */
  returnedOn: string
  onPutAway: () => void
}) {
  const titleId = useId()
  // Chosen when the card appears: planting a seed or naming a companion
  // while it is out should not change what it said, or say it again.
  const [line] = useState(() => welcomeBackLine(garden, returnedOn))
  return (
    <div className="card welcome-back" role="group" aria-labelledby={titleId}>
      <span className="welcome-back-spark" aria-hidden="true">
        ✦
      </span>
      <div className="welcome-back-words">
        <p id={titleId} className="eyebrow">
          Welcome back
        </p>
        <p className="welcome-back-line">{line}</p>
      </div>
      <button type="button" className="text-button welcome-back-dismiss" onClick={onPutAway}>
        Put away
      </button>
    </div>
  )
}
