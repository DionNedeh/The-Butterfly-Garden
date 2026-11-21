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
        {/* Decoration only: the heading beneath names it. Drawn about its
            own middle, as the owner's drawing is, with the V on its side. */}
        <svg
          className="vee-bee"
          viewBox="-106 -112 226 168"
          width="108"
          height="80"
          aria-hidden="true"
          focusable="false"
        >
          <g stroke="#452615" strokeWidth="5" strokeLinejoin="round">
            <path d="M-10-20C-70-20-80-110-25-100 10-90 15-45-10-20Z" fill="#e1e8e6" />
            <path d="M10-20C60-25 75-105 20-95-10-85-5-40 10-20Z" fill="#f4f7f6" />
          </g>
          <path d="M-75 5-100 15h25Z" fill="#452615" />
          <g fill="#f7c748" stroke="#452615" strokeWidth="6">
            <ellipse cx="0" cy="0" rx="80" ry="50" />
            <circle cx="80" cy="5" r="34" />
          </g>
          <g fill="none" stroke="#452615" strokeLinecap="round" strokeLinejoin="round">
            <path d="M-28-15 0 20l28-35" strokeWidth="12" />
            <path d="M70-25Q55-50 50-55M90-25q10-25 15-30" strokeWidth="4" />
            <path d="M90 12q8 8 18 0" strokeWidth="3.5" />
          </g>
          <g fill="#452615">
            <circle cx="50" cy="-55" r="3.5" />
            <circle cx="105" cy="-55" r="3.5" />
            <circle cx="85" cy="-5" r="4.5" />
          </g>
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
