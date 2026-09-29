import { useEffect, useState } from 'react'

/**
 * The third-party licences that must travel with every build of the app.
 *
 * Loaded only when someone opens this page, so the text never weighs on the
 * garden's first load. It is THIRD-PARTY-NOTICES.md from the repository,
 * verbatim.
 */
export function NoticesView({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState<string>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let current = true
    import('../../THIRD-PARTY-NOTICES.md?raw')
      .then((module) => {
        if (current) setText(module.default)
      })
      .catch(() => {
        if (current) setFailed(true)
      })
    return () => {
      current = false
    }
  }, [])
  return (
    <div className="view notices-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">With thanks</p>
          <h1>Open-source notices</h1>
          <p>
            The Butterfly Garden is built with these open-source works, which
            keep their own licences.
          </p>
        </div>
        <button className="secondary-button" onClick={onBack}>
          Back to Settings
        </button>
      </header>
      <section className="card">
        {text !== undefined ? (
          <pre className="notices-text">{text}</pre>
        ) : failed ? (
          <p role="status">The notices could not be opened.</p>
        ) : (
          <p role="status">Opening…</p>
        )}
      </section>
    </div>
  )
}
