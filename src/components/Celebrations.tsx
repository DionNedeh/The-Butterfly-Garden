import { useEffect, useState } from 'react'
import { onAnnouncement } from '../lib/announcer'
import { describeEvent } from '../lib/gardenEvents'

/** How long a celebration stays on screen. */
export const CELEBRATION_MS = 5000

/**
 * Marks the moments the Guide promises a little celebration for: a stage
 * change, a new egg, a bloom, a deeper bond. A polite live region always
 * exists, so a screen reader hears each one, and a small flourish shows it.
 * Reduced motion keeps the message and drops the movement (App.css).
 */
export function Celebrations() {
  const [message, setMessage] = useState<{ text: string; key: number }>()

  useEffect(
    () =>
      onAnnouncement((events) => {
        setMessage((previous) => ({
          text: events.map(describeEvent).join(' '),
          key: (previous?.key ?? 0) + 1,
        }))
      }),
    [],
  )

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(undefined), CELEBRATION_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  return (
    <div className="celebration-region" role="status" aria-live="polite">
      {message && (
        <p className="celebration-toast" key={message.key}>
          <span className="celebration-spark" aria-hidden="true">
            ✦
          </span>
          {message.text}
        </p>
      )}
    </div>
  )
}
