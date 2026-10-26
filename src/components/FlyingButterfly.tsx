import { useFlightMotion } from '../hooks/useFlightMotion'
import type { FlightPatternId, OutfitSlot } from '../types'
import { Butterfly } from './Butterfly'

export function FlyingButterfly({
  id,
  pattern,
  index = 0,
  speciesId = 'monarch',
  label = 'Butterfly',
  outfit,
  reduced = false,
  calm = false,
  settled = false,
  preview = false,
}: {
  id: string
  pattern: FlightPatternId
  index?: number
  speciesId?: string
  label?: string
  outfit?: Partial<Record<OutfitSlot, string>>
  reduced?: boolean
  /** Calm motion: a smaller, slower loop (see lib/motion). */
  calm?: boolean
  /** Resting in calm motion: at its static pose, wings still. */
  settled?: boolean
  preview?: boolean
}) {
  const size = preview ? 48 : 96
  const { travel, heading } = useFlightMotion(
    id,
    pattern,
    index,
    size,
    reduced || settled,
    preview,
    calm,
  )
  return (
    <div
      ref={travel}
      className="flight-traveller"
      data-pattern={pattern}
      aria-hidden={preview || undefined}
    >
      <div ref={heading} className="flight-heading">
        <Butterfly
          speciesId={speciesId}
          label={label}
          outfit={outfit}
          size={size}
          pettable={!preview}
          flapping={!settled}
        />
      </div>
    </div>
  )
}

export function FlightPreview({
  pattern,
  reduced = false,
  calm = false,
}: {
  pattern: FlightPatternId
  reduced?: boolean
  calm?: boolean
}) {
  return (
    <div className="motion-preview" aria-hidden="true">
      <span className="motion-orbit" />
      <FlyingButterfly
        id={`preview-${pattern}`}
        pattern={pattern}
        reduced={reduced}
        calm={calm}
        preview
      />
    </div>
  )
}
