import { useEffect, useState } from 'react'
import { isAndroidApp } from '../lib/platform'

/**
 * The third-party licences that must travel with every build of the app.
 *
 * Loaded only when someone opens this page, so the text never weighs on the
 * garden's first load. It is THIRD-PARTY-NOTICES.md from the repository,
 * verbatim. The Android app adds the notices Google ships inside its own
 * libraries, gathered at build time into google-notices.txt (see
 * android/app/build.gradle); they are long, so they load only when opened.
 */
export function NoticesView({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [google, setGoogle] = useState<string>()
  const [googleFailed, setGoogleFailed] = useState(false)
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

  const loadGoogleNotices = () => {
    if (google !== undefined || googleFailed) return
    fetch(`${import.meta.env.BASE_URL}google-notices.txt`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.text()
      })
      .then(setGoogle)
      .catch(() => setGoogleFailed(true))
  }

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
      {isAndroidApp() && (
        <section className="card">
          <details
            onToggle={(event) => {
              if (event.currentTarget.open) loadGoogleNotices()
            }}
          >
            <summary>
              Notices from inside Google&apos;s libraries (Play Billing, Play
              services)
            </summary>
            {google !== undefined ? (
              <pre className="notices-text">{google}</pre>
            ) : googleFailed ? (
              <p role="status">These notices could not be opened.</p>
            ) : (
              <p role="status">Opening…</p>
            )}
          </details>
        </section>
      )}
    </div>
  )
}
