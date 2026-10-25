/**
 * The Garden Pass's Google Play side, as the web layer sees it.
 *
 * A thin, typed face for GardenBillingPlugin (android/.../billing). Every
 * function checks `import.meta.env.VITE_PLATFORM` inline, like native.ts, so
 * none of this reaches Capacitor in the PWA. Anything the native side sends is
 * checked before it is believed: an unexpected shape reads as "unavailable",
 * never as access.
 */
import type { PluginListenerHandle } from '@capacitor/core'
import { attach, inAppPlugin, type Unsubscribe } from './native'

export type PassState =
  /** Not yet asked. */
  | 'checking'
  | 'active'
  | 'pending'
  | 'suspended'
  | 'inactive'
  | 'unavailable'
  /** This build has no licence key, so nothing can be verified. */
  | 'unconfigured'

export interface PassStatus {
  state: PassState
  /** Open on the strength of a recent confirmation, Play unreachable now. */
  fromCache: boolean
  /** A Pass this device had confirmed has ended, and nobody has been told. */
  lapsed: boolean
}

export interface PassPricingPhase {
  formattedPrice: string
  priceMicros: number
  currency: string
  /** ISO 8601 duration, e.g. P1M, P1Y, P7D. */
  billingPeriod: string
  cycles: number
  recurrence: 'infinite' | 'finite' | 'once'
}

export interface PassOffer {
  basePlanId: string
  offerId: string | null
  offerToken: string
  phases: PassPricingPhase[]
}

export type PurchaseOutcome =
  | 'purchased'
  | 'pending'
  | 'cancelled'
  | 'unavailable'
  | 'failed'
  /** Play finished, but the Pass could not be confirmed as active. */
  | 'unconfirmed'

interface GardenBillingPlugin {
  getStatus(): Promise<unknown>
  getOffers(): Promise<unknown>
  subscribe(options: { offerToken: string }): Promise<unknown>
  manage(): Promise<void>
  dismissLapseNotice(): Promise<void>
  addListener(
    event: 'statusChanged',
    handler: (status: unknown) => void,
  ): Promise<PluginListenerHandle>
}

const UNAVAILABLE: PassStatus = {
  state: 'unavailable',
  fromCache: false,
  lapsed: false,
}

const STATES: readonly PassState[] = [
  'active',
  'pending',
  'suspended',
  'inactive',
  'unavailable',
  'unconfigured',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The native answer, or "unavailable" if it is not one this code knows. */
export function parseStatus(value: unknown): PassStatus {
  if (!isRecord(value)) return UNAVAILABLE
  const state = STATES.find((known) => known === value.state)
  if (!state) return UNAVAILABLE
  return {
    state,
    fromCache: value.fromCache === true,
    lapsed: value.lapsed === true,
  }
}

function parsePhase(value: unknown): PassPricingPhase | undefined {
  if (!isRecord(value)) return undefined
  const {
    formattedPrice,
    priceMicros,
    currency,
    billingPeriod,
    cycles,
    recurrence,
  } = value
  if (
    typeof formattedPrice !== 'string' ||
    typeof priceMicros !== 'number' ||
    typeof currency !== 'string' ||
    typeof billingPeriod !== 'string' ||
    typeof cycles !== 'number' ||
    (recurrence !== 'infinite' &&
      recurrence !== 'finite' &&
      recurrence !== 'once')
  )
    return undefined
  return {
    formattedPrice,
    priceMicros,
    currency,
    billingPeriod,
    cycles,
    recurrence,
  }
}

/** Offers Play sent, dropping any that cannot be shown honestly. */
export function parseOffers(value: unknown): PassOffer[] {
  if (!isRecord(value) || !Array.isArray(value.offers)) return []
  const offers: PassOffer[] = []
  for (const entry of value.offers as unknown[]) {
    if (!isRecord(entry)) continue
    const { basePlanId, offerId, offerToken } = entry
    if (typeof basePlanId !== 'string' || typeof offerToken !== 'string')
      continue
    if (!Array.isArray(entry.phases)) continue
    const phases = (entry.phases as unknown[]).map(parsePhase)
    if (phases.length === 0 || phases.some((phase) => !phase)) continue
    offers.push({
      basePlanId,
      offerId: typeof offerId === 'string' ? offerId : null,
      offerToken,
      phases: phases as PassPricingPhase[],
    })
  }
  return offers
}

const OUTCOMES: readonly PurchaseOutcome[] = [
  'purchased',
  'pending',
  'cancelled',
  'unavailable',
  'failed',
  'unconfirmed',
]

/**
 * The plugin, still inside its wrapper object. Never unwrap it into a return
 * value or a resolved promise: the proxy looks like a thenable (see
 * inAppPlugin), so each caller destructures it where it uses it.
 */
const billing = () => inAppPlugin<GardenBillingPlugin>('GardenBilling')

/** Ask Google Play, on this device, whether the Pass is open. */
export async function getPassStatus(): Promise<PassStatus> {
  if (import.meta.env.VITE_PLATFORM !== 'android') return UNAVAILABLE
  try {
    const { plugin } = await billing()
    return parseStatus(await plugin.getStatus())
  } catch {
    return UNAVAILABLE
  }
}

/** The Pass's plans with Play's own local prices; empty if Play cannot say. */
export async function getPassOffers(): Promise<{
  offers: PassOffer[]
  reachable: boolean
}> {
  if (import.meta.env.VITE_PLATFORM !== 'android')
    return { offers: [], reachable: false }
  try {
    const { plugin } = await billing()
    const answer = await plugin.getOffers()
    return {
      offers: parseOffers(answer),
      reachable: isRecord(answer) && answer.reachable === true,
    }
  } catch {
    return { offers: [], reachable: false }
  }
}

/** Open Google Play's purchase sheet for one offer. */
export async function subscribeToPass(offerToken: string): Promise<{
  outcome: PurchaseOutcome
  status?: PassStatus
}> {
  if (import.meta.env.VITE_PLATFORM !== 'android')
    return { outcome: 'unavailable' }
  try {
    const { plugin } = await billing()
    const answer = await plugin.subscribe({ offerToken })
    if (!isRecord(answer)) return { outcome: 'failed' }
    const outcome =
      OUTCOMES.find((known) => known === answer.outcome) ?? 'failed'
    return answer.status === undefined
      ? { outcome }
      : { outcome, status: parseStatus(answer.status) }
  } catch {
    return { outcome: 'failed' }
  }
}

/** Google Play's own page for this subscription: change, fix payment, cancel. */
export async function managePassSubscription(): Promise<boolean> {
  if (import.meta.env.VITE_PLATFORM !== 'android') return false
  try {
    const { plugin } = await billing()
    await plugin.manage()
    return true
  } catch {
    return false
  }
}

/** The "your Pass has ended" notice was seen; do not show it again. */
export async function dismissPassLapseNotice(): Promise<void> {
  if (import.meta.env.VITE_PLATFORM !== 'android') return
  try {
    const { plugin } = await billing()
    await plugin.dismissLapseNotice()
  } catch {
    // Shown again next time, which is the safer way round.
  }
}

/** Play's answers as they change: a renewal, a lapse, a payment completing. */
export function onPassStatusChange(
  handler: (status: PassStatus) => void,
): Unsubscribe {
  if (import.meta.env.VITE_PLATFORM !== 'android') return () => undefined
  return attach(
    billing().then(({ plugin }) =>
      plugin.addListener('statusChanged', (status) =>
        handler(parseStatus(status)),
      ),
    ),
  )
}
