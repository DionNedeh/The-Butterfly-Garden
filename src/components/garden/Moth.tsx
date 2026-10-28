import { useMediaQuery } from '../../hooks/useMediaQuery'
import { SpriteFrame, SpriteLayer } from '../sprites/SpriteFrame'
import './moth.css'

/** Decorative visitors, not species records or companions. */
export function Moth({ resting = false }: { resting?: boolean }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  if (reduced) return null
  return (
    <span className="plant-moth" aria-hidden="true">
      <SpriteFrame width={36} height={33} className={`moth-sprite ${resting ? 'moth-resting' : 'moth-hovering'}`}>
        <SpriteLayer viewBox="0 0 120 110" className="moth-wing-left">
          <path d={resting ? 'M59 45Q28 18 24 87L58 72Z' : 'M59 47Q37 14 8 31Q12 55 53 65Q24 65 27 85Q47 90 59 65Z'} fill={resting ? '#a89a80' : '#d9d2c0'} stroke="#615a50" strokeWidth="2" />
          <path d="M54 51 31 40M52 61 32 70" fill="none" stroke="#f1e8d1" strokeWidth="2" />
        </SpriteLayer>
        <SpriteLayer viewBox="0 0 120 110" className="moth-wing-right">
          <path d={resting ? 'M61 45Q92 18 96 87L62 72Z' : 'M61 47Q83 14 112 31Q108 55 67 65Q96 65 93 85Q73 90 61 65Z'} fill={resting ? '#a89a80' : '#d9d2c0'} stroke="#615a50" strokeWidth="2" />
          <path d="M66 51 89 40M68 61 88 70" fill="none" stroke="#f1e8d1" strokeWidth="2" />
        </SpriteLayer>
        <SpriteLayer viewBox="0 0 120 110">
          <ellipse cx="60" cy="60" rx="5" ry="20" fill="#6e6455" stroke="#e7ddc8" strokeWidth="1.5" />
          <circle cx="60" cy="38" r="6" fill="#b7aa91" />
          <path d="M57 35Q49 25 45 30M63 35Q71 25 75 30" fill="none" stroke="#e7ddc8" strokeWidth="2" strokeLinecap="round" />
        </SpriteLayer>
      </SpriteFrame>
    </span>
  )
}
