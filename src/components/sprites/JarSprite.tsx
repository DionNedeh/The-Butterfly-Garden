import { memo, useId } from 'react'
import { jarColors } from '../../data/jars'

/** One piece of glassware, shared by the shop, plant bed and keepsake shelf. */
export const JarSprite = memo(function JarSprite({
  character,
  colorId,
  size = 52,
}: {
  character: string
  colorId: string
  size?: number
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const color = jarColors.find((entry) => entry.id === colorId) ?? jarColors[0]
  return (
    <svg
      className="jar-sprite"
      viewBox="0 0 80 88"
      width={size}
      height={size * 1.1}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`glass${id}`} x1="0" x2="1" y2="0.2">
          <stop stopColor={color.highlight} stopOpacity=".8" />
          <stop offset=".22" stopColor={color.fill} stopOpacity=".64" />
          <stop offset=".62" stopColor={color.highlight} stopOpacity=".45" />
          <stop offset="1" stopColor={color.border} stopOpacity=".9" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="81" rx="28" ry="4" fill="#243c30" opacity=".15" />
      <path
        d="M22 16v10C22 31 12 32 12 41v29q0 10 28 10t28-10V41c0-9-10-10-10-15V16Z"
        fill={`url(#glass${id})`}
        stroke={color.border}
        strokeWidth="1.6"
      />
      <path
        d="M17 43v25q0 6 9 7M20 37l5-5"
        fill="none"
        stroke="white"
        strokeOpacity=".7"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M61 43v25"
        stroke={color.border}
        strokeOpacity=".35"
        strokeWidth="2"
      />
      <rect
        x="20"
        y="13"
        width="40"
        height="10"
        rx="4"
        fill={color.fill}
        stroke={color.border}
        strokeWidth="1.5"
      />
      <ellipse
        cx="40"
        cy="14"
        rx="20"
        ry="5"
        fill={color.highlight}
        stroke={color.border}
        strokeWidth="1.5"
      />
      <ellipse
        cx="40"
        cy="14"
        rx="15"
        ry="2.5"
        fill={color.border}
        opacity=".48"
      />
      <rect
        x="23"
        y="40"
        width="34"
        height="29"
        rx="9"
        fill="#fff9e8"
        stroke={color.border}
        strokeOpacity=".3"
      />
      <text
        x="40"
        y="62"
        textAnchor="middle"
        fill={color.border}
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="650"
        fontSize="25"
      >
        {character}
      </text>
    </svg>
  )
})
