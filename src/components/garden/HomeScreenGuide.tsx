import { useId } from 'react'
import type { HomeScreenAdvice } from '../../lib/install'
import './homeScreenGuide.css'

/** Safari's Share symbol, a square with an arrow out of it, drawn beside the word. */
function ShareSymbol() {
  return (
    <svg
      className="home-screen-share"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 2.5v10M6.5 6 10 2.5 13.5 6M7 9H5.5v8.5h9V9H13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The garden's one-time guide to adding it to the Home Screen, on an iPhone
 * or iPad in a browser (lib/install). A card in the page, never over it, with
 * the three steps and why they are worth taking. "Got it" puts it away for
 * good on this device; Settings keeps a short line with the same advice.
 * Loaded only where it can show, so no other garden's first load carries it.
 */
export function HomeScreenGuide({
  advice,
  onPutAway,
}: {
  advice: HomeScreenAdvice
  onPutAway: () => void
}) {
  const titleId = useId()
  const safari = advice === 'safari'
  return (
    <section className="card home-screen-guide" aria-labelledby={titleId}>
      <p className="eyebrow">Keep your garden close</p>
      <h2 id={titleId}>Add the garden to your Home Screen</h2>
      <p>
        {safari
          ? 'Safari may clear what a website keeps after seven days of use without a visit.'
          : 'On iPhone and iPad, a browser may clear what a website keeps after seven days of use without a visit.'}{' '}
        A garden on your Home Screen is kept, and opens like an app.
      </p>
      <ol className="home-screen-steps">
        {safari ? (
          <li>
            Tap Share <ShareSymbol />. If you can’t see it, look under ⋯.
          </li>
        ) : (
          <li>Open your browser’s Share menu.</li>
        )}
        <li>Choose Add to Home Screen. You may need to scroll to find it.</li>
        <li>Tap Add.</li>
      </ol>
      <p className="home-screen-carry">
        Already written here? The Home Screen garden keeps its own storage, so
        save a backup in Settings first, then choose “I have a backup” when it
        opens.
      </p>
      <button type="button" className="text-button home-screen-dismiss" onClick={onPutAway}>
        Got it
      </button>
    </section>
  )
}
