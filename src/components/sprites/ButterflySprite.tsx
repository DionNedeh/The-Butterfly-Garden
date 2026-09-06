import { memo, useId, type ReactNode } from 'react'
import { getSpecies } from '../../lib/progression'
import type { ButterflyWingShape, OutfitSlot } from '../../types'
import { OutfitOverlay, type OutfitAnchor } from './OutfitOverlay'

/**
 * Detailed SVG butterfly, drawn in a spread (top-down) pose.
 *
 * Coordinate space: viewBox 0 0 120 110, body centered on x=60. The left
 * wing is drawn explicitly; the right wing mirrors it. Each species keeps
 * its real silhouette (swallowtail tails, longwing panels, ragged edges...)
 * and a hand-tuned marking layer approximating its actual pattern.
 */

interface WingPaths {
  fore: string
  hind: string
}

const wingShapes: Record<ButterflyWingShape, WingPaths> = {
  rounded: {
    fore: 'M58 46 C44 20 24 8 12 12 C2 16 4 34 16 44 C28 54 44 54 58 50 Z',
    hind: 'M58 52 C42 52 26 56 18 66 C10 76 16 92 30 92 C44 92 56 74 58 58 Z',
  },
  swallowtail: {
    fore: 'M58 46 C46 18 26 4 12 8 C0 12 2 32 14 44 C28 56 46 54 58 50 Z',
    hind: 'M58 52 C42 52 28 58 22 68 C16 78 20 86 26 88 C28 94 24 102 27 105 C31 104 34 96 36 91 C48 90 56 72 58 58 Z',
  },
  longwing: {
    fore: 'M58 46 C48 30 24 12 8 16 C-2 20 4 34 18 42 C32 50 48 52 58 50 Z',
    hind: 'M58 52 C44 52 30 56 24 64 C18 72 24 84 36 84 C48 84 56 70 58 58 Z',
  },
  small: {
    fore: 'M58 46 C48 26 32 16 22 20 C12 24 16 38 26 46 C36 53 50 52 58 50 Z',
    hind: 'M58 52 C46 52 36 56 32 64 C28 72 34 82 44 81 C53 80 57 68 58 58 Z',
  },
  ragged: {
    fore: 'M58 46 C50 28 34 10 18 12 L20 18 L12 18 C6 24 8 32 14 38 L20 38 L18 44 C30 52 46 53 58 50 Z',
    hind: 'M58 52 C44 52 30 56 22 64 L27 68 L20 74 C18 82 24 90 32 90 L34 84 L40 88 C50 84 56 70 58 58 Z',
  },
  broad: {
    fore: 'M58 46 C46 18 22 6 10 12 C0 18 4 36 18 46 C32 55 48 54 58 50 Z',
    hind: 'M58 52 C42 52 24 56 16 68 C10 78 18 92 32 92 C46 91 56 74 58 58 Z',
  },
  clear: {
    fore: 'M58 46 C46 24 28 12 16 16 C6 20 8 36 20 44 C32 52 48 53 58 50 Z',
    hind: 'M58 52 C44 52 32 56 26 64 C20 74 26 86 38 86 C50 85 56 70 58 58 Z',
  },
}

/** Species markings, drawn once for the left wing and mirrored. */
function wingMarkings(
  pattern: string,
  secondary: string,
  clip: string,
  glow: string,
): ReactNode {
  switch (pattern) {
    case 'monarch-veins':
      return (
        <g clipPath={clip}>
          {/* black veins radiating through the orange */}
          {[
            'M58 48 L14 14',
            'M58 48 L8 26',
            'M58 48 L16 42',
            'M58 55 L22 62',
            'M58 55 L26 78',
            'M58 55 L36 89',
          ].map((d) => (
            <path key={d} d={d} stroke={secondary} strokeWidth="2.4" fill="none" />
          ))}
          {/* dark margins with white spots */}
          <path
            d="M58 46 C46 18 26 4 10 10 C0 16 2 34 14 46 L20 40 C10 32 8 20 16 16 C28 12 44 24 54 48 Z"
            fill={secondary}
          />
          <path
            d="M58 58 C56 74 46 92 30 92 C18 92 12 78 18 68 L24 72 C20 78 24 86 31 86 C41 86 52 72 54 58 Z"
            fill={secondary}
          />
          {[
            [16, 14],
            [10, 24],
            [12, 36],
            [22, 82],
            [32, 88],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="#fdf6e3" />
          ))}
        </g>
      )
    case 'swallowtail-gold-spots':
      return (
        <g clipPath={clip}>
          {[
            [16, 38],
            [24, 44],
            [34, 48],
            [45, 50],
            [26, 74],
            [33, 66],
            [41, 60],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill={secondary} />
          ))}
          <circle cx="30" cy="82" r="3" fill="#d96f43" />
          <path d="M22 60 C30 56 42 55 54 55" stroke="#7da7d9" strokeWidth="2" fill="none" opacity="0.7" />
        </g>
      )
    case 'tiger-stripes':
      return (
        <g clipPath={clip}>
          {['M44 20 L52 48', 'M32 18 L44 46', 'M20 20 L34 44', 'M40 60 L46 80'].map(
            (d) => (
              <path key={d} d={d} stroke={secondary} strokeWidth="3.4" fill="none" />
            ),
          )}
          <path
            d="M58 46 C50 22 30 6 12 10 L14 18 C28 14 44 28 52 48 Z"
            fill={secondary}
          />
          <path d="M58 58 C56 76 44 94 28 92 L30 84 C40 86 50 72 54 58 Z" fill={secondary} />
          <circle cx="31" cy="87" r="2.6" fill="#e2694a" />
        </g>
      )
    case 'admiral-red-bands':
      return (
        <g clipPath={clip}>
          <path d="M8 34 C22 34 40 42 58 50" stroke={secondary} strokeWidth="6" fill="none" />
          <path d="M20 88 C30 78 44 66 58 60" stroke={secondary} strokeWidth="5" fill="none" />
          {[
            [18, 14],
            [26, 20],
            [12, 24],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="#f3ece0" />
          ))}
        </g>
      )
    case 'painted-mosaic':
      return (
        <g clipPath={clip}>
          <path d="M12 12 L28 16 L20 28 L34 30 L26 42 L44 44" stroke={secondary} strokeWidth="3" fill="none" />
          {[
            [16, 20],
            [28, 36],
            [30, 70],
            [38, 78],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill={secondary} />
          ))}
          {[
            [24, 84],
            [34, 86],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="#5b7ea6" />
          ))}
          <circle cx="14" cy="14" r="2" fill="#f3ece0" />
        </g>
      )
    case 'sulphur-blush':
      return (
        <g clipPath={clip}>
          <circle cx="34" cy="38" r="3" fill={secondary} opacity="0.85" />
          <path d="M58 46 C48 24 28 10 14 12 L16 18 C30 16 46 30 54 48 Z" fill={secondary} opacity="0.35" />
          <circle cx="36" cy="68" r="2.4" fill={secondary} opacity="0.6" />
        </g>
      )
    case 'morpho-shimmer':
      return (
        <g clipPath={clip}>
          <path d="M58 46 C46 18 22 6 10 12 C2 18 6 36 18 46 C32 55 48 54 58 50 Z" fill={glow} opacity="0.55" />
          <path
            d="M58 46 C46 18 22 6 10 12 C0 18 4 36 18 46 L22 40 C12 32 10 22 18 18 C30 14 46 28 54 48 Z"
            fill={secondary}
          />
          <path d="M58 58 C56 76 46 92 32 92 C20 92 12 80 18 70 L24 74 C20 80 26 86 33 86 C43 86 52 72 54 58 Z" fill={secondary} />
        </g>
      )
    case 'glasswing-clear':
      return (
        <g clipPath={clip}>
          <path d="M58 46 C46 24 28 12 16 16 C6 20 8 36 20 44 L24 38 C16 32 16 24 22 22 C32 20 46 30 54 48 Z" fill={secondary} />
          <path d="M58 58 C56 70 50 85 38 86 C26 86 20 74 26 64 L31 68 C28 74 32 80 39 80 C47 79 52 68 54 58 Z" fill={secondary} />
          <path d="M8 30 C20 34 40 44 58 50" stroke="#f4efe2" strokeWidth="1.6" fill="none" opacity="0.8" />
        </g>
      )
    case 'queen-pale-dots':
      return (
        <g clipPath={clip}>
          {[
            [20, 22],
            [30, 30],
            [16, 34],
            [40, 42],
            [28, 44],
            [34, 70],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" fill="#f0e4d2" />
          ))}
          <path
            d="M58 46 C46 18 26 6 12 10 C2 16 4 34 16 44 L21 39 C12 32 10 20 18 16 C30 12 44 26 54 48 Z"
            fill={secondary}
          />
        </g>
      )
    case 'fritillary-silver':
      return (
        <g clipPath={clip}>
          {[
            [24, 62],
            [32, 70],
            [28, 80],
            [38, 78],
          ].map(([cx, cy]) => (
            <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="3" ry="2.2" fill="#e8e4da" stroke={secondary} strokeWidth="0.8" />
          ))}
          {['M46 22 L52 46', 'M34 20 L44 44', 'M22 24 L34 42'].map((d) => (
            <path key={d} d={d} stroke={secondary} strokeWidth="2" fill="none" />
          ))}
          {[
            [18, 16],
            [28, 14],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill={secondary} />
          ))}
        </g>
      )
    case 'zebra-long-stripes':
      return (
        <g clipPath={clip}>
          {['M4 22 C20 24 40 36 58 46', 'M8 32 C24 34 42 44 58 52', 'M14 16 C28 18 44 30 56 40'].map((d) => (
            <path key={d} d={d} stroke={secondary} strokeWidth="3.6" fill="none" />
          ))}
          <path d="M22 82 C32 74 46 64 58 60" stroke={secondary} strokeWidth="3" fill="none" />
          {[
            [30, 84],
            [40, 80],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill={secondary} />
          ))}
        </g>
      )
    case 'buckeye-eyespots':
      return (
        <g clipPath={clip}>
          <circle cx="24" cy="30" r="7" fill="#3d3f74" stroke="#e8ddc4" strokeWidth="2" />
          <circle cx="26" cy="28" r="2.2" fill="#c9639b" />
          <circle cx="34" cy="72" r="5.5" fill="#3d3f74" stroke="#e8ddc4" strokeWidth="1.8" />
          <circle cx="35.5" cy="70.5" r="1.6" fill="#c9639b" />
          <path d="M40 22 C46 28 52 38 56 46" stroke="#d97a4a" strokeWidth="3" fill="none" />
          <path d="M12 14 L30 16 L26 24 Z" fill="#efe6d2" />
        </g>
      )
    case 'viceroy-black-line':
      return (
        <g clipPath={clip}>
          {['M58 48 L14 16', 'M58 48 L10 30', 'M58 55 L24 64', 'M58 55 L30 82'].map((d) => (
            <path key={d} d={d} stroke={secondary} strokeWidth="2.2" fill="none" />
          ))}
          {/* the viceroy's tell-tale hindwing crossline */}
          <path d="M20 70 C30 66 44 62 58 62" stroke={secondary} strokeWidth="3.2" fill="none" />
          <path
            d="M58 46 C46 18 26 4 10 10 C0 16 2 34 14 46 L20 40 C10 32 8 20 16 16 C28 12 44 24 54 48 Z"
            fill={secondary}
          />
          {[
            [15, 15],
            [10, 26],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.7" fill="#fdf6e3" />
          ))}
        </g>
      )
    case 'mourning-gold-border':
      return (
        <g clipPath={clip}>
          <path
            d="M18 12 L20 18 L12 18 C6 24 8 32 14 38 L20 38 L18 44 C14 42 8 36 6 30 C4 22 8 16 18 12 Z"
            fill={secondary}
          />
          <path d="M22 64 L27 68 L20 74 C18 82 24 90 32 90 L34 84 L40 88 C34 92 24 92 20 84 C17 78 18 70 22 64 Z" fill={secondary} />
          {[
            [20, 46],
            [28, 54],
            [24, 76],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" fill="#7f9bd1" />
          ))}
        </g>
      )
    case 'spicebush-blue-dust':
      return (
        <g clipPath={clip}>
          <path d="M22 64 C30 60 44 58 58 58 L58 86 C46 88 30 84 22 74 Z" fill={secondary} opacity="0.65" />
          {[
            [18, 34],
            [26, 42],
            [36, 48],
            [46, 52],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="#bcd6d0" opacity="0.85" />
          ))}
          <circle cx="27" cy="83" r="2.6" fill="#d97a56" />
        </g>
      )
    case 'giant-yellow-sashes':
      return (
        <g clipPath={clip}>
          <path d="M6 20 C22 26 40 38 58 48" stroke={secondary} strokeWidth="5" fill="none" />
          <path d="M16 8 C26 16 40 30 52 42" stroke={secondary} strokeWidth="4" fill="none" />
          <path d="M22 84 C32 76 44 66 58 62" stroke={secondary} strokeWidth="4" fill="none" />
          <circle cx="29" cy="100" r="2.6" fill={secondary} />
        </g>
      )
    case 'cabbage-ink-spots':
      return (
        <g clipPath={clip}>
          <circle cx="30" cy="34" r="3.4" fill={secondary} />
          <path d="M22 20 C16 16 12 14 8 16 L14 26 C18 22 20 21 22 20 Z" fill={secondary} opacity="0.8" />
        </g>
      )
    case 'baltimore-checkers':
      return (
        <g clipPath={clip}>
          {[
            [14, 40],
            [24, 46],
            [35, 50],
            [46, 52],
            [26, 78],
            [36, 72],
          ].map(([cx, cy]) => (
            <rect key={`${cx}-${cy}`} x={cx - 2} y={cy - 2} width="4" height="4" fill="#e8ddc4" />
          ))}
          {[
            [18, 18],
            [26, 26],
            [12, 28],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill={secondary} />
          ))}
          <path d="M10 34 C24 38 42 46 58 52" stroke={secondary} strokeWidth="3" fill="none" />
        </g>
      )
    case 'pipevine-iridescent':
      return (
        <g clipPath={clip}>
          <path d="M22 60 C32 56 46 55 58 56 L58 88 C46 90 30 86 22 74 Z" fill={secondary} opacity="0.8" />
          <path d="M22 60 C32 56 46 55 58 56" stroke="#78c0e8" strokeWidth="1.5" fill="none" opacity="0.7" />
          {[
            [30, 76],
            [38, 70],
            [46, 66],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="#e8934c" />
          ))}
        </g>
      )
    case 'american-lady-eyes':
      return (
        <g clipPath={clip}>
          <circle cx="30" cy="76" r="5" fill="#3a4a80" stroke="#e8ddc4" strokeWidth="1.6" />
          <circle cx="31" cy="75" r="1.4" fill="#e8ddc4" />
          <path d="M12 12 L28 16 L22 26 L36 30" stroke={secondary} strokeWidth="3" fill="none" />
          <circle cx="16" cy="20" r="2" fill="#f3ece0" />
        </g>
      )
    case 'spangled-fritillary':
      return (
        <g clipPath={clip}>
          {[
            [22, 62],
            [30, 72],
            [26, 82],
            [38, 76],
          ].map(([cx, cy]) => (
            <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="3.2" ry="2.4" fill="#ece5d4" stroke={secondary} strokeWidth="0.8" />
          ))}
          {[
            [20, 20],
            [30, 28],
            [16, 32],
            [40, 40],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill={secondary} />
          ))}
          {['M46 22 L52 46', 'M32 18 L44 44'].map((d) => (
            <path key={d} d={d} stroke={secondary} strokeWidth="1.8" fill="none" />
          ))}
        </g>
      )
    case 'azure-soft-edge':
      return (
        <g clipPath={clip}>
          <path d="M58 46 C48 26 32 16 22 20 C14 24 16 36 26 44 L30 38 C24 34 24 28 28 26 C36 24 48 32 54 48 Z" fill={secondary} opacity="0.5" />
          <circle cx="36" cy="66" r="1.6" fill={secondary} />
        </g>
      )
    case 'red-spotted-purple':
      return (
        <g clipPath={clip}>
          <path d="M20 66 C30 60 44 58 58 58 L58 88 C44 90 28 84 20 74 Z" fill={secondary} opacity="0.7" />
          {[
            [16, 18],
            [12, 28],
            [24, 14],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="#d96a45" />
          ))}
          <path d="M8 34 C20 38 40 46 58 52" stroke={secondary} strokeWidth="1.6" fill="none" opacity="0.6" />
        </g>
      )
    case 'california-sister-bands':
      return (
        <g clipPath={clip}>
          <path d="M8 30 C22 32 40 42 58 50" stroke={secondary} strokeWidth="6" fill="none" />
          <circle cx="14" cy="16" r="5" fill="#e2793e" />
          <path d="M22 82 C32 74 44 66 58 60" stroke={secondary} strokeWidth="4" fill="none" />
        </g>
      )
    case 'atala-jewel-spots':
      return (
        <g clipPath={clip}>
          {[
            [18, 30],
            [26, 40],
            [34, 48],
            [24, 66],
            [32, 74],
            [40, 66],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill={secondary} />
          ))}
          <circle cx="34" cy="84" r="3.4" fill="#d64a3c" />
        </g>
      )
    default:
      return (
        <g clipPath={clip}>
          <circle cx="28" cy="34" r="3" fill={secondary} />
          <circle cx="32" cy="70" r="2.4" fill={secondary} />
        </g>
      )
  }
}

/** Fixed per sprite; a literal in the JSX would be a new object every render
 *  and would defeat the memo on OutfitOverlay. */
const BUTTERFLY_ANCHOR: OutfitAnchor = {
  headX: 60,
  headY: 31,
  bodyX: 60,
  bodyY: 52,
  scale: 1,
}

/**
 * Memoized. These sprites are large SVG trees -- a garden scene draws up to
 * twelve butterflies, eight flowers and a row of creatures at once -- and the
 * views around them re-render on every keystroke in a rename or plan field.
 * Skipping the subtree needs stable props, which is why the outfit map is
 * built once per view and the anchors are module constants.
 */
export const ButterflySprite = memo(function ButterflySprite({
  speciesId,
  label,
  size = 96,
  flapping = true,
  outfit,
  className = '',
}: {
  speciesId: string
  label?: string
  size?: number
  flapping?: boolean
  outfit?: Partial<Record<OutfitSlot, string>>
  className?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const definition = getSpecies(speciesId)
  const primary = definition?.wingColors[0] ?? '#e87832'
  const secondary = definition?.wingColors[1] ?? '#27231f'
  const shape = wingShapes[definition?.wingShape ?? 'rounded']
  const pattern = definition?.visualPattern ?? ''
  // Every id is scoped to this instance. A shared literal id would repeat
  // across the dozen butterflies on screen, and url(#…) resolves to whichever
  // copy comes first in the document.
  const clipId = `wingclip-${uid}`
  const glowId = `morphoglow-${uid}`
  const wingId = `wing-${uid}`
  const clip = `url(#${clipId})`
  const isClear = definition?.wingShape === 'clear'

  return (
    <svg
      viewBox="0 0 120 110"
      width={size}
      height={size * (110 / 120)}
      className={`butterfly-sprite ${flapping ? 'flapping' : ''} ${className}`}
      role="img"
      aria-label={label ?? definition?.commonName ?? 'Butterfly'}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shape.fore} />
          <path d={shape.hind} />
        </clipPath>
        <radialGradient id={glowId} cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#9adcff" />
          <stop offset="100%" stopColor="#168bd2" />
        </radialGradient>
        {/* The wing is described once and mirrored, rather than building the
            whole marking layer twice for every butterfly on screen. */}
        <g id={wingId}>
          <path
            d={shape.fore}
            fill={primary}
            stroke={secondary}
            strokeWidth={isClear ? 2.2 : 1.2}
            opacity={isClear ? 0.55 : 1}
          />
          <path
            d={shape.hind}
            fill={primary}
            stroke={secondary}
            strokeWidth={isClear ? 2.2 : 1.2}
            opacity={isClear ? 0.5 : 0.96}
          />
          {wingMarkings(pattern, secondary, clip, `url(#${glowId})`)}
        </g>
      </defs>

      {/* Left wing */}
      <use href={`#${wingId}`} className="wing wing-left" />

      {/* Right wing (mirrored; the inner element carries the flap animation) */}
      <g transform="translate(120,0) scale(-1,1)">
        <use href={`#${wingId}`} className="wing wing-right" />
      </g>

      {/* Body */}
      <g className="butterfly-body-group">
        <ellipse cx="60" cy="58" rx="4.6" ry="20" fill="#3b3128" />
        <ellipse cx="60" cy="44" rx="5.2" ry="7" fill="#4a3d31" />
        <circle cx="60" cy="34" r="5.4" fill="#3b3128" />
        <circle cx="57.8" cy="32.5" r="1.1" fill="#f3ecdd" />
        <circle cx="62.2" cy="32.5" r="1.1" fill="#f3ecdd" />
        {/* segment lines */}
        {[52, 58, 64, 70].map((y) => (
          <path key={y} d={`M56 ${y} Q60 ${y + 2} 64 ${y}`} stroke="#251f19" strokeWidth="0.9" fill="none" />
        ))}
        <path d="M57 30 C52 20 46 16 42 15" stroke="#3b3128" strokeWidth="1.6" fill="none" />
        <path d="M63 30 C68 20 74 16 78 15" stroke="#3b3128" strokeWidth="1.6" fill="none" />
        <circle cx="42" cy="15" r="1.8" fill="#3b3128" />
        <circle cx="78" cy="15" r="1.8" fill="#3b3128" />
      </g>

      {outfit && (
        <OutfitOverlay outfit={outfit} anchor={BUTTERFLY_ANCHOR} />
      )}
    </svg>
  )
})
