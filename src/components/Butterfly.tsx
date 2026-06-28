import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { getSpecies } from '../lib/progression'

export function Butterfly({
  speciesId,
  label,
  className = '',
  pettable = false,
}: {
  speciesId: string
  label: string
  className?: string
  pettable?: boolean
}) {
  const definition = getSpecies(speciesId)
  const [petCount, setPetCount] = useState(0)
  const style = {
    '--wing-primary': definition?.wingColors[0] ?? '#e87832',
    '--wing-secondary': definition?.wingColors[1] ?? '#27231f',
  } as CSSProperties
  const visualClass = definition
    ? `species-${definition.id} pattern-${definition.visualPattern} shape-${definition.wingShape}`
    : ''
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
      className={`butterfly butterfly-profile ${visualClass} ${pettable ? 'pettable' : ''} ${className}`}
      style={style}
      role={pettable ? 'button' : 'img'}
      aria-label={pettable ? `Pet ${label}` : label}
      tabIndex={pettable ? 0 : undefined}
      onClick={pet}
      onKeyDown={handleKeyDown}
    >
      <span className="butterfly-body" />
      <span className="profile-wing profile-wing-back" />
      <span className="profile-wing profile-wing-front" />
      <span className="antenna antenna-one" />
      <span className="antenna antenna-two" />
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
