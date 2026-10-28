import type { AppState } from '../types'
import { balanceFor, type SpendableCurrency } from './currency'

/**
 * Why something cannot be bought whatever the balance: it comes with the
 * Garden Pass, there is no room left for it, or the shop does not sell it.
 */
export type UnavailableReason = 'pass' | 'full' | 'unknown'

/**
 * What became of an attempt to buy something.
 *
 * A refused purchase hands back the garden untouched, which on its own looks
 * just like any other answer, so the shop used to say "added to your garden"
 * whether or not anything was. The outcome is what lets it tell the gardener
 * what actually happened, and, when the balance fell short, by how much.
 */
export type PurchaseOutcome =
  | { kind: 'bought'; quantity: number; spent: number; currency: SpendableCurrency }
  | { kind: 'short'; currency: SpendableCurrency; needed: number }
  | { kind: 'owned' }
  | { kind: 'unavailable'; reason: UnavailableReason }

export type RefusedOutcome = Exclude<PurchaseOutcome, { kind: 'bought' }>

/** A purchase reducer's answer: the garden after it, and what happened. */
export interface PurchaseResult {
  state: AppState
  outcome: PurchaseOutcome
}

/** Nothing bought: the very same garden, and the reason. */
export function refuse(state: AppState, outcome: RefusedOutcome): PurchaseResult {
  return { state, outcome }
}

/**
 * Pay `cost` and hand over `goods`, or refuse the whole of it when the
 * balance cannot cover it. Never part of it: three supplies for the price of
 * two is not a purchase anyone asked for. `goods` is only worked out once the
 * price is paid, so a refusal creates nothing (a jar's id, for one).
 */
export function payFor(
  state: AppState,
  price: { cost: number; currency: SpendableCurrency; quantity?: number },
  goods: () => Partial<AppState>,
): PurchaseResult {
  const { cost, currency, quantity = 1 } = price
  const needed = cost - balanceFor(state, currency)
  if (needed > 0) return refuse(state, { kind: 'short', currency, needed })
  const paid =
    currency === 'stardust'
      ? { stardust: state.stardust - cost }
      : { nectar: state.nectar - cost }
  return {
    state: { ...state, ...paid, ...goods() },
    outcome: { kind: 'bought', quantity, spent: cost, currency },
  }
}
