import type { KeyboardEvent } from 'react'
import type { OutfitSlot } from '../types'
import { ButterflySprite } from './sprites/ButterflySprite'

/**
 * A butterfly: the detailed SVG sprite. Given `onMeet` it is a button that
 * introduces itself (the garden's ButterflyCard, where petting lives now);
 * otherwise it is a picture.
 */
export function Butterfly({
  speciesId,
  label,
  className = '',
  onMeet,
  size = 96,
  outfit,
  flapping = true,
}: {
  speciesId: string
  label: string
  className?: string
  onMeet?: () => void
  size?: number
  outfit?: Partial<Record<OutfitSlot, string>>
  flapping?: boolean
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onMeet || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onMeet()
  }

  return (
    <div
      className={`butterfly ${onMeet ? 'pettable' : ''} ${className}`}
      role={onMeet ? 'button' : 'img'}
      aria-label={onMeet ? `Meet ${label}` : label}
      aria-haspopup={onMeet ? 'dialog' : undefined}
      tabIndex={onMeet ? 0 : undefined}
      onClick={onMeet}
      onKeyDown={handleKeyDown}
    >
      <ButterflySprite
        speciesId={speciesId}
        label={label}
        size={size}
        outfit={outfit}
        flapping={flapping}
      />
    </div>
  )
}
