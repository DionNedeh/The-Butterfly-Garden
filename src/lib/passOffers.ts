/**
 * The Garden Pass's plans, put into plain words.
 *
 * Google Play's subscription rules decide much of this: the price shown is
 * the one Play will charge, in Play's own localised formatting (never
 * recomputed here), for the period it is charged for. A yearly plan is shown
 * as its yearly price, not broken down into a monthly figure, and a free
 * trial always says what it becomes.
 */
import type { PassOffer, PassPricingPhase } from './playBilling'

export interface OfferSummary {
  /** Stable React key. */
  key: string
  offerToken: string
  /** "Monthly", "Yearly", "Every 3 months"… */
  plan: string
  /** The recurring charge: "£2.49 a month". */
  price: string
  /** Everything before the recurring charge, if anything: "Free for 7 days". */
  introduction?: string
  /** One sentence for the button's neighbour: "Free for 7 days, then £2.49 a month". */
  summary: string
  hasFreeTrial: boolean
}

interface Period {
  count: number
  unit: 'day' | 'week' | 'month' | 'year'
}

/** ISO 8601 durations as Play sends them: P7D, P1W, P1M, P3M, P1Y. */
export function parsePeriod(iso: string): Period | undefined {
  const match = /^P(\d+)([DWMY])$/.exec(iso)
  if (!match) return undefined
  const count = Number(match[1])
  if (!Number.isInteger(count) || count < 1) return undefined
  const unit = ({ D: 'day', W: 'week', M: 'month', Y: 'year' } as const)[
    match[2] as 'D' | 'W' | 'M' | 'Y'
  ]
  return { count, unit }
}

/** "7 days", "1 month", "3 months". */
function length(period: Period): string {
  return `${period.count} ${period.unit}${period.count === 1 ? '' : 's'}`
}

/** "a month", "every 3 months". */
function cadence(period: Period): string {
  return period.count === 1 ? `a ${period.unit}` : `every ${length(period)}`
}

function planName(period: Period): string {
  if (period.count === 1)
    return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[
      period.unit
    ]
  return `Every ${length(period)}`
}

/** Rough length in days, only for ordering plans shortest first. */
function approximateDays(period: Period): number {
  return (
    period.count * { day: 1, week: 7, month: 30, year: 365 }[period.unit]
  )
}

function describePhase(phase: PassPricingPhase, period: Period): string {
  const span = length({
    count: period.count * Math.max(phase.cycles, 1),
    unit: period.unit,
  })
  if (phase.priceMicros === 0) return `Free for ${span}`
  return `${phase.formattedPrice} ${cadence(period)} for ${span}`
}

/**
 * One offer in words, or undefined if Play sent something this cannot state
 * accurately (no recurring price, an unreadable period). An offer that cannot
 * be described honestly is not offered.
 */
export function describeOffer(offer: PassOffer): OfferSummary | undefined {
  const recurring = offer.phases.at(-1)
  if (!recurring || recurring.recurrence !== 'infinite') return undefined
  const recurringPeriod = parsePeriod(recurring.billingPeriod)
  if (!recurringPeriod) return undefined

  const lead: string[] = []
  for (const phase of offer.phases.slice(0, -1)) {
    const period = parsePeriod(phase.billingPeriod)
    if (!period) return undefined
    lead.push(describePhase(phase, period))
  }
  const price = `${recurring.formattedPrice} ${cadence(recurringPeriod)}`
  const introduction = lead.length ? lead.join(', then ') : undefined
  return {
    key: `${offer.basePlanId}:${offer.offerId ?? 'base'}`,
    offerToken: offer.offerToken,
    plan: planName(recurringPeriod),
    price,
    introduction,
    summary: introduction ? `${introduction}, then ${price}` : price,
    hasFreeTrial: offer.phases.some(
      (phase, index) =>
        index < offer.phases.length - 1 && phase.priceMicros === 0,
    ),
  }
}

/**
 * One card per plan, shortest first. Play only sends offers this account is
 * eligible for; where a plan has both its plain base offer and a special one
 * (a free trial), the special one is shown, as Play recommends.
 */
export function summariseOffers(offers: PassOffer[]): OfferSummary[] {
  const byPlan = new Map<string, PassOffer>()
  for (const offer of offers) {
    const existing = byPlan.get(offer.basePlanId)
    if (!existing || (existing.offerId === null && offer.offerId !== null))
      byPlan.set(offer.basePlanId, offer)
  }
  const described: Array<{ summary: OfferSummary; days: number }> = []
  for (const offer of byPlan.values()) {
    const summary = describeOffer(offer)
    const period = parsePeriod(offer.phases.at(-1)?.billingPeriod ?? '')
    if (summary && period)
      described.push({ summary, days: approximateDays(period) })
  }
  return described
    .sort((a, b) => a.days - b.days)
    .map(({ summary }) => summary)
}
