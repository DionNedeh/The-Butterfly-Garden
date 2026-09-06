import { memo, useId, type ReactNode } from 'react'
import type { OutfitSlot } from '../../types'

export interface OutfitAnchor {
  headX: number
  headY: number
  bodyX: number
  bodyY: number
  scale: number
}

function headwear(itemId: string): ReactNode {
  switch (itemId) {
    case 'sprout-cap':
      return (
        <g>
          <path d="M-7 0 A7 5 0 0 1 7 0 L6 2 L-6 2 Z" fill="#5f9860" stroke="#376238" strokeWidth="0.8" />
          <path d="M0 -4 C0 -8 3 -10 5 -10 C5 -7 3 -5 1 -4 Z" fill="#7db97a" />
          <path d="M0 -4 C0 -8 -3 -10 -5 -10 C-5 -7 -3 -5 -1 -4 Z" fill="#8fca8b" />
        </g>
      )
    case 'flower-crown':
      return (
        <g>
          <path d="M-8 0 A8 4 0 0 1 8 0" stroke="#5f8a4f" strokeWidth="1.6" fill="none" />
          {[-7, -3.5, 0, 3.5, 7].map((x, index) => (
            <g key={x} transform={`translate(${x} ${index % 2 ? -2.6 : -1.4})`}>
              {[0, 72, 144, 216, 288].map((angle) => (
                <ellipse
                  key={angle}
                  cx="0"
                  cy="-1.7"
                  rx="0.9"
                  ry="1.7"
                  fill={index % 2 ? '#f7f0f9' : '#f2d9e6'}
                  transform={`rotate(${angle})`}
                />
              ))}
              <circle r="1" fill="#e7b445" />
            </g>
          ))}
        </g>
      )
    case 'tiny-tophat':
      return (
        <g>
          <rect x="-7" y="-1" width="14" height="2.4" rx="1.2" fill="#2d2a33" />
          <rect x="-4.5" y="-9" width="9" height="8.4" rx="1.2" fill="#3a3644" />
          <rect x="-4.5" y="-3.4" width="9" height="2.2" fill="#8a5db0" />
        </g>
      )
    case 'acorn-beret':
      return (
        <g>
          <path d="M-6.5 0 C-6.5 -6 6.5 -6 6.5 0 L5.6 1 L-5.6 1 Z" fill="#8a6238" stroke="#5f4023" strokeWidth="0.8" />
          <path d="M0 -5 L1.4 -8" stroke="#5f4023" strokeWidth="1.4" />
        </g>
      )
    case 'star-diadem':
      return (
        <g>
          <path d="M-7 1 A7 4 0 0 1 7 1" stroke="#e8d48a" strokeWidth="1.4" fill="none" />
          <path d="M0 -6 L1.3 -2.6 L4.8 -2.6 L2 -0.5 L3 3 L0 0.9 L-3 3 L-2 -0.5 L-4.8 -2.6 L-1.3 -2.6 Z" fill="#f5e4a3" stroke="#d4b358" strokeWidth="0.5" />
        </g>
      )
    case 'moonlit-halo':
      return (
        <g>
          <ellipse cx="0" cy="-8" rx="8.5" ry="2.6" fill="none" stroke="#e8e2b8" strokeWidth="1.8" opacity="0.95" />
          <ellipse cx="0" cy="-8" rx="8.5" ry="2.6" fill="none" stroke="#fdfaf0" strokeWidth="0.7" />
          <circle cx="6.4" cy="-9.2" r="0.8" fill="#fdfaf0" />
        </g>
      )
    case 'royal-crown':
      return (
        <g>
          <path d="M-7 2 L-7 -5 L-3.5 -1.5 L0 -7 L3.5 -1.5 L7 -5 L7 2 Z" fill="#e7b445" stroke="#a87716" strokeWidth="0.9" />
          <circle cx="0" cy="-1" r="1.3" fill="#c94f6d" />
        </g>
      )
    default:
      return null
  }
}

function accessory(itemId: string): ReactNode {
  switch (itemId) {
    case 'silk-bow':
      return (
        <g>
          <path d="M0 0 L-6 -3.6 L-6 3.6 Z" fill="#d96f9f" stroke="#8f3c63" strokeWidth="0.7" />
          <path d="M0 0 L6 -3.6 L6 3.6 Z" fill="#d96f9f" stroke="#8f3c63" strokeWidth="0.7" />
          <circle r="1.7" fill="#b34e7d" />
        </g>
      )
    case 'leaf-scarf':
      return (
        <g>
          <path d="M-6 0 A6 3.4 0 0 0 6 0 A6 5 0 0 1 -6 0 Z" fill="#6f9d5c" stroke="#42663a" strokeWidth="0.7" />
          <path d="M3 2 C4.4 5 4 8 3 10 L1 9 C2 7 2.4 4.6 1.8 2.6 Z" fill="#7fae6a" />
        </g>
      )
    case 'dew-pendant':
      return (
        <g>
          <path d="M-5 -1 A5 3 0 0 0 5 -1" stroke="#8ba372" strokeWidth="0.9" fill="none" />
          <path d="M0 2 C-2.2 4.4 -2.2 6.6 0 7.8 C2.2 6.6 2.2 4.4 0 2 Z" fill="#a8d8ef" stroke="#5f9dc0" strokeWidth="0.7" />
          <circle cx="-0.7" cy="4.6" r="0.7" fill="#eaf7fd" />
        </g>
      )
    case 'seed-satchel':
      return (
        <g>
          <path d="M-6 -2 C-2 1 2 1 6 -2" stroke="#8a6238" strokeWidth="1" fill="none" />
          <rect x="3" y="-2" width="6" height="6.5" rx="1.6" fill="#b98c53" stroke="#7c5a30" strokeWidth="0.8" />
          <path d="M3 0.4 L9 0.4" stroke="#7c5a30" strokeWidth="0.7" />
        </g>
      )
    case 'moonstone-charm':
      return (
        <g>
          <path d="M-4.5 -1 A4.5 2.6 0 0 0 4.5 -1" stroke="#9a94b8" strokeWidth="0.8" fill="none" />
          <circle cx="0" cy="3.4" r="2.6" fill="#dcd9f2" stroke="#8f88bb" strokeWidth="0.8" />
          <path d="M1 2 A2 2 0 0 0 -1 4.8 A2.6 2.6 0 0 1 1 2 Z" fill="#b4aede" />
        </g>
      )
    case 'comet-brooch':
      return (
        <g>
          <path d="M1.5 2 L2.6 4.6 L5.4 4.9 L3.4 6.8 L4 9.5 L1.5 8.1 L-1 9.5 L-0.4 6.8 L-2.4 4.9 L0.4 4.6 Z" fill="#f2e18f" stroke="#c9ab4e" strokeWidth="0.5" />
          <path d="M-2 3.6 C-4.4 2.4 -6.4 0.8 -7.6 -1" stroke="#e8dcb0" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
          <path d="M-1 5.4 C-3.6 4.8 -5.8 3.6 -7.4 2" stroke="#e8dcb0" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </g>
      )
    case 'celestial-cape':
      return (
        <g>
          <path d="M-6 -1 C-9 6 -7 14 -3 18 L3 18 C7 14 9 6 6 -1 C2 2 -2 2 -6 -1 Z" fill="#2c2a52" stroke="#1c1a38" strokeWidth="0.8" opacity="0.92" />
          {[
            [-3, 6],
            [2, 10],
            [-1, 14],
            [4, 4],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.75" fill="#e8e2a8" />
          ))}
        </g>
      )
    default:
      return null
  }
}

function aura(itemId: string, glow: string): ReactNode {
  switch (itemId) {
    case 'sparkle-aura':
      return (
        <g className="aura aura-sparkle">
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <path
              key={angle}
              d="M0 -46 L1.6 -42.6 L5 -42.6 L2.4 -40.4 L3.4 -37 L0 -39 L-3.4 -37 L-2.4 -40.4 L-5 -42.6 L-1.6 -42.6 Z"
              fill="#f2d979"
              opacity="0.9"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
      )
    case 'petal-swirl':
      return (
        <g className="aura aura-petals">
          {[20, 110, 200, 290].map((angle) => (
            <ellipse
              key={angle}
              cx="0"
              cy="-44"
              rx="3"
              ry="5"
              fill="#f0b9cf"
              stroke="#c886a5"
              strokeWidth="0.6"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
      )
    case 'firefly-glow':
      return (
        <g className="aura aura-fireflies">
          {[45, 225].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <circle cx="0" cy="-42" r="2.4" fill="#f5e08a" opacity="0.95" />
              <circle cx="0" cy="-42" r="5" fill="#f5e08a" opacity="0.25" />
            </g>
          ))}
        </g>
      )
    case 'aurora-aura':
    case 'rainbow-trail':
      return (
        <g className="aura aura-aurora">
          <circle r="46" fill="none" stroke={glow} strokeWidth="3" opacity="0.5" />
        </g>
      )
    default:
      return null
  }
}

/**
 * Renders equipped cosmetics on a creature sprite. The anchor tells the
 * overlay where the head and chest sit inside the parent SVG's viewBox.
 */
export const OutfitOverlay = memo(function OutfitOverlay({
  outfit,
  anchor,
  hideAccessory = false,
}: {
  outfit: Partial<Record<OutfitSlot, string>>
  anchor: OutfitAnchor
  /** Suppress neck/chest accessories (e.g. caterpillars, where they don't fit). */
  hideAccessory?: boolean
}) {
  const { headX, headY, bodyX, bodyY, scale } = anchor
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const glowId = `auraglow-${uid}`
  return (
    <g className="outfit-overlay" aria-hidden="true">
      {outfit.aura && (
        <>
          {/* Defined here so the aura works on every life stage, not only
              inside the butterfly sprite that used to own this gradient. */}
          <defs>
            <radialGradient id={glowId} cx="40%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#9adcff" />
              <stop offset="100%" stopColor="#168bd2" />
            </radialGradient>
          </defs>
          <g transform={`translate(${bodyX} ${bodyY}) scale(${scale})`}>
            {aura(outfit.aura, `url(#${glowId})`)}
          </g>
        </>
      )}
      {!hideAccessory && outfit.accessory && (
        <g transform={`translate(${bodyX} ${bodyY}) scale(${scale})`}>
          {accessory(outfit.accessory)}
        </g>
      )}
      {outfit.headwear && (
        <g transform={`translate(${headX} ${headY - 4}) scale(${scale})`}>
          {headwear(outfit.headwear)}
        </g>
      )}
    </g>
  )
})
