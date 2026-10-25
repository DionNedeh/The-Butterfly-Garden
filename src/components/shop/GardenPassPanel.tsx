import { useEffect, useState } from 'react'
import { gardenBackdrops } from '../../lib/appearance'
import { shopItems } from '../../data/shopItems'
import { refreshPassStatus, setPassStatus } from '../../lib/passEntitlement'
import { summariseOffers, type OfferSummary } from '../../lib/passOffers'
import {
  dismissPassLapseNotice,
  getPassOffers,
  managePassSubscription,
  subscribeToPass,
  type PurchaseOutcome,
} from '../../lib/playBilling'
import { usePassStatus } from '../../hooks/usePassStatus'

const passOutfits = shopItems
  .filter((item) => item.premium)
  .map((item) => item.name)
const passScenes = gardenBackdrops
  .filter((scene) => scene.unlock.kind === 'pass')
  .map((scene) => scene.name)

const outcomeNotes: Record<PurchaseOutcome, string> = {
  purchased: 'Welcome to the Garden Pass. Everything it includes is open now.',
  pending:
    'Google Play is still processing your payment. The Pass opens as soon as it completes.',
  cancelled: 'No purchase was made.',
  unavailable: 'Google Play could not be reached. Please try again later.',
  failed: 'The purchase did not go through. Please try again later.',
  unconfirmed:
    'Google Play finished, but the Pass is not active yet. It will open as soon as Google Play confirms it.',
}

/**
 * The Garden Pass in the Android app: what it includes, what it costs as
 * Google Play states it, and the terms Play's subscription policy asks for --
 * that it renews, how to cancel, what a trial becomes, and that the rest of
 * the garden needs no subscription at all.
 */
export function GardenPassPanel({
  onExploreBackdrops,
  onOpenCare,
}: {
  onExploreBackdrops: () => void
  onOpenCare: () => void
}) {
  const status = usePassStatus()
  const [offers, setOffers] = useState<OfferSummary[]>()
  const [offersReachable, setOffersReachable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  // Opening the Pass is the gardener asking, so this is where Play is asked
  // for anyone the app was not already following.
  useEffect(() => {
    void refreshPassStatus()
  }, [])

  const showOffers = status.state === 'inactive'
  useEffect(() => {
    if (!showOffers) return
    let current = true
    void getPassOffers().then(({ offers: found, reachable }) => {
      if (!current) return
      setOffers(summariseOffers(found))
      setOffersReachable(reachable)
    })
    return () => {
      current = false
    }
  }, [showOffers])

  const subscribe = async (offer: OfferSummary) => {
    setBusy(true)
    setNote('')
    try {
      const { outcome, status: after } = await subscribeToPass(offer.offerToken)
      if (after) setPassStatus(after)
      setNote(outcomeNotes[outcome])
    } finally {
      setBusy(false)
    }
  }

  const manage = async () => {
    if (!(await managePassSubscription()))
      setNote('Google Play could not be opened on this device.')
  }

  const dismissLapse = () => {
    setPassStatus({ ...status, lapsed: false })
    void dismissPassLapseNotice()
  }

  const hasTrial = offers?.some((offer) => offer.hasFreeTrial) ?? false

  return (
    <section className="pass-hero pass-panel" aria-labelledby="pass-title">
      <div>
        <p className="eyebrow">A little more wonder</p>
        <h2 id="pass-title">The Garden Pass</h2>
        <p>An optional subscription that opens a little more of the garden:</p>
        <ul className="pass-includes">
          <li>Seasonal regalia: {passOutfits.join(', ')}</li>
          <li>Extra scenes: {passScenes.join(' and ')}</li>
          <li>Up to three of your own images as garden backdrops</li>
        </ul>
        <p>
          Everything else in the garden is free and stays free, with or without
          the Pass.
        </p>

        {status.lapsed && status.state !== 'active' && (
          <div className="pass-lapse" role="status">
            <p>
              Your Garden Pass has ended. Its outfits, scenes and your own
              backdrops are resting, not deleted, and come back if you
              subscribe again.
            </p>
            <button className="text-button" onClick={dismissLapse}>
              Dismiss
            </button>
          </div>
        )}

        {(status.state === 'checking' || status.state === 'unasked') && (
          <p role="status">Checking your Garden Pass with Google Play…</p>
        )}

        {status.state === 'active' && (
          <>
            <p role="status">
              <strong>Your Garden Pass is open.</strong> Thank you for helping
              the garden grow.
            </p>
            <div className="form-actions">
              <button className="primary-button" onClick={onExploreBackdrops}>
                Explore backdrops
              </button>
              <button className="secondary-button" onClick={onOpenCare}>
                Dress a companion
              </button>
            </div>
          </>
        )}

        {status.state === 'pending' && (
          <p role="status">
            Google Play is still processing your payment. The Pass opens as
            soon as it completes.
          </p>
        )}

        {status.state === 'suspended' && (
          <p role="status">
            Your Garden Pass is on hold because Google Play could not take the
            last payment. Update your payment method in Google Play to open it
            again.
          </p>
        )}

        {status.state === 'unavailable' && (
          <>
            <p role="status">
              Google Play cannot be reached right now, so the Pass cannot be
              checked or bought. Please try again when you are connected.
            </p>
            <button
              className="secondary-button"
              onClick={() => void refreshPassStatus()}
            >
              Try again
            </button>
          </>
        )}

        {status.state === 'unconfigured' && (
          <p role="status">
            The Garden Pass is not set up in this version of the app yet.
          </p>
        )}

        {showOffers && (
          <div className="pass-offers">
            {offers === undefined ? (
              <p role="status">Loading prices from Google Play…</p>
            ) : offers.length === 0 ? (
              <p role="status">
                {offersReachable
                  ? 'The Garden Pass is not on sale in your Google Play country right now.'
                  : 'Google Play cannot be reached right now. Please try again when you are connected.'}
              </p>
            ) : (
              <>
                <ul className="pass-offer-list">
                  {offers.map((offer) => (
                    <li className="pass-offer" key={offer.key}>
                      <div>
                        <strong>{offer.plan}</strong>
                        <span>{offer.summary}</span>
                      </div>
                      <button
                        className="primary-button"
                        disabled={busy}
                        aria-label={`Subscribe: ${offer.plan}, ${offer.summary}`}
                        onClick={() => void subscribe(offer)}
                      >
                        Subscribe
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="pass-terms">
                  Subscriptions renew automatically at the price shown until
                  you cancel.
                  {hasTrial &&
                    ' A free trial becomes the paid plan at its end unless you cancel before then, and you are not charged if you do.'}{' '}
                  You can cancel at any time in Google Play; the Pass stays
                  open until the end of the period you have paid for. Payment
                  is charged to your Google Play account.
                </p>
              </>
            )}
          </div>
        )}

        {note && (
          <p className="shop-feedback" role="status">
            {note}
          </p>
        )}

        {status.state !== 'unconfigured' && (
          <button className="text-button" onClick={() => void manage()}>
            Manage or cancel in Google Play
          </button>
        )}
      </div>
      <div className="pass-illustration" aria-hidden="true">
        <span>✧</span>
        <strong>
          A garden
          <br />
          uniquely yours.
        </strong>
        <small>Outfits · scenes · your own images</small>
      </div>
    </section>
  )
}
