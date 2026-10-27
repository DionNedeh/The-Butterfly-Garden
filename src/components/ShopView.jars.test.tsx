import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JAR_ACCENTED, JAR_MARKS, JAR_PRICE } from '../data/jars'
import { buyFlightPattern } from '../lib/flightPatterns'
import {
  buyJar,
  JAR_RECYCLE_NECTAR,
  recycleJar,
  restoreRecycledJar,
  type RecycledJar,
} from '../lib/jars'
import { createInitialState } from '../lib/progression'
import { buyShopItem } from '../lib/wardrobe'
import type { AppState, JarColorId, JarInstance } from '../types'
import { UNDO_MS } from './UndoToast'
import { ShopView, type ShopTab } from './ShopView'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Tester', 'Shop'), nectar: 200, stardust: 50, ...overrides }
}

const jar = (id: string, character = 'A', colorId: JarColorId = 'blue'): JarInstance => ({
  id,
  character,
  colorId,
  purchasedAt: '2026-10-27T12:00:00.000Z',
})

const backdrops = {
  onSelectBackdrop: vi.fn(),
  onSaveCustomBackdrop: vi.fn(() => Promise.resolve({ ok: true as const })),
  onSelectCustomBackdrop: vi.fn(),
  onDeleteCustomBackdrop: vi.fn(),
}

/**
 * The shop over a garden that changes as the real reducers say, the way the
 * app's own state does, so a recycle shows on the shelf and Undo can be
 * pressed on what it left.
 */
function renderLiveShop(initial: AppState, tab: ShopTab = 'jars') {
  const latest = { current: initial }
  function Live() {
    const [state, setState] = useState(initial)
    const run = <Outcome,>(reducer: (current: AppState) => { state: AppState; outcome: Outcome }) => {
      const result = reducer(latest.current)
      latest.current = result.state
      setState(result.state)
      return result.outcome
    }
    return (
      <ShopView
        state={state}
        initialTab={tab}
        onPurchasePattern={(id) => run((current) => buyFlightPattern(current, id))}
        onPurchaseJar={(character, color) => run((current) => buyJar(current, character, color))}
        onPurchaseItem={(id, quantity) => run((current) => buyShopItem(current, id, quantity))}
        onRecycleJar={(id) => run((current) => recycleJar(current, id))}
        onRestoreJar={(recycled) => run((current) => restoreRecycledJar(current, recycled))}
        {...backdrops}
      />
    )
  }
  render(<Live />)
  return { garden: latest, user: userEvent.setup() }
}

/** The shop over one garden that never changes, each answer a mock's. */
function renderShop(state: AppState) {
  const handlers = {
    onPurchasePattern: vi.fn(() => ({ kind: 'owned' as const })),
    onPurchaseJar: vi.fn((character: string, color: JarColorId) => buyJar(state, character, color).outcome),
    onPurchaseItem: vi.fn(() => ({ kind: 'owned' as const })),
    onRecycleJar: vi.fn((id: string) => recycleJar(state, id).outcome),
    onRestoreJar: vi.fn((recycled: RecycledJar) => restoreRecycledJar(state, recycled).outcome),
  }
  render(<ShopView state={state} initialTab="jars" {...handlers} {...backdrops} />)
  return { handlers, user: userEvent.setup() }
}

const shelf = () => within(screen.getByRole('region', { name: 'Your jars' }))
/** Each row's words: its name and count, then where its jars are. */
const rows = () =>
  shelf()
    .queryAllByRole('listitem')
    .map((row) => row.querySelector('.jar-stack-copy')?.textContent)
const recycleButton = (name: string) =>
  screen.getByRole('button', { name: `Recycle for ${JAR_RECYCLE_NECTAR} Nectar: one ${name}` })

afterEach(() => {
  vi.useRealTimers()
})

describe('the jar shelf in the shop', () => {
  it('stacks alike jars into one row, saying where they are', () => {
    const plantId = garden().plants[0].id
    renderShop(
      garden({
        jars: [jar('a1'), jar('a2'), jar('a3'), jar('p1', 'A', 'pink'), jar('b1', 'B'), jar('b2', 'B')],
        jarPlacements: [
          { jarId: 'a1', plantId },
          { jarId: 'p1', plantId: 'elsewhere' },
        ],
      }),
    )
    expect(rows()).toEqual([
      'Blue A ×3, 3 jars1 on a plant, 2 on the shelf',
      'Pink AOn a plant',
      'Blue B ×2, 2 jarsOn the shelf',
    ])
    // The count is shown as "×3" and said as "3 jars".
    const stack = shelf().getAllByRole('listitem')[0]
    expect(within(stack).getByText('×3', { exact: false })).toHaveAttribute('aria-hidden', 'true')
    expect(within(stack).getByText(', 3 jars')).toHaveClass('sr-only')
    // A jar on a plant comes off it first; there is nothing to recycle here.
    expect(within(shelf().getAllByRole('listitem')[1]).queryByRole('button')).toBeNull()
    expect(shelf().getByText('6 jars')).toBeInTheDocument()
  })

  it('says when there is nothing on the shelf yet', () => {
    renderShop(garden())
    expect(shelf().getByText('No jars yet. The first one you buy will wait here.')).toBeInTheDocument()
  })

  it('names its button by what it shows first, and says the Nectar on it', () => {
    renderShop(garden({ jars: [jar('a1')] }))
    const button = recycleButton('Blue A jar')
    expect(button).toHaveTextContent(`Recycle for ${JAR_RECYCLE_NECTAR} Nectar`)
    expect(button.getAttribute('aria-label')?.startsWith(button.textContent ?? '-')).toBe(true)
  })

  it('a bought jar joins its stack', async () => {
    const { user } = renderLiveShop(garden({ jars: [jar('a1')] }))
    await user.click(screen.getByRole('button', { name: 'Buy Blue A jar' }))
    expect(rows()).toEqual(['Blue A ×2, 2 jarsOn the shelf'])
  })
})

describe('recycling a jar', () => {
  it('recycles one of a stack for half its Nectar, and Undo puts it back as it was', async () => {
    const start = garden({ nectar: 0, jars: [jar('a1'), jar('a2'), jar('b1', 'B')] })
    const { garden: live, user } = renderLiveShop(start)

    await user.click(recycleButton('Blue A jar'))
    expect(live.current.nectar).toBe(JAR_RECYCLE_NECTAR)
    // The newest of the stack goes; the rest of the stack stays, with focus.
    expect(live.current.jars.map((entry) => entry.id)).toEqual(['a1', 'b1'])
    expect(rows()[0]).toBe('Blue AOn the shelf')
    expect(recycleButton('Blue A jar')).toHaveFocus()
    const toast = screen.getByText(`Blue A jar recycled, for ${JAR_RECYCLE_NECTAR} Nectar.`)
    expect(toast.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(live.current.jars).toEqual(start.jars)
    expect(live.current.nectar).toBe(0)
    expect(rows()[0]).toBe('Blue A ×2, 2 jarsOn the shelf')
    expect(recycleButton('Blue A jar')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('moves focus to the shelf’s heading when the row goes, and back to it on Undo', async () => {
    const { garden: live, user } = renderLiveShop(garden({ nectar: 0, jars: [jar('b1', 'B', 'pink')] }))
    await user.click(recycleButton('Pink B jar'))
    expect(rows()).toEqual([])
    expect(shelf().getByRole('heading', { name: 'Your jars' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(live.current.jars.map((entry) => entry.id)).toEqual(['b1'])
    expect(recycleButton('Pink B jar')).toHaveFocus()
  })

  it('takes the last loose jar of a stack, leaving the one on a plant', async () => {
    const plantId = garden().plants[0].id
    const { user } = renderLiveShop(
      garden({ jars: [jar('a1'), jar('a2')], jarPlacements: [{ jarId: 'a1', plantId }] }),
    )
    await user.click(recycleButton('Blue A jar'))
    expect(rows()).toEqual(['Blue AOn a plant'])
    expect(shelf().getByRole('heading', { name: 'Your jars' })).toHaveFocus()
  })

  it('refuses Undo once the Nectar it brought has been spent, and says so', async () => {
    const { handlers, user } = renderShop(garden({ jars: [jar('a1')] }))
    handlers.onRestoreJar.mockReturnValueOnce({ kind: 'spent', needed: 2 })
    await user.click(recycleButton('Blue A jar'))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(
      screen.getByText('The Nectar from the Blue A jar has been spent since, so it stays recycled.'),
    ).toBeInTheDocument()
    expect(shelf().getByRole('heading', { name: 'Your jars' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('refuses Undo when the shelf has filled again', async () => {
    const { handlers, user } = renderShop(garden({ jars: [jar('a1')] }))
    handlers.onRestoreJar.mockReturnValueOnce({ kind: 'full' })
    await user.click(recycleButton('Blue A jar'))
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(
      screen.getByText('Your jar shelf is full again, so the Blue A jar stays recycled.'),
    ).toBeInTheDocument()
  })

  it('says when a jar went onto a plant, or was recycled, in another tab meanwhile', async () => {
    const { handlers, user } = renderShop(garden({ jars: [jar('a1')] }))
    handlers.onRecycleJar.mockReturnValueOnce({ kind: 'placed' })
    await user.click(recycleButton('Blue A jar'))
    expect(
      screen.getByText('The Blue A jar is on a plant now, so it was not recycled.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(recycleButton('Blue A jar')).toHaveFocus()

    handlers.onRecycleJar.mockReturnValueOnce({ kind: 'missing' })
    await user.click(recycleButton('Blue A jar'))
    expect(
      screen.getByText('The Blue A jar was recycled already, so nothing changed.'),
    ).toBeInTheDocument()
  })

  it('offers Undo for six seconds', () => {
    vi.useFakeTimers()
    renderShop(garden({ jars: [jar('a1')] }))
    fireEvent.click(recycleButton('Blue A jar'))
    act(() => {
      vi.advanceTimersByTime(UNDO_MS - 1)
    })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('shows one toast at a time: a purchase puts the undo away, and leaving the jars too', async () => {
    const { user } = renderShop(garden({ jars: [jar('a1')] }))
    await user.click(recycleButton('Blue A jar'))
    await user.click(screen.getByRole('button', { name: 'Buy Blue A jar' }))
    expect(screen.getByText(/^Blue A jar added/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()

    await user.click(recycleButton('Blue A jar'))
    expect(screen.queryByText(/^Blue A jar added/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    const sections = within(screen.getByRole('navigation', { name: 'Shop sections' }))
    await user.click(sections.getByRole('button', { name: 'Boutique' }))
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })
})

describe('the jar builder’s characters', () => {
  it('folds accented capitals and marks beneath the letters and numbers', async () => {
    const { handlers, user } = renderShop(garden())
    expect(screen.getByRole('group', { name: 'Letters' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Numbers' })).getAllByRole('button')).toHaveLength(10)
    const fold = screen.getByText('Accents and marks').closest('details')!
    expect(fold).not.toHaveAttribute('open')

    await user.click(screen.getByText('Accents and marks'))
    expect(fold).toHaveAttribute('open')
    const accented = within(screen.getByRole('group', { name: 'Accented letters' }))
    expect(accented.getAllByRole('button').map((button) => button.textContent)).toEqual([
      ...JAR_ACCENTED,
    ])
    await user.click(accented.getByRole('button', { name: 'É' }))
    expect(accented.getByRole('button', { name: 'É' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /^Pink$/ }))
    await user.click(screen.getByRole('button', { name: 'Buy Pink É jar' }))
    expect(handlers.onPurchaseJar).toHaveBeenLastCalledWith('É', 'pink')
    expect(
      screen.getByText(
        `Pink É jar added, for ${JAR_PRICE} Nectar. Place it from a plant's detail panel in Garden.`,
      ),
    ).toBeInTheDocument()
  })

  it('names each mark aloud as well as showing it', async () => {
    const { handlers, user } = renderShop(garden())
    await user.click(screen.getByText('Accents and marks'))
    const marks = within(screen.getByRole('group', { name: 'Marks' })).getAllByRole('button')
    expect(marks.map((button) => button.textContent)).toEqual([...JAR_MARKS])
    for (const button of marks)
      expect(button.getAttribute('aria-label')?.startsWith(`${button.textContent} `)).toBe(true)
    await user.click(screen.getByRole('button', { name: '. dot' }))
    await user.click(screen.getByRole('button', { name: 'Buy Blue . jar' }))
    expect(handlers.onPurchaseJar).toHaveBeenLastCalledWith('.', 'blue')
  })
})
