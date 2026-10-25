import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setPassStatus } from '../../lib/passEntitlement'
import * as billing from '../../lib/playBilling'
import type { PassOffer, PassState } from '../../lib/playBilling'
import { GardenPassPanel } from './GardenPassPanel'

vi.mock('../../lib/playBilling', () => ({
  getPassStatus: vi.fn(() =>
    Promise.resolve({ state: 'inactive', fromCache: false, lapsed: false }),
  ),
  getPassOffers: vi.fn(),
  subscribeToPass: vi.fn(),
  managePassSubscription: vi.fn(() => Promise.resolve(true)),
  dismissPassLapseNotice: vi.fn(() => Promise.resolve()),
  onPassStatusChange: vi.fn(() => () => undefined),
}))

const monthlyTrial: PassOffer = {
  basePlanId: 'monthly',
  offerId: 'free-week',
  offerToken: 'monthly-trial-token',
  phases: [
    { formattedPrice: 'Free', priceMicros: 0, currency: 'GBP', billingPeriod: 'P7D', cycles: 1, recurrence: 'finite' },
    { formattedPrice: '£2.49', priceMicros: 2_490_000, currency: 'GBP', billingPeriod: 'P1M', cycles: 0, recurrence: 'infinite' },
  ],
}
const yearly: PassOffer = {
  basePlanId: 'yearly',
  offerId: null,
  offerToken: 'yearly-token',
  phases: [
    { formattedPrice: '£19.99', priceMicros: 19_990_000, currency: 'GBP', billingPeriod: 'P1Y', cycles: 0, recurrence: 'infinite' },
  ],
}

function show(state: PassState, lapsed = false) {
  act(() => setPassStatus({ state, fromCache: false, lapsed }))
}

function renderPanel() {
  const onExploreBackdrops = vi.fn()
  const onOpenCare = vi.fn()
  render(
    <GardenPassPanel
      onExploreBackdrops={onExploreBackdrops}
      onOpenCare={onOpenCare}
    />,
  )
  return { onExploreBackdrops, onOpenCare }
}

describe('GardenPassPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(billing.getPassOffers).mockResolvedValue({
      offers: [yearly, monthlyTrial],
      reachable: true,
    })
    show('checking')
  })

  it('says it is checking before Play has answered', () => {
    renderPanel()
    expect(screen.getByText(/checking your garden pass/i)).toBeInTheDocument()
  })

  it('states that the rest of the garden needs no subscription', () => {
    renderPanel()
    expect(
      screen.getByText(/everything else in the garden is free and stays free/i),
    ).toBeInTheDocument()
  })

  it('offers each plan at the price Play will charge, with the terms', async () => {
    renderPanel()
    show('inactive')
    expect(
      await screen.findByText('Free for 7 days, then £2.49 a month'),
    ).toBeInTheDocument()
    expect(screen.getByText('£19.99 a year')).toBeInTheDocument()
    expect(screen.getByText(/renew automatically at the price shown/i)).toBeInTheDocument()
    expect(screen.getByText(/you are not charged if you do/i)).toBeInTheDocument()
    expect(screen.getByText(/cancel at any time in google play/i)).toBeInTheDocument()
    // Shortest plan first.
    const buttons = screen.getAllByRole('button', { name: /^subscribe/i })
    expect(buttons[0]).toHaveAccessibleName(/Monthly, Free for 7 days/)
  })

  it('opens the Pass when Play confirms a purchase', async () => {
    const user = userEvent.setup()
    vi.mocked(billing.subscribeToPass).mockResolvedValue({
      outcome: 'purchased',
      status: { state: 'active', fromCache: false, lapsed: false },
    })
    const { onExploreBackdrops } = renderPanel()
    show('inactive')
    await user.click(
      await screen.findByRole('button', { name: /subscribe: yearly/i }),
    )
    expect(billing.subscribeToPass).toHaveBeenCalledWith('yearly-token')
    expect(await screen.findByText(/welcome to the garden pass/i)).toBeInTheDocument()
    expect(screen.getByText(/your garden pass is open/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Explore backdrops' }))
    expect(onExploreBackdrops).toHaveBeenCalled()
  })

  it('says plainly when the gardener backs out', async () => {
    const user = userEvent.setup()
    vi.mocked(billing.subscribeToPass).mockResolvedValue({ outcome: 'cancelled' })
    renderPanel()
    show('inactive')
    await user.click(
      await screen.findByRole('button', { name: /subscribe: monthly/i }),
    )
    expect(await screen.findByText('No purchase was made.')).toBeInTheDocument()
  })

  it('explains a payment on hold', () => {
    renderPanel()
    show('suspended')
    expect(screen.getByText(/could not take the last payment/i)).toBeInTheDocument()
  })

  it('offers to try again when Play cannot be reached', async () => {
    const user = userEvent.setup()
    renderPanel()
    show('unavailable')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(billing.getPassStatus).toHaveBeenCalled()
  })

  it('says when a build has no Pass set up, and offers no Play link', () => {
    renderPanel()
    show('unconfigured')
    expect(screen.getByText(/not set up in this version/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /manage or cancel/i }),
    ).toBeNull()
  })

  it('always links to Google Play to manage or cancel', async () => {
    const user = userEvent.setup()
    vi.mocked(billing.managePassSubscription).mockResolvedValueOnce(false)
    renderPanel()
    show('active')
    await user.click(screen.getByRole('button', { name: /manage or cancel in google play/i }))
    expect(billing.managePassSubscription).toHaveBeenCalled()
    expect(await screen.findByText(/could not be opened/i)).toBeInTheDocument()
  })

  it('tells a gardener whose Pass ended, once, that nothing was deleted', async () => {
    const user = userEvent.setup()
    renderPanel()
    show('inactive', true)
    expect(screen.getByText(/resting, not deleted/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(billing.dismissPassLapseNotice).toHaveBeenCalled()
    expect(screen.queryByText(/resting, not deleted/i)).toBeNull()
  })

  it('says when there is nothing on sale rather than inventing a price', async () => {
    vi.mocked(billing.getPassOffers).mockResolvedValue({ offers: [], reachable: true })
    renderPanel()
    show('inactive')
    expect(await screen.findByText(/not on sale in your google play country/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^subscribe/i })).toBeNull()
  })
})
