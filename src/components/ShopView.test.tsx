import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JAR_CAPACITY, JAR_PRICE } from '../data/jars'
import { shopItems } from '../data/shopItems'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { ShopView } from './ShopView'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Tester', 'Shop'), nectar: 200, stardust: 50, ...overrides }
}

function renderShop(state: AppState = garden(), initialTab?: Parameters<typeof ShopView>[0]['initialTab']) {
  const handlers = {
    onPurchasePattern: vi.fn(),
    onPurchaseJar: vi.fn(),
    onPurchaseItem: vi.fn(),
    onOpenCare: vi.fn(),
    onOpenFlight: vi.fn(),
    onSelectBackdrop: vi.fn(),
    onSaveCustomBackdrop: vi.fn(() => Promise.resolve({ ok: true })),
    onSelectCustomBackdrop: vi.fn(),
    onDeleteCustomBackdrop: vi.fn(),
  }
  render(<ShopView state={state} initialTab={initialTab} {...handlers} />)
  return { handlers, user: userEvent.setup() }
}

const tabs = () => within(screen.getByRole('navigation', { name: 'Shop sections' }))
const count = () => screen.getByText(/to explore/).textContent ?? ''

describe('the shop', () => {
  it('opens on supplies and buys one, saying what was added', async () => {
    const { handlers, user } = renderShop()
    expect(screen.getByRole('heading', { name: 'Thoughtful care, every day' })).toBeInTheDocument()
    const supplies = shopItems.filter((item) => item.kind === 'supply')
    expect(count()).toContain(`${supplies.length} pieces`)

    await user.click(screen.getAllByRole('button', { name: 'Buy one' })[0])
    expect(handlers.onPurchaseItem).toHaveBeenCalledWith(supplies[0].id)
    expect(screen.getByText(`${supplies[0].name} added to your garden.`)).toBeInTheDocument()
  })

  it('says how much more a piece needs when it cannot be afforded', () => {
    renderShop(garden({ nectar: 0, stardust: 0 }))
    expect(screen.getAllByRole('button', { name: /^Need \d+ more$/ }).length).toBeGreaterThan(0)
  })

  it('searches, finds nothing, and shows the collection again', async () => {
    const { user } = renderShop()
    await user.type(screen.getByRole('searchbox'), 'nothing could ever be called this')
    expect(screen.getByRole('heading', { name: 'Nothing in this little corner yet' })).toBeInTheDocument()
    expect(count()).toContain('0 pieces')
    await user.click(screen.getByRole('button', { name: 'Show the collection' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('filters the boutique by type, stage, ownership, currency and budget', async () => {
    const owned = shopItems.find((item) => item.kind === 'cosmetic' && !item.premium)!
    const { user } = renderShop(garden({ ownedItemIds: [owned.id] }), 'boutique')
    const all = Number(count().match(/\d+/)?.[0])

    await user.selectOptions(screen.getByRole('combobox', { name: /^Type/ }), 'aura')
    const auras = Number(count().match(/\d+/)?.[0])
    expect(auras).toBeLessThan(all)
    expect(auras).toBeGreaterThan(0)

    await user.selectOptions(screen.getByRole('combobox', { name: /^Life stage/ }), 'egg')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Collection/ }), 'owned')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Currency/ }), 'stardust')
    await user.click(screen.getByRole('checkbox', { name: 'Within my budget' }))
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(Number(count().match(/\d+/)?.[0])).toBe(all)

    // An owned piece opens the wardrobe instead of selling it again.
    await user.selectOptions(screen.getByRole('combobox', { name: /^Collection/ }), 'owned')
    expect(screen.getByRole('button', { name: 'Open wardrobe' })).toBeInTheDocument()
    expect(screen.getByText('Owned · shared by all companions')).toBeInTheDocument()
  })

  it('previews a piece and closes the preview', async () => {
    const { user } = renderShop(garden(), 'boutique')
    const first = shopItems.find((item) => item.kind === 'cosmetic' && !item.premium)!
    await user.click(screen.getByRole('button', { name: `Preview ${first.name}` }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { hidden: true }))
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('moves between its sections', async () => {
    const { user } = renderShop()
    await user.click(tabs().getByRole('button', { name: 'Boutique' }))
    expect(screen.getByRole('heading', { name: 'Made for little personalities' })).toBeInTheDocument()
    await user.click(tabs().getByRole('button', { name: 'Backdrops' }))
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})

describe('jars', () => {
  it('chooses a letter and a colour, and buys that jar', async () => {
    const { handlers, user } = renderShop(garden(), 'jars')
    await user.click(screen.getByRole('button', { name: 'Q', pressed: false }))
    await user.click(screen.getByRole('button', { name: /^Pink$/ }))
    await user.click(screen.getByRole('button', { name: 'Buy Pink Q jar' }))
    expect(handlers.onPurchaseJar).toHaveBeenCalledWith('Q', 'pink')
    expect(screen.getByText(/Q jar added/)).toBeInTheDocument()
  })

  it('will not sell a jar it cannot pay for, or one with no shelf room', () => {
    renderShop(garden({ nectar: JAR_PRICE - 1 }), 'jars')
    expect(screen.getByRole('button', { name: 'Not enough Nectar' })).toBeDisabled()
  })

  it('says when the jar shelf is full', () => {
    const jars = Array.from({ length: JAR_CAPACITY }, (_, index) => ({
      id: `j${index}`,
      character: 'A',
      colorId: 'blue' as const,
      purchasedAt: '',
    }))
    renderShop(garden({ jars }), 'jars')
    expect(screen.getByRole('button', { name: 'Your jar shelf is full' })).toBeDisabled()
  })
})

describe('flight patterns', () => {
  it('sells patterns not owned yet, and points to choosing one', async () => {
    const { handlers, user } = renderShop(garden({ nectar: 1000, stardust: 1000 }), 'flight')
    const buy = screen.getAllByRole('button', { name: /^Buy / })[0]
    await user.click(buy)
    expect(handlers.onPurchasePattern).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Choose a pattern' }))
    expect(handlers.onOpenFlight).toHaveBeenCalledOnce()
  })

  it('says when a pattern cannot be afforded', () => {
    renderShop(garden({ nectar: 0, stardust: 0 }), 'flight')
    expect(screen.getAllByRole('button', { name: /^Not enough / })[0]).toBeDisabled()
  })
})

describe('the Garden Pass in the PWA', () => {
  it('previews what the Pass brings and leads to it', async () => {
    const { handlers, user } = renderShop(garden(), 'pass')
    expect(screen.getByRole('heading', { name: 'Your Garden Pass preview' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dress a companion' }))
    expect(handlers.onOpenCare).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Explore backdrops' }))
    expect(screen.queryByRole('heading', { name: 'Your Garden Pass preview' })).toBeNull()
  })
})
