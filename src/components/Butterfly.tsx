import { useState, type KeyboardEvent } from 'react'
import type { OutfitSlot } from '../types'
import { ButterflySprite } from './sprites/ButterflySprite'

/**
 * Interactive butterfly: renders the detailed SVG sprite and, when
 * pettable, answers taps with a little burst of hearts.
 */
export function Butterfly({
  speciesId,
  label,
  className = '',
  pettable = false,
  size = 96,
  outfit,
}: {
  speciesId: string
  label: string
  className?: string
  pettable?: boolean
  size?: number
  outfit?: Partial<Record<OutfitSlot, string>>
}) {
  const [petCount, setPetCount] = useState(0)
  const pet = () => {
    if (pettable) setPetCount((count) => count + 1)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!pettable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    pet()
  }

  return (
    <div
      className={`butterfly ${pettable ? 'pettable' : ''} ${className}`}
      role={pettable ? 'button' : 'img'}
      aria-label={pettable ? `Pet ${label}` : label}
      tabIndex={pettable ? 0 : undefined}
      onClick={pet}
      onKeyDown={handleKeyDown}
    >
      <ButterflySprite speciesId={speciesId} label={label} size={size} outfit={outfit} />
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
