import { SUPPORT_CHECKED_ON, supportLines } from '../data/support'
import { pacerFor } from '../lib/breathing'
import { formatJournalDate } from '../lib/date'
import type { AppState } from '../types'
import { BreatheLink } from './BreatheLink'

/**
 * "If you need support now": people to talk to, never the app pretending to
 * be one. Reached from Settings, the Guide, and quietly after a stormy
 * check-in. Every link hands off to the phone's own dialler, messages or
 * browser; nothing is fetched or sent from here.
 *
 * Below the people, one quiet line offers breathing with a butterfly, as a
 * calming exercise and never in their place.
 */
export function SupportView({
  onBack,
  backLabel,
  state,
  onBreathe,
}: {
  onBack: () => void
  backLabel: string
  /** The garden, for whose wings would pace the breath. */
  state?: Pick<AppState, 'creatures' | 'profile'>
  /** Breathe with a butterfly; offered only when given. */
  onBreathe?: () => void
}) {
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

      {state && onBreathe && (
        <p className="support-link-note">
          If a quiet minute would help, you can{' '}
          <BreatheLink onOpen={onBreathe}>{`breathe with ${pacerFor(state).name}`}</BreatheLink>. It
          is a calming exercise, not a substitute for the people above.
        </p>
      )}

      <p className="subtle-copy support-checked">
        These numbers were checked with each service on{' '}
        {formatJournalDate(SUPPORT_CHECKED_ON)}, and are checked again before
        every release. The garden is not a medical service and does not
        diagnose or treat any condition.
      </p>
    </div>
  )
}
