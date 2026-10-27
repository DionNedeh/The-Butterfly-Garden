/**
 * "Star this line": the gardener's own choice of words a letter from Marigold
 * may quote back (lib/letters). One name whether on or off, so voice control
 * always finds it; pressed is shown by its state and a filled star.
 */
export function StarToggle({
  starred,
  onChange,
}: {
  starred: boolean
  onChange: (starred: boolean) => void
}) {
  return (
    <button
      type="button"
      className="text-button star-toggle"
      aria-pressed={starred}
      onClick={() => onChange(!starred)}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
          fill={starred ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      Star this line
    </button>
  )
}
