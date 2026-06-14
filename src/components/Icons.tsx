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
