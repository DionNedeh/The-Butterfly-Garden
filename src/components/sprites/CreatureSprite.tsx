import { getSpecies } from '../../lib/progression'
import type { CreatureStage, OutfitSlot } from '../../types'
import { ButterflySprite } from './ButterflySprite'
import { OutfitOverlay } from './OutfitOverlay'

/**
 * Renders a creature at any life stage. Eggs rest on a leaf, caterpillars
 * inch along a twig, chrysalises hang from a branch, butterflies fly free.
 * Species colors tint every stage so each companion feels like itself
 * from the very first day.
 */
export function CreatureSprite({
  speciesId,
  stage,
  label,
  size = 96,
  outfit = {},
  className = '',
}: {
  speciesId: string
  stage: CreatureStage
  label?: string
  size?: number
  outfit?: Partial<Record<OutfitSlot, string>>
  className?: string
}) {
  const definition = getSpecies(speciesId)
  const primary = definition?.wingColors[0] ?? '#e87832'
  const secondary = definition?.wingColors[1] ?? '#27231f'
  const name = label ?? definition?.commonName ?? 'Garden friend'

  if (stage === 'butterfly') {
    return (
      <ButterflySprite
        speciesId={speciesId}
        label={name}
        size={size}
        outfit={outfit}
        className={className}
      />
    )
  }

  if (stage === 'egg') {
    return (
      <svg
        viewBox="0 0 120 110"
        width={size}
        height={size * (110 / 120)}
        className={`creature-sprite egg-sprite ${className}`}
        role="img"
        aria-label={`${name} egg`}
      >
        {/* host leaf */}
        <path
          d="M14 78 C20 52 48 40 96 46 C96 74 70 94 38 92 C26 91 17 86 14 78 Z"
          fill="#6f9d5c"
          stroke="#4c7040"
          strokeWidth="2"
        />
        <path d="M18 77 C40 68 68 58 92 49" stroke="#4c7040" strokeWidth="1.6" fill="none" />
        {[
          'M34 72 C42 68 50 64 58 60',
          'M46 76 C56 70 66 64 76 57',
          'M30 66 C38 62 46 58 52 55',
        ].map((d) => (
          <path key={d} d={d} stroke="#5d8450" strokeWidth="1" fill="none" />
        ))}
        {/* the egg */}
        <g className="egg-wobble">
          <ellipse cx="60" cy="47" rx="14" ry="17" fill="#f7f0dc" stroke="#cbb98e" strokeWidth="1.6" />
          <ellipse cx="60" cy="47" rx="14" ry="17" fill={primary} opacity="0.18" />
          {/* ridges */}
          {[-8, -4, 0, 4, 8].map((dx) => (
            <path
              key={dx}
              d={`M${60 + dx} 31 C${60 + dx * 1.35} 42 ${60 + dx * 1.35} 54 ${60 + dx} 63`}
              stroke="#d9c9a2"
              strokeWidth="0.9"
              fill="none"
            />
          ))}
          <ellipse cx="55" cy="39" rx="3.4" ry="5" fill="#fffdf4" opacity="0.8" />
          <circle cx="60" cy="47" r="2.6" fill={secondary} opacity="0.35" />
        </g>
        <OutfitOverlay outfit={outfit} anchor={{ headX: 60, headY: 30, bodyX: 60, bodyY: 50, scale: 1 }} />
      </svg>
    )
  }

  if (stage === 'caterpillar') {
    const segments = [
      { cx: 88, cy: 66, r: 9 },
      { cx: 76, cy: 62, r: 10 },
      { cx: 63, cy: 60, r: 10.5 },
      { cx: 50, cy: 61, r: 10.5 },
      { cx: 38, cy: 64, r: 10 },
      { cx: 27, cy: 68, r: 9 },
    ]
    return (
      <svg
        viewBox="0 0 120 110"
        width={size}
        height={size * (110 / 120)}
        className={`creature-sprite caterpillar-sprite ${className}`}
        role="img"
        aria-label={`${name} caterpillar`}
      >
        {/* twig */}
        <path d="M6 82 C40 76 82 76 114 80" stroke="#8a6238" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M30 79 C34 74 40 72 46 72" stroke="#8a6238" strokeWidth="2.4" fill="none" />
        <g className="caterpillar-inch">
          {/* body segments, tail to head */}
          {segments.map((segment, index) => (
            <g key={segment.cx}>
              <circle cx={segment.cx} cy={segment.cy} r={segment.r} fill={primary} stroke={secondary} strokeWidth="1.4" />
              {index % 2 === 0 ? (
                <path
                  d={`M${segment.cx - segment.r * 0.7} ${segment.cy - segment.r * 0.55} A${segment.r * 0.75} ${segment.r * 0.75} 0 0 1 ${segment.cx + segment.r * 0.7} ${segment.cy - segment.r * 0.55}`}
                  stroke={secondary}
                  strokeWidth="2.6"
                  fill="none"
                />
              ) : (
                <circle cx={segment.cx} cy={segment.cy - segment.r * 0.35} r="2" fill="#f6efdc" opacity="0.9" />
              )}
              {/* prolegs */}
              <path d={`M${segment.cx - 3} ${segment.cy + segment.r - 1} L${segment.cx - 4} ${segment.cy + segment.r + 4}`} stroke={secondary} strokeWidth="2" strokeLinecap="round" />
              <path d={`M${segment.cx + 3} ${segment.cy + segment.r - 1} L${segment.cx + 4} ${segment.cy + segment.r + 4}`} stroke={secondary} strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
          {/* head */}
          <circle cx="99" cy="60" r="11" fill={primary} stroke={secondary} strokeWidth="1.6" />
          {/* two eyes for a friendly, forward-tilted face */}
          <circle cx="95" cy="57.4" r="2" fill="#2b2118" />
          <circle cx="95.7" cy="56.7" r="0.7" fill="#fdf8ea" />
          <circle cx="103" cy="57" r="2" fill="#2b2118" />
          <circle cx="103.7" cy="56.3" r="0.7" fill="#fdf8ea" />
          <path d="M95 64 Q99 67 103 64" stroke="#2b2118" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M94 51 C92 45 90 42 87 40" stroke={secondary} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M102 50 C103 45 105 41 108 39" stroke={secondary} strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="87" cy="40" r="1.6" fill={secondary} />
          <circle cx="108" cy="39" r="1.6" fill={secondary} />
        </g>
        {/* Caterpillars keep headwear + aura, but neck accessories don't
            suit the long low body, so they're hidden here. */}
        <OutfitOverlay outfit={outfit} anchor={{ headX: 99, headY: 50, bodyX: 63, bodyY: 58, scale: 1 }} hideAccessory />
      </svg>
    )
  }

  // chrysalis
  return (
    <svg
      viewBox="0 0 120 110"
      width={size}
      height={size * (110 / 120)}
      className={`creature-sprite chrysalis-sprite ${className}`}
      role="img"
      aria-label={`${name} chrysalis`}
    >
      {/* branch */}
      <path d="M10 16 C42 10 80 10 112 18" stroke="#8a6238" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M70 15 C74 20 76 24 76 28" stroke="#7c5a30" strokeWidth="2.4" fill="none" />
      <g className="chrysalis-sway">
        {/* silk pad + cremaster */}
        <path d="M60 14 L60 26" stroke="#cbb98e" strokeWidth="2.4" />
        <circle cx="60" cy="15" r="3" fill="#e4d6b0" />
        {/* casing */}
        <path
          d="M60 26 C50 30 46 40 46 52 C46 70 52 84 60 90 C68 84 74 70 74 52 C74 40 70 30 60 26 Z"
          fill="#9fc48f"
          stroke="#5f8a4f"
          strokeWidth="2"
        />
        <path
          d="M60 26 C50 30 46 40 46 52 C46 70 52 84 60 90 C68 84 74 70 74 52 C74 40 70 30 60 26 Z"
          fill={primary}
          opacity="0.14"
        />
        {/* sculpted ridges */}
        <path d="M48 44 C56 40 64 40 72 44" stroke="#5f8a4f" strokeWidth="1.2" fill="none" />
        <path d="M47 52 C56 48 64 48 73 52" stroke="#5f8a4f" strokeWidth="1.2" fill="none" />
        <path d="M49 62 C56 58 64 58 71 62" stroke="#5f8a4f" strokeWidth="1" fill="none" />
        {/* the monarch-style gold crown dots */}
        {[50, 54.5, 59, 63.5, 68].map((x) => (
          <circle key={x} cx={x} cy={40} r="1.4" fill="#e7b445" stroke="#a87716" strokeWidth="0.5" />
        ))}
        <ellipse cx="54" cy="50" rx="3" ry="9" fill="#fffdf4" opacity="0.35" />
      </g>
      <OutfitOverlay outfit={outfit} anchor={{ headX: 60, headY: 24, bodyX: 60, bodyY: 56, scale: 1 }} />
    </svg>
  )
}
