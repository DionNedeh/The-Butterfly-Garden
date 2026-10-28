import { formatDayInWords } from '../../lib/fieldNotes'
import type { WildRecord } from '../../lib/sightings'
import './sightings.css'

/**
 * A pressed-flower stamp, drawn here rather than shipped as an image: the
 * mark a butterfly or plant earns in the field notes once it has been seen
 * in the wild. Decoration only; the line beside it says what it means.
 */
export function PressedFlower() {
  return (
    <svg
      className="pressed-flower"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="pressed-flower-ring"
        cx="12"
        cy="12"
        r="10.6"
        strokeDasharray="2.2 1.4"
      />
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          className="pressed-flower-petal"
          cx="12"
          cy="7.7"
          rx="2.4"
          ry="3.5"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle className="pressed-flower-heart" cx="12" cy="12" r="1.9" />
    </svg>
  )
}

/**
 * "Seen in the wild on 3 March 2026", with how many times when more than
 * once, beside a field-note card's "Welcomed in your garden". Nothing at all
 * for a butterfly or plant not yet seen. `subject` names a plant on a
 * butterfly's card, so the line is not read as the butterfly's.
 */
export function SeenInTheWild({ seen, subject }: { seen?: WildRecord; subject?: string }) {
  if (!seen) return null
  const when = `${subject ? 'seen' : 'Seen'} in the wild on ${formatDayInWords(seen.latest)}`
  return (
    <p className="seen-in-wild">
      <PressedFlower />
      <span>
        {subject && <strong>{subject}: </strong>}
        {when}
        {seen.count > 1 && ` (${seen.count} times)`}
      </span>
    </p>
  )
}
