import { useState, type KeyboardEvent } from 'react'
import type { CreatureStage, OutfitSlot } from '../types'
import { CreatureSprite } from './sprites/CreatureSprite'

/**
 * Any life stage, pettable: tap the egg, caterpillar, chrysalis, or
 * butterfly and it answers with the same burst of hearts as the garden
 * butterflies.
 */
export function PettableCreature({
  speciesId,
  stage,
  label,
  size = 96,
  outfit,
  className = '',
}: {
  speciesId: string
  stage: CreatureStage
  label: string
  size?: number
  outfit?: Partial<Record<OutfitSlot, string>>
  className?: string
}) {
  const [petCount, setPetCount] = useState(0)
  const pet = () => setPetCount((count) => count + 1)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    pet()
  }

  return (
    <div
      className={`butterfly pettable ${className}`}
      role="button"
      aria-label={`Pet ${label}`}
      tabIndex={0}
      onClick={pet}
      onKeyDown={handleKeyDown}
    >
      <CreatureSprite
        speciesId={speciesId}
        stage={stage}
        label={label}
        size={size}
        outfit={outfit}
      />
      {petCount > 0 && (
        <span className="heart-burst" key={petCount} aria-hidden="true">
          <span>♥</span>
          <span>♥</span>
          <span>♥</span>
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {petCount > 0 ? `${label} enjoyed that gentle hello.` : ''}
      </span>
    </div>
  )
}
