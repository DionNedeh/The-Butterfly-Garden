import { useId, type ReactNode } from 'react'
import { plants } from '../../data/content'

/**
 * Botanical SVG plants for the garden scene, with four growth stages:
 * 0 seed mound, 1 sprout, 2 budding stem, 3 full bloom.
 *
 * Every plant is mapped to a bloom archetype that echoes the real species —
 * milkweed's rounded umbels, coneflower's drooping rays around a tall cone,
 * dogwood's four notched bracts, passionflower's fringed corona, and so on.
 */

type Archetype =
  | 'daisy'
  | 'coneflower'
  | 'zinnia'
  | 'umbel'
  | 'thistle'
  | 'pea'
  | 'passionflower'
  | 'violet'
  | 'dogwood'
  | 'turtlehead'
  | 'spike'
  | 'tree'
  | 'willow'
  | 'rosette'
  | 'vine'

interface PlantVisual {
  archetype: Archetype
  bloom: string
  bloomAccent: string
  foliage: string
  foliageDark: string
  /** trees/vines: fruit or secondary bloom color */
  extra?: string
}

const visuals: Record<string, PlantVisual> = {
  milkweed: { archetype: 'umbel', bloom: '#e0a0bd', bloomAccent: '#b06a8c', foliage: '#6f9d5c', foliageDark: '#4c7040' },
  parsley: { archetype: 'umbel', bloom: '#e9edcb', bloomAccent: '#b9c47e', foliage: '#5d8f4a', foliageDark: '#3f6b33' },
  'tulip-tree': { archetype: 'tree', bloom: '#e8c95c', bloomAccent: '#d08a3e', foliage: '#6c9a52', foliageDark: '#4a7038', extra: '#e8c95c' },
  nettle: { archetype: 'spike', bloom: '#c4d3a2', bloomAccent: '#94a86e', foliage: '#5d8f4a', foliageDark: '#3f6b33' },
  thistle: { archetype: 'thistle', bloom: '#b285c4', bloomAccent: '#7d539a', foliage: '#7c9464', foliageDark: '#55704a' },
  'partridge-pea': { archetype: 'pea', bloom: '#f0c94e', bloomAccent: '#c99427', foliage: '#78a35e', foliageDark: '#527841' },
  'rainforest-legume': { archetype: 'vine', bloom: '#7fb3d4', bloomAccent: '#4e83a8', foliage: '#3f7d58', foliageDark: '#2a5a3e' },
  nightshade: { archetype: 'vine', bloom: '#a887c9', bloomAccent: '#7a5a9e', foliage: '#557a4a', foliageDark: '#3a5833', extra: '#e8c95c' },
  passionflower: { archetype: 'passionflower', bloom: '#c4b1e0', bloomAccent: '#6d5a9e', foliage: '#5d8f4a', foliageDark: '#3f6b33' },
  plantain: { archetype: 'rosette', bloom: '#c9cf9e', bloomAccent: '#9aa06e', foliage: '#6f9d5c', foliageDark: '#4c7040' },
  willow: { archetype: 'willow', bloom: '#cfe0a8', bloomAccent: '#a3b878', foliage: '#8fae6d', foliageDark: '#66854c' },
  spicebush: { archetype: 'tree', bloom: '#e5d768', bloomAccent: '#bfa93e', foliage: '#7ba05a', foliageDark: '#557a3e', extra: '#e5d768' },
  citrus: { archetype: 'tree', bloom: '#f6f1dc', bloomAccent: '#d8ccae', foliage: '#4e8a4a', foliageDark: '#336633', extra: '#e8973f' },
  brassica: { archetype: 'rosette', bloom: '#ecd75c', bloomAccent: '#c2ac33', foliage: '#7ea86a', foliageDark: '#587e48' },
  'white-turtlehead': { archetype: 'turtlehead', bloom: '#f3ecdd', bloomAccent: '#d8c8b4', foliage: '#5d8f4a', foliageDark: '#3f6b33' },
  pipevine: { archetype: 'vine', bloom: '#b0a058', bloomAccent: '#7d7038', foliage: '#5f8a4f', foliageDark: '#416336' },
  pussytoes: { archetype: 'rosette', bloom: '#efe9de', bloomAccent: '#c9beaa', foliage: '#9aa88e', foliageDark: '#6f7d64' },
  violet: { archetype: 'violet', bloom: '#8a67b8', bloomAccent: '#5d4187', foliage: '#5d8f4a', foliageDark: '#3f6b33' },
  dogwood: { archetype: 'dogwood', bloom: '#f5efe2', bloomAccent: '#d9c9ae', foliage: '#7ba05a', foliageDark: '#557a3e' },
  'black-cherry': { archetype: 'tree', bloom: '#f3ecdd', bloomAccent: '#d8c8b4', foliage: '#5f8a4f', foliageDark: '#416336', extra: '#5a3040' },
  oak: { archetype: 'tree', bloom: '#a8b86a', bloomAccent: '#7d8c48', foliage: '#728c4c', foliageDark: '#4f6534', extra: '#a8813f' },
  coontie: { archetype: 'rosette', bloom: '#8aa06e', bloomAccent: '#5f7548', foliage: '#527d6c', foliageDark: '#37584c' },
  aster: { archetype: 'daisy', bloom: '#9d8cc9', bloomAccent: '#6f5da3', foliage: '#6f9d5c', foliageDark: '#4c7040' },
  coneflower: { archetype: 'coneflower', bloom: '#c9709a', bloomAccent: '#9c4a72', foliage: '#5d8f4a', foliageDark: '#3f6b33' },
  zinnia: { archetype: 'zinnia', bloom: '#d95f4a', bloomAccent: '#a83c2c', foliage: '#78a35e', foliageDark: '#527841' },
}

function fallbackVisual(plantId: string): PlantVisual {
  const definition = plants.find((plant) => plant.id === plantId)
  return {
    archetype: 'daisy',
    bloom: definition?.color ?? '#c884a5',
    bloomAccent: '#8f5c78',
    foliage: '#6f9d5c',
    foliageDark: '#4c7040',
  }
}

function daisyHead(
  dotsId: string,
  cx: number,
  cy: number,
  petalColor: string,
  centerColor: string,
  petalCount: number,
  petalLength: number,
  petalWidth: number,
  scale = 1,
): ReactNode {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
      {Array.from({ length: petalCount }, (_, index) => (
        <ellipse
          key={index}
          cx="0"
          cy={-petalLength / 2 - 2}
          rx={petalWidth}
          ry={petalLength / 2}
          fill={petalColor}
          transform={`rotate(${(360 / petalCount) * index})`}
        />
      ))}
      <circle r="4.6" fill={centerColor} />
      <circle r="4.6" fill={`url(#${dotsId})`} opacity="0.5" />
    </g>
  )
}

function leaf(x: number, y: number, angle: number, color: string, length = 16): ReactNode {
  return (
    <path
      d={`M${x} ${y} C${x + length * 0.7} ${y - length * 0.45} ${x + length} ${y - length * 0.1} ${x + length} ${y + 2} C${x + length * 0.6} ${y + length * 0.35} ${x + length * 0.2} ${y + length * 0.2} ${x} ${y} Z`}
      fill={color}
      transform={`rotate(${angle} ${x} ${y})`}
    />
  )
}

function bloomFor(visual: PlantVisual, dotsId: string): ReactNode {
  const { archetype, bloom, bloomAccent, foliage, foliageDark, extra } = visual
  switch (archetype) {
    case 'daisy':
      return (
        <g>
          {daisyHead(dotsId, 50, 30, bloom, '#e7b445', 18, 17, 2.2)}
          {daisyHead(dotsId, 33, 48, bloom, '#e7b445', 16, 12, 1.8, 0.75)}
          {daisyHead(dotsId, 66, 46, bloom, '#e7b445', 16, 12, 1.8, 0.7)}
          <path d="M33 52 C36 62 44 70 50 74" stroke={foliageDark} strokeWidth="2" fill="none" />
          <path d="M66 50 C63 60 56 70 50 74" stroke={foliageDark} strokeWidth="2" fill="none" />
        </g>
      )
    case 'coneflower':
      return (
        <g>
          {/* tall spiny cone */}
          <ellipse cx="50" cy="28" rx="7" ry="9" fill="#c9762e" />
          <ellipse cx="50" cy="25" rx="5" ry="5.4" fill="#a85a1e" />
          {[0, 1, 2, 3].map((row) => (
            <path
              key={row}
              d={`M${44 + row * 0.6} ${23 + row * 3.4} Q50 ${25.5 + row * 3.4} ${56 - row * 0.6} ${23 + row * 3.4}`}
              stroke="#e0a45c"
              strokeWidth="1"
              fill="none"
            />
          ))}
          {/* drooping ray petals */}
          {[-64, -42, -22, 22, 42, 64, -80, 80].map((angle) => (
            <path
              key={angle}
              d="M50 33 C50 44 49 56 47 62 C51 58 53 46 53 34 Z"
              fill={bloom}
              stroke={bloomAccent}
              strokeWidth="0.7"
              transform={`rotate(${angle} 50 33)`}
            />
          ))}
        </g>
      )
    case 'zinnia':
      return (
        <g>
          {/* layered double bloom */}
          {Array.from({ length: 14 }, (_, index) => (
            <ellipse key={`outer-${index}`} cx="50" cy="21" rx="3.4" ry="10" fill={bloomAccent} transform={`rotate(${(360 / 14) * index} 50 32)`} />
          ))}
          {Array.from({ length: 12 }, (_, index) => (
            <ellipse key={`mid-${index}`} cx="50" cy="24.5" rx="3" ry="7.5" fill={bloom} transform={`rotate(${(360 / 12) * index + 14} 50 32)`} />
          ))}
          {Array.from({ length: 9 }, (_, index) => (
            <ellipse key={`inner-${index}`} cx="50" cy="27.5" rx="2.5" ry="4.8" fill="#e88a6a" transform={`rotate(${(360 / 9) * index} 50 32)`} />
          ))}
          <circle cx="50" cy="32" r="3.6" fill="#e7b445" />
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle key={angle} cx="50" cy="29.4" r="0.9" fill="#f6e08a" transform={`rotate(${angle} 50 32)`} />
          ))}
        </g>
      )
    case 'umbel':
      return (
        <g>
          {/* domed clusters of tiny five-point florets */}
          {[
            { cx: 50, cy: 26, r: 13 },
            { cx: 32, cy: 42, r: 9 },
            { cx: 68, cy: 40, r: 9.5 },
          ].map((cluster) => (
            <g key={cluster.cx}>
              <path d={`M${cluster.cx} ${cluster.cy + cluster.r} L${cluster.cx} 74`} stroke={visual.foliageDark} strokeWidth="2" fill="none" />
              <circle cx={cluster.cx} cy={cluster.cy} r={cluster.r} fill={bloomAccent} opacity="0.4" />
              {Array.from({ length: 11 }, (_, index) => {
                const angle = (index / 11) * Math.PI * 2
                const rr = index % 2 ? cluster.r * 0.55 : cluster.r * 0.95
                const x = cluster.cx + Math.cos(angle) * rr
                const y = cluster.cy + Math.sin(angle) * rr * 0.85
                return (
                  <g key={index} transform={`translate(${x} ${y})`}>
                    {[0, 72, 144, 216, 288].map((rot) => (
                      <ellipse key={rot} cx="0" cy="-1.9" rx="1" ry="1.9" fill={bloom} transform={`rotate(${rot})`} />
                    ))}
                    <circle r="0.9" fill={bloomAccent} />
                  </g>
                )
              })}
            </g>
          ))}
        </g>
      )
    case 'thistle':
      return (
        <g>
          {/* spiky bracts */}
          <path d="M42 44 C42 34 58 34 58 44 C58 52 42 52 42 44 Z" fill={foliage} stroke={foliageDark} strokeWidth="1.4" />
          {[-2, -1, 0, 1, 2].map((offset) => (
            <path key={offset} d={`M${50 + offset * 4} 50 L${49 + offset * 5} 57`} stroke={foliageDark} strokeWidth="1.4" strokeLinecap="round" />
          ))}
          {/* purple crown tuft */}
          {Array.from({ length: 17 }, (_, index) => {
            const spread = (index - 8) * 3.4
            return (
              <path
                key={index}
                d={`M50 40 C${50 + spread * 0.4} 32 ${50 + spread} 26 ${50 + spread} 20`}
                stroke={index % 2 ? bloom : bloomAccent}
                strokeWidth="1.7"
                strokeLinecap="round"
                fill="none"
              />
            )
          })}
        </g>
      )
    case 'pea':
      return (
        <g>
          {/* cheerful pea blooms along the stem */}
          {[
            { cx: 50, cy: 24, s: 1 },
            { cx: 40, cy: 40, s: 0.85 },
            { cx: 61, cy: 44, s: 0.8 },
          ].map((flower) => (
            <g key={flower.cx} transform={`translate(${flower.cx} ${flower.cy}) scale(${flower.s})`}>
              <circle cx="0" cy="-2" r="7.5" fill={bloom} />
              <path d="M-7 -2 A7 7 0 0 1 7 -2 Z" fill="#f7dd7e" opacity="0.9" />
              <path d="M-4.5 1 A5 4.4 0 0 0 4.5 1 L0 6 Z" fill={bloomAccent} />
              <circle cx="0" cy="-3.4" r="1.6" fill={bloomAccent} />
            </g>
          ))}
          {/* feathery paired leaflets */}
          {[52, 60].map((y) => (
            <g key={y}>
              {[-1, 1].map((direction) => (
                <g key={direction}>
                  {[0, 1, 2, 3].map((index) => (
                    <ellipse
                      key={index}
                      cx={50 + direction * (5 + index * 4.5)}
                      cy={y + index * 1.6}
                      rx="2.6"
                      ry="1.5"
                      fill={foliage}
                    />
                  ))}
                </g>
              ))}
            </g>
          ))}
        </g>
      )
    case 'passionflower':
      return (
        <g>
          {/* tendrils */}
          <path d="M30 52 C24 46 24 40 29 37 C33 35 35 39 32 41" stroke={foliage} strokeWidth="1.6" fill="none" />
          <path d="M70 50 C76 44 76 38 71 35 C67 33 65 37 68 39" stroke={foliage} strokeWidth="1.6" fill="none" />
          {/* ten pale sepals/petals */}
          {Array.from({ length: 10 }, (_, index) => (
            <ellipse key={index} cx="50" cy="20.5" rx="4" ry="12" fill={bloom} stroke="#a08fc9" strokeWidth="0.5" transform={`rotate(${index * 36} 50 32)`} />
          ))}
          {/* fringed corona */}
          {Array.from({ length: 26 }, (_, index) => (
            <path
              key={index}
              d="M50 32 L50 22.4"
              stroke={index % 2 ? bloomAccent : '#efe6f7'}
              strokeWidth="1.1"
              strokeLinecap="round"
              transform={`rotate(${index * (360 / 26)} 50 32)`}
            />
          ))}
          <circle cx="50" cy="32" r="4.2" fill="#cfe3b8" />
          {/* three styles */}
          {[0, 120, 240].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 50 32)`}>
              <path d="M50 32 L50 26" stroke="#8fae6d" strokeWidth="1.3" />
              <ellipse cx="50" cy="25.4" rx="2" ry="1.2" fill="#b06a8c" />
            </g>
          ))}
        </g>
      )
    case 'violet':
      return (
        <g>
          {/* heart-shaped basal leaves */}
          <path d="M50 72 C36 66 28 56 32 48 C36 42 46 44 50 52 C54 44 64 42 68 48 C72 56 64 66 50 72 Z" fill={foliage} stroke={foliageDark} strokeWidth="1.4" />
          {[
            { cx: 40, cy: 34, s: 1 },
            { cx: 60, cy: 30, s: 0.9 },
            { cx: 51, cy: 44, s: 0.75 },
          ].map((flower) => (
            <g key={`${flower.cx}-${flower.cy}`} transform={`translate(${flower.cx} ${flower.cy}) scale(${flower.s})`}>
              <ellipse cx="-3.4" cy="-3.6" rx="3.2" ry="4.4" fill={bloom} transform="rotate(-28)" />
              <ellipse cx="3.4" cy="-3.6" rx="3.2" ry="4.4" fill={bloom} transform="rotate(28)" />
              <ellipse cx="-4.6" cy="0.6" rx="3" ry="4" fill={bloomAccent} transform="rotate(-62)" />
              <ellipse cx="4.6" cy="0.6" rx="3" ry="4" fill={bloomAccent} transform="rotate(62)" />
              <ellipse cx="0" cy="3.4" rx="3.6" ry="4.6" fill={bloom} />
              <path d="M0 1 L0 4.4" stroke="#4a3268" strokeWidth="0.9" />
              <circle cx="0" cy="0" r="1.4" fill="#f0c94e" />
            </g>
          ))}
        </g>
      )
    case 'dogwood':
      return (
        <g>
          {/* branching twigs */}
          <path d="M50 74 C48 58 42 48 32 40 M50 74 C52 56 58 46 70 38 M50 74 L50 46" stroke="#7c5a30" strokeWidth="2.2" fill="none" />
          {[
            { cx: 30, cy: 34, s: 1 },
            { cx: 70, cy: 32, s: 1.05 },
            { cx: 50, cy: 40, s: 0.9 },
          ].map((blossom) => (
            <g key={blossom.cx} transform={`translate(${blossom.cx} ${blossom.cy}) scale(${blossom.s})`}>
              {[0, 90, 180, 270].map((angle) => (
                <g key={angle} transform={`rotate(${angle})`}>
                  {/* notched bract */}
                  <path d="M0 -1 C-4.4 -3 -5.4 -9 -2.4 -11.5 L0 -10 L2.4 -11.5 C5.4 -9 4.4 -3 0 -1 Z" fill={bloom} stroke={bloomAccent} strokeWidth="0.7" />
                  <path d="M-1.4 -11.2 L0 -9.8 L1.4 -11.2" stroke="#b98c85" strokeWidth="0.8" fill="none" />
                </g>
              ))}
              <circle r="2.4" fill="#cfe3b8" />
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <circle key={angle} cx="0" cy="-1.5" r="0.55" fill="#8fae6d" transform={`rotate(${angle})`} />
              ))}
            </g>
          ))}
        </g>
      )
    case 'turtlehead':
      return (
        <g>
          {/* stacked snout-shaped blooms */}
          {[
            { cy: 24, s: 1 },
            { cy: 36, s: 0.92 },
            { cy: 47, s: 0.84 },
          ].map((row) => (
            <g key={row.cy} transform={`translate(50 ${row.cy}) scale(${row.s})`}>
              <path d="M-8 2 C-9 -4 -4 -8 0 -8 C5 -8 9 -4 8 1 C7 4 4 5 0 4.6 C-4 5 -7 4.6 -8 2 Z" fill={bloom} stroke={bloomAccent} strokeWidth="1" />
              <path d="M-7 2.4 C-3 4.6 3 4.6 7 2 C4 6 -3 6.4 -7 2.4 Z" fill="#e8b8c8" opacity="0.85" />
              <path d="M-6 -1 C-2 0.6 2 0.6 6 -1" stroke={bloomAccent} strokeWidth="0.8" fill="none" />
            </g>
          ))}
        </g>
      )
    case 'spike':
      return (
        <g>
          {/* drooping catkin strings */}
          {[
            { x: 50, y0: 22 },
            { x: 38, y0: 32 },
            { x: 62, y0: 30 },
          ].map((string) => (
            <g key={string.x}>
              <path d={`M${string.x} ${string.y0} C${string.x - 2} ${string.y0 + 12} ${string.x + 2} ${string.y0 + 20} ${string.x} ${string.y0 + 26}`} stroke={bloomAccent} strokeWidth="1.2" fill="none" />
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <circle key={index} cx={string.x + (index % 2 ? -1.6 : 1.6)} cy={string.y0 + 4 + index * 4} r="2" fill={bloom} />
              ))}
            </g>
          ))}
        </g>
      )
    case 'tree':
      return (
        <g>
          <path d="M47 96 C47 66 46 50 44 40 L56 40 C54 52 53 68 53 96 Z" fill="#8a6238" />
          <path d="M46 62 C38 56 32 50 30 44 M54 60 C62 54 68 48 70 42" stroke="#8a6238" strokeWidth="3" fill="none" />
          <circle cx="50" cy="30" r="22" fill={foliage} />
          <circle cx="32" cy="40" r="13" fill={foliageDark} opacity="0.85" />
          <circle cx="68" cy="38" r="14" fill={foliage} />
          <circle cx="50" cy="22" r="14" fill="#8db56f" opacity="0.9" />
          {/* blossoms */}
          {[
            [38, 28],
            [56, 20],
            [64, 34],
            [44, 40],
            [30, 38],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
              {[0, 72, 144, 216, 288].map((angle) => (
                <ellipse key={angle} cx="0" cy="-2" rx="1.2" ry="2" fill={bloom} transform={`rotate(${angle})`} />
              ))}
              <circle r="1" fill={bloomAccent} />
            </g>
          ))}
          {extra && (
            <g>
              {[
                [46, 32],
                [60, 26],
                [36, 44],
              ].map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill={extra} stroke={foliageDark} strokeWidth="0.5" />
              ))}
            </g>
          )}
        </g>
      )
    case 'willow':
      return (
        <g>
          <path d="M47 96 C47 66 46 52 44 42 L56 42 C54 54 53 68 53 96 Z" fill="#8a6238" />
          <circle cx="50" cy="30" r="18" fill={foliage} opacity="0.9" />
          {/* weeping strands */}
          {[-20, -13, -6, 0, 6, 13, 20].map((dx) => (
            <path
              key={dx}
              d={`M${50 + dx * 0.5} ${26 + Math.abs(dx) * 0.3} C${50 + dx} 44 ${50 + dx * 1.15} 62 ${50 + dx * 1.05} 76`}
              stroke={foliageDark}
              strokeWidth="1.6"
              fill="none"
            />
          ))}
          {[-18, -8, 3, 12, 19].map((dx) => (
            <g key={`lv-${dx}`}>
              {[40, 54, 68].map((y) => (
                <ellipse key={y} cx={50 + dx} cy={y} rx="1.4" ry="3.4" fill={bloom} transform={`rotate(${dx} ${50 + dx} ${y})`} />
              ))}
            </g>
          ))}
        </g>
      )
    case 'rosette':
      return (
        <g>
          {/* low rosette of leaves */}
          {Array.from({ length: 9 }, (_, index) => (
            <ellipse
              key={index}
              cx="50"
              cy="60"
              rx="4.4"
              ry="14"
              fill={index % 2 ? foliage : foliageDark}
              transform={`rotate(${index * 40} 50 68)`}
            />
          ))}
          {/* seed / bloom stalks */}
          {[
            { x: 44, h: 30 },
            { x: 52, h: 38 },
            { x: 59, h: 26 },
          ].map((stalk) => (
            <g key={stalk.x}>
              <path d={`M${stalk.x} 64 L${stalk.x} ${64 - stalk.h}`} stroke={foliageDark} strokeWidth="1.6" />
              <ellipse cx={stalk.x} cy={60 - stalk.h} rx="2.6" ry="6" fill={bloom} stroke={bloomAccent} strokeWidth="0.7" />
            </g>
          ))}
        </g>
      )
    case 'vine':
      return (
        <g>
          {/* winding vine on a stake */}
          <path d="M50 96 L50 24" stroke="#8a6238" strokeWidth="2.6" />
          <path d="M50 92 C38 84 62 74 50 66 C38 58 62 48 50 40 C42 34 54 28 50 24" stroke={foliageDark} strokeWidth="2.2" fill="none" />
          {[
            [40, 80, -20],
            [60, 70, 25],
            [40, 56, -25],
            [60, 44, 20],
          ].map(([x, y, angle]) => (
            <path
              key={`${x}-${y}`}
              d={`M${x} ${y} C${x - 6} ${y - 8} ${x + 2} ${y - 13} ${x + 4} ${y - 6} C${x + 6} ${y - 13} ${x + 12} ${y - 6} ${x + 5} ${y - 1} C${x + 2} ${y + 1} ${x} ${y} ${x} ${y} Z`}
              fill={foliage}
              transform={`rotate(${angle} ${x} ${y})`}
            />
          ))}
          {/* star-shaped vine flowers */}
          {[
            [42, 66],
            [59, 52],
            [46, 34],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
              {[0, 72, 144, 216, 288].map((angle) => (
                <path key={angle} d="M0 0 L-1.7 -4.4 L0 -6.4 L1.7 -4.4 Z" fill={bloom} transform={`rotate(${angle})`} />
              ))}
              <circle r="1.6" fill={extra ?? bloomAccent} />
            </g>
          ))}
        </g>
      )
  }
}

export function FlowerSprite({
  plantId,
  growth,
  size = 90,
  className = '',
  swayDelay = 0,
}: {
  plantId: string
  growth: number
  size?: number
  className?: string
  swayDelay?: number
}) {
  const visual = visuals[plantId] ?? fallbackVisual(plantId)
  // Scoped to this sprite: a shared literal id repeats across every flower in
  // the scene, and url(#…) then resolves to whichever one is first in the DOM.
  const dotsId = `flowerdots-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const stage = Math.max(0, Math.min(3, growth))
  // Trees, willows, vines, and dogwood draw their own trunk or stake from
  // the ground up; low plants hug the soil; everything else gets a stem.
  const fullHeight =
    visual.archetype === 'tree' ||
    visual.archetype === 'willow' ||
    visual.archetype === 'vine' ||
    visual.archetype === 'dogwood'
  const isLow = visual.archetype === 'rosette' || visual.archetype === 'violet'

  return (
    <svg
      viewBox="0 0 100 140"
      width={size}
      height={size * 1.4}
      className={`flower-sprite growth-stage-${stage} ${className}`}
      style={{ ['--sway-delay' as string]: `${swayDelay}s` }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={dotsId} width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.5" fill="#8a5b16" />
        </pattern>
      </defs>

      {/* soil mound */}
      <ellipse cx="50" cy="132" rx="26" ry="7" fill="#8a6f4d" />
      <ellipse cx="50" cy="130.4" rx="22" ry="5.4" fill="#a0855f" />

      {stage === 0 && (
        <g className="plant-sway">
          <ellipse cx="50" cy="127" rx="3.4" ry="4.4" fill="#c9a86a" stroke="#8a6f4d" strokeWidth="1" />
          <path d="M50 122 C50 118 52 116 54 115" stroke={visual.foliage} strokeWidth="1.6" fill="none" />
        </g>
      )}

      {stage === 1 && (
        <g className="plant-sway">
          <path d="M50 130 C50 118 50 110 50 104" stroke={visual.foliageDark} strokeWidth="2.6" fill="none" />
          {leaf(50, 116, -30, visual.foliage, 14)}
          {leaf(50, 110, 152, visual.foliageDark, 13)}
          <ellipse cx="50" cy="101" rx="3.4" ry="4.6" fill={visual.foliage} />
        </g>
      )}

      {stage === 2 && (
        <g className="plant-sway">
          <path d="M50 130 C50 106 50 88 50 72" stroke={visual.foliageDark} strokeWidth="3" fill="none" />
          {leaf(50, 116, -26, visual.foliage, 18)}
          {leaf(50, 106, 150, visual.foliageDark, 17)}
          {leaf(50, 94, -18, visual.foliage, 15)}
          {/* closed bud showing a hint of bloom color */}
          <path d="M50 72 C44 66 45 56 50 52 C55 56 56 66 50 72 Z" fill={visual.foliage} stroke={visual.foliageDark} strokeWidth="1.4" />
          <path d="M50 56 C48 60 48 64 50 68 C52 64 52 60 50 56 Z" fill={visual.bloom} />
        </g>
      )}

      {stage === 3 && (
        <g className="plant-sway">
          {!fullHeight && !isLow && (
            <g>
              <path d="M50 130 C50 106 50 88 50 66" stroke={visual.foliageDark} strokeWidth="3.2" fill="none" />
              {leaf(50, 118, -24, visual.foliage, 19)}
              {leaf(50, 108, 150, visual.foliageDark, 18)}
              {leaf(50, 96, -14, visual.foliage, 16)}
              {leaf(50, 86, 160, visual.foliage, 14)}
            </g>
          )}
          <g
            transform={
              fullHeight
                ? 'translate(0 28)'
                : isLow
                  ? 'translate(0 52) scale(0.95)'
                  : 'translate(0 26) scale(1.05)'
            }
          >
            {bloomFor(visual, dotsId)}
          </g>
        </g>
      )}
    </svg>
  )
}
