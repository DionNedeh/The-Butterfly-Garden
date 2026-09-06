import type { AppState, CurrencyId } from '../types'

/** The two currencies a purchase can be priced in. Seeds are not spendable here. */
export type SpendableCurrency = Extract<CurrencyId, 'nectar' | 'stardust'>

/**
 * How a price is written for the gardener.
 *
 * The shop and the flight pattern gallery both show prices, and they have to
 * agree: naming the wrong currency sends someone to the shop with a balance
 * they cannot spend there. Keeping the wording in one place is what stops the
 * two views drifting apart again.
 */
export function currencyLabel(currency: SpendableCurrency): string {
  return currency === 'stardust' ? 'Stardust' : 'Nectar'
}

/** The balance a purchase in this currency draws on. */
export function balanceFor(
  state: Pick<AppState, 'nectar' | 'stardust'>,
  currency: SpendableCurrency,
): number {
  return currency === 'stardust' ? state.stardust : state.nectar
}
