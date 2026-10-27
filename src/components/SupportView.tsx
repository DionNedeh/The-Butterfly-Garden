import { SUPPORT_CHECKED_ON, supportLines } from '../data/support'
import { formatJournalDate } from '../lib/date'

/**
 * "If you need support now": people to talk to, never the app pretending to
 * be one. Reached from Settings, the Guide, and quietly after a stormy
 * check-in. Every link hands off to the phone's own dialler, messages or
 * browser; nothing is fetched or sent from here.
 */
export function SupportView({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  return (
    <div className="view support-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">You do not have to carry it alone</p>
          <h1>If you need support now</h1>
          <p>
            This garden is a place for small acts of care. It cannot be a person
            to talk to, and these people can.
          </p>
        </div>
        <button className="secondary-button" onClick={onBack}>
          {backLabel}
        </button>
      </header>

      <section className="card support-urgent" aria-labelledby="support-urgent-title">
        <h2 id="support-urgent-title">If you might be in danger</h2>
        <p>
          Call your local emergency number now: 911 in the United States and
          Canada, 999 or 112 in the United Kingdom and Ireland.
        </p>
      </section>

      <ul className="support-lines">
        {supportLines.map((line) => (
          <li className="card support-line" key={line.id}>
            <p className="eyebrow">{line.region}</p>
            <h2>{line.name}</h2>
            <p>{line.about}</p>
            <div className="form-actions">
              {line.contacts.map((contact) => (
                <a
                  key={contact.href}
                  className="secondary-button"
                  href={contact.href}
                  {...(contact.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {contact.label}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <p className="subtle-copy support-checked">
        These numbers were checked with each service on{' '}
        {formatJournalDate(SUPPORT_CHECKED_ON)}, and are checked again before
        every release. The garden is not a medical service and does not
        diagnose or treat any condition.
      </p>
    </div>
  )
}
