import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { ShopView, type ShopTab } from './ShopView'

function garden(): AppState {
  return { ...createInitialState('Tester', 'Shop'), nectar: 200, stardust: 50 }
}

const handlers = () => ({
  onPurchasePattern: vi.fn(),
  onPurchaseJar: vi.fn(),
  onRecycleJar: vi.fn(),
  onRestoreJar: vi.fn(),
  onPurchaseItem: vi.fn(),
  onSelectBackdrop: vi.fn(),
  onSaveCustomBackdrop: vi.fn(() => Promise.resolve({ ok: true as const })),
  onSelectCustomBackdrop: vi.fn(),
  onDeleteCustomBackdrop: vi.fn(),
})

function renderShop(props: { initialTab?: ShopTab; withGuide?: boolean } = {}) {
  const onOpenGuide = vi.fn()
  const onChangeTab = vi.fn()
  const fixed = handlers()
  const draw = (initialTab?: ShopTab) => (
    <ShopView
      state={garden()}
      {...fixed}
      initialTab={initialTab}
      onChangeTab={onChangeTab}
      onOpenGuide={props.withGuide === false ? undefined : onOpenGuide}
    />
  )
  const view = render(draw(props.initialTab))
  return {
    onOpenGuide,
    onChangeTab,
    rerenderAt: (tab?: ShopTab) => view.rerender(draw(tab)),
    user: userEvent.setup(),
  }
}

const tabs = () => within(screen.getByRole('navigation', { name: 'Shop sections' }))
const shown = () => tabs().getByRole('button', { current: 'page' })

describe('6.4 “What does this do?” beside the shop’s wallet', () => {
  it('links Nectar and Stardust to their part of the Guide', () => {
    renderShop()
    expect(
      screen.getByRole('link', { name: 'What does this do? Nectar and Stardust, in the Guide' }),
    ).toHaveAttribute('href', '#/guide/nectar-and-stardust')
  })

  it('remembers the tab it was pressed on', async () => {
    const { user, onOpenGuide } = renderShop({ initialTab: 'jars' })
    await user.click(screen.getByRole('link', { name: /^What does this do\? Nectar and Stardust/ }))
    expect(onOpenGuide).toHaveBeenCalledExactlyOnceWith('nectar-and-stardust', undefined, {
      shopTab: 'jars',
    })
  })

  it('is not offered without a Guide to open', () => {
    renderShop({ withGuide: false })
    expect(screen.queryByRole('link', { name: /^What does this do\?/ })).toBeNull()
  })
})

describe('6.7 the shop’s tab in the address', () => {
  it('says which tab was chosen, from its button or from the Pass’s own way to backdrops', async () => {
    const { user, onChangeTab } = renderShop()
    await user.click(tabs().getByRole('button', { name: 'Boutique' }))
    expect(onChangeTab).toHaveBeenLastCalledWith('boutique')
    expect(shown()).toHaveTextContent('Boutique')
    await user.click(tabs().getByRole('button', { name: 'Garden Pass' }))
    await user.click(screen.getByRole('button', { name: 'Explore backdrops' }))
    expect(onChangeTab).toHaveBeenLastCalledWith('backdrops')
    expect(shown()).toHaveTextContent('Backdrops')
  })

  it('opens on the tab the address names, and shows another named while it is open', async () => {
    const { user, rerenderAt, onChangeTab } = renderShop({ initialTab: 'boutique' })
    expect(shown()).toHaveTextContent('Boutique')
    await user.click(tabs().getByRole('button', { name: 'Supplies' }))
    rerenderAt('supplies')
    await user.type(screen.getByRole('searchbox', { name: 'Find something lovely' }), 'leaf')
    // Back or Forward names the Boutique: shown as if its button were pressed,
    // so the search on Supplies does not follow the gardener there.
    rerenderAt('boutique')
    expect(shown()).toHaveTextContent('Boutique')
    expect(screen.getByRole('searchbox', { name: 'Find something lovely' })).toHaveValue('')
    rerenderAt('flight')
    expect(shown()).toHaveTextContent('Flight')
    // The same tab named again, as the address follows a choice, changes nothing.
    rerenderAt('flight')
    expect(shown()).toHaveTextContent('Flight')
    expect(onChangeTab).toHaveBeenCalledTimes(1)
  })
})
