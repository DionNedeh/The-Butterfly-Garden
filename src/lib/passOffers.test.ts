import { describe, expect, it } from 'vitest'
import { describeOffer, parsePeriod, summariseOffers } from './passOffers'
import type { PassOffer, PassPricingPhase } from './playBilling'

const recurring = (formattedPrice: string, billingPeriod: string, priceMicros = 2_490_000): PassPricingPhase => ({
  formattedPrice,
  priceMicros,
  currency: 'GBP',
  billingPeriod,
  cycles: 0,
  recurrence: 'infinite',
})

const trial = (billingPeriod: string): PassPricingPhase => ({
  formattedPrice: 'Free',
  priceMicros: 0,
  currency: 'GBP',
  billingPeriod,
  cycles: 1,
  recurrence: 'finite',
})

const offer = (basePlanId: string, phases: PassPricingPhase[], offerId: string | null = null): PassOffer => ({
  basePlanId,
  offerId,
  offerToken: `${basePlanId}-${offerId ?? 'base'}-token`,
  phases,
})

describe('parsePeriod', () => {
  it('reads the durations Play sends', () => {
    expect(parsePeriod('P1M')).toEqual({ count: 1, unit: 'month' })
    expect(parsePeriod('P1Y')).toEqual({ count: 1, unit: 'year' })
    expect(parsePeriod('P7D')).toEqual({ count: 7, unit: 'day' })
    expect(parsePeriod('P3M')).toEqual({ count: 3, unit: 'month' })
  })

  it('refuses anything it cannot state accurately', () => {
    for (const bad of ['', 'P', 'P0M', 'P1M2D', 'PT1H', '1M', 'P1X'])
      expect(parsePeriod(bad)).toBeUndefined()
  })
})

describe('describeOffer', () => {
  it('states a plain plan as the price charged for the period charged', () => {
    expect(describeOffer(offer('monthly', [recurring('£2.49', 'P1M')]))).toMatchObject({
      plan: 'Monthly',
      price: '£2.49 a month',
      summary: '£2.49 a month',
      hasFreeTrial: false,
    })
  })

  it('shows a yearly plan at its yearly price, never broken into months', () => {
    const summary = describeOffer(offer('yearly', [recurring('£19.99', 'P1Y', 19_990_000)]))
    expect(summary?.plan).toBe('Yearly')
    expect(summary?.price).toBe('£19.99 a year')
    expect(summary?.summary).not.toMatch(/month/)
  })

  it('says what a free trial becomes', () => {
    expect(
      describeOffer(offer('monthly', [trial('P7D'), recurring('£2.49', 'P1M')], 'free-week')),
    ).toMatchObject({
      introduction: 'Free for 7 days',
      summary: 'Free for 7 days, then £2.49 a month',
      hasFreeTrial: true,
    })
  })

  it('describes an introductory price over its whole span', () => {
    const intro: PassPricingPhase = {
      formattedPrice: '£0.99',
      priceMicros: 990_000,
      currency: 'GBP',
      billingPeriod: 'P1M',
      cycles: 3,
      recurrence: 'finite',
    }
    expect(
      describeOffer(offer('monthly', [intro, recurring('£2.49', 'P1M')], 'intro'))?.summary,
    ).toBe('£0.99 a month for 3 months, then £2.49 a month')
  })

  it('names longer cadences plainly', () => {
    expect(describeOffer(offer('quarterly', [recurring('£6.99', 'P3M')]))).toMatchObject({
      plan: 'Every 3 months',
      price: '£6.99 every 3 months',
    })
  })

  it('offers nothing it cannot describe honestly', () => {
    expect(describeOffer(offer('broken', []))).toBeUndefined()
    expect(describeOffer(offer('one-off', [{ ...recurring('£2.49', 'P1M'), recurrence: 'once' }]))).toBeUndefined()
    expect(describeOffer(offer('odd', [recurring('£2.49', 'P1M2D')]))).toBeUndefined()
    expect(describeOffer(offer('odd-trial', [trial('PT1H'), recurring('£2.49', 'P1M')]))).toBeUndefined()
  })
})

describe('summariseOffers', () => {
  it('shows one card per plan, shortest first, preferring the special offer', () => {
    const cards = summariseOffers([
      offer('yearly', [recurring('£19.99', 'P1Y', 19_990_000)]),
      offer('monthly', [recurring('£2.49', 'P1M')]),
      offer('monthly', [trial('P7D'), recurring('£2.49', 'P1M')], 'free-week'),
    ])
    expect(cards.map((card) => card.summary)).toEqual([
      'Free for 7 days, then £2.49 a month',
      '£19.99 a year',
    ])
    expect(cards[0].offerToken).toBe('monthly-free-week-token')
  })

  it('leaves out plans it cannot describe rather than guessing', () => {
    expect(summariseOffers([offer('broken', [])])).toEqual([])
  })
})
