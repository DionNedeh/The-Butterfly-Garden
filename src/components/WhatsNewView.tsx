import { releases } from '../data/releases'
import { Icon } from './Icons'

export function WhatsNewView() {
  return (
    <div className="view whats-new-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Growing a little lovelier</p>
          <h1>What's new in the garden</h1>
          <p>Small changes, more room for wonder.</p>
        </div>
        <Icon name="flower" size={48} />
      </header>
      {releases.map((release) => (
        <article className="release-card card" key={release.id}>
          <span className="release-version">Version {release.version}</span>
          <h2>{release.title}</h2>
          {release.releasedOn && (
            <time dateTime={release.releasedOn}>{release.releasedOn}</time>
          )}
          <div className="release-sections">
            {release.sections.map((section) => (
              <section key={section.title}>
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}
