import { SUPPORT_CHECKED_ON, supportLines } from '../data/support'
import { pacerFor } from '../lib/breathing'
import { formatJournalDate } from '../lib/date'
import type { AppState, AppView } from '../types'
import { BreatheLink } from './BreatheLink'
import { ComfortLink } from './ComfortLink'

/** What the page's own back button says, for the page that opened it. */
const BACK_LABELS: Partial<Record<AppView, string>> = {
  settings: 'Back to Settings',
  today: 'Back to Today',
  guide: 'Back to the Guide',
  comfort: 'Back to your comfort plan',
}

/**
 * "If you need support now": people to talk to, never the app pretending to
 * be one. Reached from Settings, the Guide, the top of the comfort plan, and
 * quietly after a stormy check-in. Every link hands off to the phone's own
 * dialler, messages or browser; nothing is fetched or sent from here.
 *
 * Below the people, one quiet line offers breathing with a butterfly, as a
 * calming exercise and never in their place, and another the gardener's own
 * comfort plan.
 */
export function SupportView({
  onBack,
  from,
  state,
  onBreathe,
  onOpenComfort,
}: {
  onBack: () => void
  /** The page that opened this one, which its back button returns to. */
  from?: AppView
  /** The garden, for whose wings would pace the breath. */
  state?: Pick<AppState, 'creatures' | 'profile'>
  /** Breathe with a butterfly; offered only when given. */
  onBreathe?: () => void
  /** The comfort plan; offered when given, unless the plan opened this page. */
  onOpenComfort?: () => void
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
          {(from && BACK_LABELS[from]) ?? 'Back to the garden'}
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

      {/* Not when the plan opened this page: its back button is the way there. */}
      {onOpenComfort && from !== 'comfort' && (
        <p className="support-link-note">
          <ComfortLink onOpen={onOpenComfort}>
            {state?.profile?.comfortPlan ? 'Your comfort plan' : 'Write a comfort plan'}
          </ComfortLink>
          : your own words for the harder days, kept for you alone.
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
