import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JAR_CAPACITY, JAR_PRICE } from '../data/jars'
import { shopItems } from '../data/shopItems'
import { requestDialogClose } from '../lib/backNavigation'
import { buyFlightPattern } from '../lib/flightPatterns'
import { buyJar } from '../lib/jars'
import { createInitialState } from '../lib/progression'
import { buyShopItem } from '../lib/wardrobe'
import type { AppState, FlightPatternId, JarColorId } from '../types'
import { PURCHASE_TOAST_MS } from './shop/PurchaseToast'
import { ShopView } from './ShopView'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Tester', 'Shop'), nectar: 200, stardust: 50, ...overrides }
}

function renderShop(state: AppState = garden(), initialTab?: Parameters<typeof ShopView>[0]['initialTab']) {
  // Each purchase answers with what the real reducer says of this garden.
  const handlers = {
    onPurchasePattern: vi.fn((id: FlightPatternId) => buyFlightPattern(state, id).outcome),
    onPurchaseJar: vi.fn(
      (character: string, color: JarColorId) => buyJar(state, character, color).outcome,
    ),
    onPurchaseItem: vi.fn(
      (id: string, quantity?: number) => buyShopItem(state, id, quantity).outcome,
    ),
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
// The sheet, when open, says the same count as the line behind it.
const count = () => screen.getAllByText(/to explore/).at(-1)?.textContent ?? ''
const card = (name: string) => screen.getByRole('heading', { name }).closest('article')!

/**
 * A phone-sized screen, as matchMedia reports it, that can be widened later.
 * jsdom has no matchMedia of its own, so without this the shop is wide.
 */
function phoneScreen() {
  let phone = true
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return phone && query.includes('max-width')
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }))
  return {
    widen: () => {
      phone = false
      act(() => listeners.forEach((listener) => listener()))
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the shop', () => {
  it('opens on supplies and buys one, saying what was added', async () => {
    const { handlers, user } = renderShop()
    expect(screen.getByRole('heading', { name: 'Thoughtful care, every day' })).toBeInTheDocument()
    const supplies = shopItems.filter((item) => item.kind === 'supply')
    expect(count()).toContain(`${supplies.length} pieces`)

    await user.click(screen.getAllByRole('button', { name: 'Buy one' })[0])
    expect(handlers.onPurchaseItem).toHaveBeenCalledWith(supplies[0].id, 1)
    const toast = screen.getByText(
      `${supplies[0].name} added to your satchel, for ${supplies[0].cost} Nectar.`,
    )
    // Said aloud politely, from a region that was there before the words.
    expect(toast.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite')
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

describe('supplies in quantity', () => {
  it('buys three or five at once, priced exactly before anything is spent', async () => {
    const { handlers, user } = renderShop(garden({ nectar: 9 }))
    const leaf = within(card('Leaf Bundle'))
    const howMany = within(leaf.getByRole('group', { name: 'How many Leaf Bundle' }))
    expect(howMany.getByRole('button', { name: '×1' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(howMany.getByRole('button', { name: '×3' }))
    expect(howMany.getByRole('button', { name: '×3' })).toHaveAttribute('aria-pressed', 'true')
    expect(leaf.getByText('6 Nectar')).toBeInTheDocument()
    await user.click(leaf.getByRole('button', { name: 'Buy 3' }))
    expect(handlers.onPurchaseItem).toHaveBeenCalledWith('leaf-bundle', 3)
    expect(screen.getByText('Leaf Bundle ×3 added to your satchel, for 6 Nectar.')).toBeInTheDocument()

    // Five would be 10 Nectar, one more than the garden holds. The button
    // stays pressable, so pressing it says so instead of nothing.
    await user.click(howMany.getByRole('button', { name: '×5' }))
    expect(leaf.getByText('10 Nectar')).toBeInTheDocument()
    const need = leaf.getByRole('button', { name: 'Need 1 more' })
    expect(need).toHaveAttribute('aria-disabled', 'true')
    await user.click(need)
    expect(handlers.onPurchaseItem).toHaveBeenLastCalledWith('leaf-bundle', 5)
    expect(
      screen.getByText('Leaf Bundle ×5 needs 1 more Nectar, so nothing was spent.'),
    ).toBeInTheDocument()
    expect(need).toHaveFocus()
  })
})

describe('what a purchase came to', () => {
  it('says when the garden could not pay after all, and that nothing was spent', async () => {
    const { handlers, user } = renderShop()
    // Another tab spent the Nectar between drawing the button and the tap.
    handlers.onPurchaseItem.mockReturnValueOnce({ kind: 'short', currency: 'nectar', needed: 4 })
    await user.click(screen.getAllByRole('button', { name: 'Buy one' })[0])
    expect(
      screen.getByText('Leaf Bundle needs 4 more Nectar, so nothing was spent.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/added to your satchel/)).toBeNull()
  })

  it('says when a piece is owned already', async () => {
    const { handlers, user } = renderShop(garden(), 'boutique')
    handlers.onPurchaseItem.mockReturnValueOnce({ kind: 'owned' })
    const first = shopItems.find((item) => item.kind === 'cosmetic' && !item.premium)!
    await user.click(within(card(first.name)).getByRole('button', { name: 'Buy' }))
    expect(handlers.onPurchaseItem).toHaveBeenCalledWith(first.id, 1)
    expect(
      screen.getByText(`You already have ${first.name}, so nothing was spent.`),
    ).toBeInTheDocument()
  })

  it('says a bought piece is ready for every companion', async () => {
    const { user } = renderShop(garden(), 'boutique')
    const first = shopItems.find((item) => item.kind === 'cosmetic' && !item.premium)!
    await user.click(within(card(first.name)).getByRole('button', { name: 'Buy' }))
    expect(
      screen.getByText(
        `${first.name} is yours, for ${first.cost} ${first.currency === 'stardust' ? 'Stardust' : 'Nectar'}. Every companion can wear it.`,
      ),
    ).toBeInTheDocument()
  })

  it('says when the jar shelf filled up, or a piece needs the Pass', async () => {
    const { handlers, user } = renderShop(garden(), 'jars')
    handlers.onPurchaseJar.mockReturnValueOnce({ kind: 'unavailable', reason: 'full' })
    await user.click(screen.getByRole('button', { name: 'Buy Blue A jar' }))
    expect(screen.getByText('Your jar shelf is full, so nothing was spent.')).toBeInTheDocument()

    handlers.onPurchaseJar.mockReturnValueOnce({ kind: 'unavailable', reason: 'pass' })
    await user.click(screen.getByRole('button', { name: 'Buy Blue A jar' }))
    expect(
      screen.getByText('Blue A jar comes with the Garden Pass, so nothing was spent.'),
    ).toBeInTheDocument()

    handlers.onPurchaseJar.mockReturnValueOnce({ kind: 'unavailable', reason: 'unknown' })
    await user.click(screen.getByRole('button', { name: 'Buy Blue A jar' }))
    expect(
      screen.getByText('Blue A jar could not be bought, so nothing was spent.'),
    ).toBeInTheDocument()
  })

  it('puts the toast away after a while, and keeps the region for the next one', () => {
    vi.useFakeTimers()
    renderShop()
    fireEvent.click(screen.getAllByRole('button', { name: 'Buy one' })[0])
    const toast = screen.getByText(/added to your satchel/)
    const region = toast.closest('[role="status"]')
    act(() => {
      vi.advanceTimersByTime(PURCHASE_TOAST_MS - 1)
    })
    expect(toast).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText(/added to your satchel/)).toBeNull()
    expect(region).toBeInTheDocument()
  })
})

describe('the filters on a phone', () => {
  it('wait behind one Filter button, so the collection starts the page', async () => {
    phoneScreen()
    const { user } = renderShop(garden(), 'boutique')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0)
    const filter = screen.getByRole('button', { name: 'Filter' })
    expect(filter).toHaveAttribute('aria-haspopup', 'dialog')

    await user.click(filter)
    const sheet = within(screen.getByRole('dialog', { name: 'Filter the collection' }))
    await user.type(sheet.getByRole('searchbox'), 'bow')
    await user.selectOptions(sheet.getByRole('combobox', { name: /^Currency/ }), 'nectar')
    // Behind a modal sheet the count is out of reach, so the sheet says it.
    expect(sheet.getByRole('status')).toHaveTextContent(/to explore/)
    const shown = count().match(/\d+/)?.[0]
    await user.click(sheet.getByRole('button', { name: `Show ${shown} ${shown === '1' ? 'piece' : 'pieces'}` }))

    expect(screen.queryByRole('dialog')).toBeNull()
    // The button counts what is on, and focus comes back to it.
    expect(screen.getByRole('button', { name: 'Filter 2 active' })).toHaveFocus()
  })

  it('closes on Escape or Android’s back gesture, and on Close, back to the button', async () => {
    phoneScreen()
    const { user } = renderShop()
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    // Back closes the top dialog through its cancel event, as Escape does.
    act(() => requestDialogClose(screen.getByRole('dialog')))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveFocus()
  })

  it('clears from inside the sheet', async () => {
    phoneScreen()
    const { user } = renderShop()
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const sheet = within(screen.getByRole('dialog'))
    await user.click(sheet.getByRole('checkbox', { name: 'Within my budget' }))
    await user.click(sheet.getByRole('button', { name: 'Clear filters' }))
    expect(sheet.getByRole('checkbox', { name: 'Within my budget' })).not.toBeChecked()
    await user.click(sheet.getByRole('button', { name: /^Show / }))
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveFocus()
  })

  it('come back inline when the screen widens, putting the sheet away', async () => {
    const screenSize = phoneScreen()
    const { user } = renderShop()
    expect(screen.queryByRole('searchbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    screenSize.widen()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Filter/ })).toBeNull()
    // Focus went with the sheet; the same search, inline now, has it back.
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
})

describe('jars', () => {
  it('chooses a letter and a colour, and buys that jar', async () => {
    const { handlers, user } = renderShop(garden(), 'jars')
    await user.click(screen.getByRole('button', { name: 'Q', pressed: false }))
    await user.click(screen.getByRole('button', { name: /^Pink$/ }))
    await user.click(screen.getByRole('button', { name: 'Buy Pink Q jar' }))
    expect(handlers.onPurchaseJar).toHaveBeenCalledWith('Q', 'pink')
    expect(
      screen.getByText(
        `Pink Q jar added, for ${JAR_PRICE} Nectar. Place it from a plant's detail panel in Garden.`,
      ),
    ).toBeInTheDocument()
  })

  it('will not sell a jar it cannot pay for, and says by how much', async () => {
    const { user } = renderShop(garden({ nectar: JAR_PRICE - 1 }), 'jars')
    const button = screen.getByRole('button', { name: 'Not enough Nectar' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(
      screen.getByText('Blue A jar needs 1 more Nectar, so nothing was spent.'),
    ).toBeInTheDocument()
  })

  it('says when the jar shelf is full', async () => {
    const jars = Array.from({ length: JAR_CAPACITY }, (_, index) => ({
      id: `j${index}`,
      character: 'A',
      colorId: 'blue' as const,
      purchasedAt: '',
    }))
    const { user } = renderShop(garden({ jars }), 'jars')
    const button = screen.getByRole('button', { name: 'Your jar shelf is full' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(screen.getByText('Your jar shelf is full, so nothing was spent.')).toBeInTheDocument()
  })
})

describe('flight patterns', () => {
  it('sells patterns not owned yet, and points to choosing one', async () => {
    const { handlers, user } = renderShop(garden({ nectar: 1000, stardust: 1000 }), 'flight')
    await user.click(screen.getByRole('button', { name: 'Buy Petal Hop' }))
    expect(handlers.onPurchasePattern).toHaveBeenCalledWith('petal-hop')
    expect(
      screen.getByText('Petal Hop is yours, for 9 Nectar. Choose a pattern to fly it.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose a pattern' }))
    expect(handlers.onOpenFlight).toHaveBeenCalledOnce()
  })

  it('says when a pattern cannot be afforded, or is owned already', async () => {
    const { user } = renderShop(garden({ nectar: 0, stardust: 0 }), 'flight')
    const first = screen.getAllByRole('button', { name: /^Not enough / })[0]
    expect(first).toHaveAttribute('aria-disabled', 'true')
    await user.click(first)
    expect(
      screen.getByText('Petal Hop needs 9 more Nectar, so nothing was spent.'),
    ).toBeInTheDocument()
  })

  it('says a pattern is owned already when pressed again', async () => {
    const { user } = renderShop(
      garden({ ownedFlightPatternIds: ['gentle-drift', 'petal-hop'] }),
      'flight',
    )
    const owned = screen.getByRole('button', { name: 'Owned' })
    expect(owned).toHaveAttribute('aria-disabled', 'true')
    await user.click(owned)
    expect(
      screen.getByText('You already have Petal Hop, so nothing was spent.'),
    ).toBeInTheDocument()
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
