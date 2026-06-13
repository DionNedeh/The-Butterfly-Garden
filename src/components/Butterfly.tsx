import type { CSSProperties } from 'react'
import { getSpecies } from '../lib/progression'

export function Butterfly({
  speciesId,
  label,
  className = '',
}: {
  speciesId: string
  label: string
  className?: string
}) {
  const definition = getSpecies(speciesId)
  const style = {
    '--wing-primary': definition?.wingColors[0] ?? '#e87832',
    '--wing-secondary': definition?.wingColors[1] ?? '#27231f',
  } as CSSProperties
  return (
    <div
      className={`butterfly ${className}`}
      style={style}
      role="img"
      aria-label={label}
    >
      <span className="wing wing-left" />
      <span className="butterfly-body" />
      <span className="wing wing-right" />
    </div>
  )
}
