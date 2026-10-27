import { currencyLabel } from '../../lib/currency'
import type { PurchaseOutcome } from '../../lib/purchase'

/** What was being bought, as the toast names it. */
export interface PurchaseSubject {
  name: string
  /**
   * The name as a screen reader should say it, where that differs from the
   * one shown: a jar's mark, said by its name (lib/jars jarSpokenName).
   */
  spokenName?: string
  kind: 'supply' | 'piece' | 'pattern' | 'jar'
  /** Supplies only: how many were asked for. */
  quantity?: number
}

/**
 * The words for a purchase's outcome. Kept beside the shop rather than in
 * lib/purchase, which the app shell loads: only the shop ever says these.
 * Every refusal ends by saying nothing was spent, because that is the first
 * thing anyone wonders when a purchase does not go through.
 */
function purchaseMessage(outcome: PurchaseOutcome, subject: PurchaseSubject): string {
  const named = (quantity = 1) =>
    quantity > 1 ? `${subject.name} ×${quantity}` : subject.name
  switch (outcome.kind) {
    case 'bought': {
      const price = `${outcome.spent} ${currencyLabel(outcome.currency)}`
      if (subject.kind === 'supply')
        return `${named(outcome.quantity)} added to your satchel, for ${price}.`
      if (subject.kind === 'jar')
        return `${subject.name} added, for ${price}. Place it from a plant's detail panel in Garden.`
      if (subject.kind === 'pattern')
        return `${subject.name} is yours, for ${price}. Choose a pattern to fly it.`
      return `${subject.name} is yours, for ${price}. Every companion can wear it.`
    }
    case 'short':
      return `${named(subject.quantity)} needs ${outcome.needed} more ${currencyLabel(outcome.currency)}, so nothing was spent.`
    case 'owned':
      return `You already have ${subject.name}, so nothing was spent.`
    case 'unavailable':
      if (outcome.reason === 'pass')
        return `${subject.name} comes with the Garden Pass, so nothing was spent.`
      if (outcome.reason === 'full') return 'Your jar shelf is full, so nothing was spent.'
      return `${subject.name} could not be bought, so nothing was spent.`
  }
}

/**
 * A purchase's outcome in words, as shown and, where the name is said
 * differently (a jar's mark), as a screen reader should say them.
 */
export function purchaseWords(
  outcome: PurchaseOutcome,
  subject: PurchaseSubject,
): { text: string; spoken?: string } {
  const text = purchaseMessage(outcome, subject)
  if (subject.spokenName === undefined || subject.spokenName === subject.name) return { text }
  return { text, spoken: purchaseMessage(outcome, { ...subject, name: subject.spokenName }) }
}
