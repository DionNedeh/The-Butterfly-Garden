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
  preview = false,
}: {
  id: string
  pattern: FlightPatternId
  index?: number
  speciesId?: string
  label?: string
  outfit?: Partial<Record<OutfitSlot, string>>
  reduced?: boolean
  preview?: boolean
}) {
  const size = preview ? 48 : 96
  const { travel, heading } = useFlightMotion(
    id,
    pattern,
    index,
    size,
    reduced,
    preview,
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
        />
      </div>
    </div>
  )
}

export function FlightPreview({
  pattern,
  reduced = false,
}: {
  pattern: FlightPatternId
  reduced?: boolean
}) {
  return (
    <div className="motion-preview" aria-hidden="true">
      <span className="motion-orbit" />
      <FlyingButterfly
        id={`preview-${pattern}`}
        pattern={pattern}
        reduced={reduced}
        preview
      />
    </div>
  )
}
