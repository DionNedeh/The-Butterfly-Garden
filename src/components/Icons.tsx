import type { ReactNode } from 'react'

export function Icon({
  name,
  size = 22,
}: {
  name:
    | 'garden'
    | 'today'
    | 'journal'
    | 'settings'
    | 'sun'
    | 'moon'
    | 'seed'
    | 'leaf'
    | 'nectar'
    | 'shop'
    | 'flight'
    | 'care'
    | 'droplet'
    | 'music'
    | 'eye'
    | 'berry'
    | 'bath'
    | 'play'
    | 'sparkle'
    | 'stardust'
    | 'hat'
    | 'bow'
    | 'crown'
    | 'flower'
    | 'lock'
  size?: number
}) {
  const paths: Record<string, ReactNode> = {
    garden: (
      <>
        <path d="M12 21V10" />
        <path d="M12 13C8 13 5 11 4 7c4-1 7 0 8 3" />
        <path d="M12 16c4 0 7-2 8-6-4-1-7 0-8 3" />
      </>
    ),
    today: (
      <>
        <path d="M7 3v3M17 3v3M4 9h16" />
        <rect x="4" y="5" width="16" height="16" rx="3" />
        <path d="m8 15 2.5 2.5L16 12" />
      </>
    ),
    journal: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z" />
        <path d="M8 4v16M11 9h5M11 13h5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" />,
    seed: (
      <>
        <path d="M12 21v-9" />
        <path d="M12 15c-4 0-7-2-8-6 4-1 7 0 8 3M12 12c4 0 7-2 8-6-4-1-7 0-8 3" />
      </>
    ),
    leaf: <path d="M20 4C10 4 5 9 5 16c4 1 10 0 15-12ZM5 20c2-5 6-8 11-11" />,
    nectar: (
      <>
        <path d="M12 3c3.5 4.2 5.2 7.2 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2.8 1.7-5.8 5.2-10Z" />
        <path d="M9.5 14.2c.5 1.4 1.4 2.1 2.7 2.2" />
      </>
    ),
    shop: (
      <>
        <path d="M4 9h16l-1-5H5L4 9Z" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
        <path d="M4 9a3 3 0 0 0 5 2 3 3 0 0 0 6 0 3 3 0 0 0 5-2" />
      </>
    ),
    flight: (
      <>
        <path d="M4 16c3-7 8-9 16-8" />
        <path d="m16 4 4 4-4 4" />
        <path d="M5 20c1.5-3 3.5-4.5 6-5" />
      </>
    ),
    care: (
      <>
        <path d="M12 20c-5-3.4-8-6.4-8-10a4.4 4.4 0 0 1 8-2.6A4.4 4.4 0 0 1 20 10c0 3.6-3 6.6-8 10Z" />
        <path d="M8.5 10.5h2l1-1.8 1.3 3.4 1-1.6h1.7" />
      </>
    ),
    droplet: (
      <>
        <path d="M12 3c3.4 4.3 5 7.3 5 10a5 5 0 0 1-10 0c0-2.7 1.6-5.7 5-10Z" />
        <path d="M9.6 13.6c.3 1.3 1.1 2 2.4 2.2" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V6l10-2v11" />
        <circle cx="6.8" cy="18" r="2.2" />
        <circle cx="16.8" cy="15" r="2.2" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.8" />
      </>
    ),
    berry: (
      <>
        <circle cx="10" cy="14" r="5" />
        <circle cx="16.4" cy="12.4" r="3.4" />
        <path d="M11 9c0-3 1.5-5 4-6 .6 2 .3 3.8-1 5.3" />
      </>
    ),
    bath: (
      <>
        <path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z" />
        <path d="M6 12V6a2.5 2.5 0 0 1 5 0" />
        <path d="M14 8.5c.6-.9 1.6-1 2.4-.4M15.5 5.5c.4-.6 1.2-.8 1.9-.4" />
      </>
    ),
    play: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8.5 6 3.5-6 3.5Z" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
        <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z" />
      </>
    ),
    stardust: (
      <>
        <path d="M12 4l1.5 4.3L18 9.8l-4.5 1.5L12 15.6l-1.5-4.3L6 9.8l4.5-1.5Z" />
        <path d="M5 17l.6 1.6L7.2 19l-1.6.6L5 21l-.6-1.4L2.8 19l1.6-.4ZM18.5 16.5l.6 1.7 1.7.6-1.7.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" />
      </>
    ),
    hat: (
      <>
        <path d="M4 16h16" />
        <path d="M7 16v-5a5 5 0 0 1 10 0v5" />
        <path d="M7 13.5h10" />
      </>
    ),
    bow: (
      <>
        <path d="M12 12 4.5 8v8L12 12Z" />
        <path d="M12 12l7.5-4v8L12 12Z" />
        <circle cx="12" cy="12" r="1.6" />
      </>
    ),
    crown: (
      <>
        <path d="M4 18h16" />
        <path d="M4 18V8l4 4 4-6 4 6 4-4v10" />
      </>
    ),
    flower: (
      <>
        <circle cx="12" cy="12" r="2.6" />
        <path d="M12 9.4a3.2 3.2 0 1 0-3.2-3.2M12 9.4a3.2 3.2 0 1 1 3.2-3.2M9.4 12a3.2 3.2 0 1 0-3.2 3.2M14.6 12a3.2 3.2 0 1 1 3.2 3.2M12 14.6a3.2 3.2 0 1 0 3.2 3.2M12 14.6a3.2 3.2 0 1 1-3.2 3.2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15.5" r="1.4" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
