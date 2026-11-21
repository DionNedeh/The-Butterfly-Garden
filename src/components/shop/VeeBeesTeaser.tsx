/**
 * A sneak peek at what the Garden Pass brings next: Vee Bees, which will come
 * with a Companions tab of their own. The last card on the Pass tab, and the
 * quietest: nothing here can be bought, worn or tried on, so it has no button
 * and is not counted among the pieces.
 *
 * It says plainly that the bees are not part of the Pass yet. In the Android
 * app the Pass is a paid subscription, and nobody should take it out for
 * something that has not arrived.
 */
export function VeeBeesTeaser() {
  return (
    <article className="boutique-card coming-soon-card">
      <div className="item-art">
        {/* Decoration only: the heading beneath names it. Its one stripe
            is a V; two side by side read as a W. */}
        <svg
          className="vee-bee"
          viewBox="0 0 120 120"
          width="104"
          height="104"
          aria-hidden="true"
          focusable="false"
        >
          <g fill="#ffffff" fillOpacity="0.82" stroke="#9fb5ac" strokeWidth="2">
            <ellipse cx="48" cy="42" rx="12" ry="19" transform="rotate(-22 48 42)" />
            <ellipse cx="66" cy="40" rx="12" ry="19" transform="rotate(14 66 40)" />
          </g>
          <path d="M29 70 18 66v8Z" fill="#4a3a2a" />
          <g fill="#f4c653" stroke="#4a3a2a" strokeWidth="3">
            <ellipse cx="58" cy="70" rx="30" ry="22" />
            <circle cx="92" cy="68" r="13" />
          </g>
          <g fill="none" stroke="#4a3a2a" strokeLinecap="round" strokeLinejoin="round">
            <path d="m45 56 12 28 12-28" strokeWidth="6" />
            <path d="M88 56c-2-8 0-13 5-15M96 56c1-6 5-10 10-10M92 73c3 3 6 3 8 0" strokeWidth="2.5" />
          </g>
          <circle cx="96" cy="65" r="2.3" fill="#4a3a2a" />
        </svg>
        <span className="item-tag">Coming soon</span>
      </div>
      <div className="item-copy">
        <h3>Vee Bees</h3>
        <p>
          Friendly little bees to keep your garden company. They will arrive
          with a new Companions tab here in the shop, as part of the Garden
          Pass.
        </p>
        <div className="item-footer">
          <span className="coming-soon-note">
            A sneak peek: not part of the Pass yet.
          </span>
        </div>
      </div>
    </article>
  )
}
