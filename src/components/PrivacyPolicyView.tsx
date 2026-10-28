/**
 * The privacy policy, inside the app.
 *
 * Google Play requires the policy to be reachable from within the app as well
 * as at a public address. Both are the same file, public/privacy.html, which
 * GitHub Pages serves on its own and the app shows here, so the two can never
 * drift apart.
 */
export function PrivacyPolicyView({ onBack }: { onBack: () => void }) {
  return (
    <div className="view policy-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Plain-language privacy</p>
          <h1>Privacy policy</h1>
        </div>
        <button className="secondary-button" onClick={onBack}>
          Back to Settings
        </button>
      </header>
      <iframe
        className="policy-frame card"
        title="Privacy policy"
        src={`${import.meta.env.BASE_URL}privacy.html`}
      />
    </div>
  )
}
