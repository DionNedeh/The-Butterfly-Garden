/**
 * Shown instead of the app when another page has framed it. Nothing behind
 * it runs: the garden's storage is never opened inside someone else's page.
 */
export function FramedNotice() {
  return (
    <main className="safe-mode" aria-labelledby="framed-title">
      <section className="card safe-mode-card">
        <p className="eyebrow">The Butterfly Garden</p>
        <h1 id="framed-title">Open the garden in its own tab</h1>
        <p>
          Your journal lives on this device, so the garden only opens as a page
          of its own, never inside another site.
        </p>
        <div className="form-actions">
          <a
            className="primary-button"
            href={window.location.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open The Butterfly Garden
          </a>
        </div>
      </section>
    </main>
  )
}
