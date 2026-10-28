import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomNav, PrimaryNav } from './Navigation'
import { backAction, requestDialogClose } from '../lib/backNavigation'
import type { NavItem } from '../lib/navigation'
import type { AppView } from '../types'

const items: NavItem[] = [
  { id: 'garden', label: 'Garden', icon: 'garden' },
  { id: 'care', label: 'Care', icon: 'care' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'shop', label: 'Shop', icon: 'shop', inMore: true },
  { id: 'flight-patterns', label: 'Flight', icon: 'flight', inMore: true },
  { id: 'guide', label: 'Guide', icon: 'flower', inMore: true },
  { id: 'settings', label: 'Settings', icon: 'settings', inMore: true },
]

const withReminder = items.map((item) =>
  item.id === 'settings' ? { ...item, badge: 'a reminder' } : item,
)

function dock() {
  return within(screen.getByRole('navigation', { name: 'Mobile navigation' }))
}

function renderDock(current: AppView = 'garden', list: NavItem[] = items) {
  const onNavigate = vi.fn()
  const user = userEvent.setup()
  const view = render(<BottomNav items={list} current={current} onNavigate={onNavigate} />)
  const more = dock().getByRole('button', { name: /^More/ })
  const sheet = view.container.querySelector('dialog')!
  return { user, onNavigate, more, sheet, rerender: view.rerender }
}

describe('the header navigation', () => {
  it('offers every page and marks the one on screen', async () => {
    const onNavigate = vi.fn()
    render(<PrimaryNav items={items} current="today" onNavigate={onNavigate} />)
    const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
    expect(nav.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Garden',
      'Care',
      'Today',
      'Journal',
      'Shop',
      'Flight',
      'Guide',
      'Settings',
    ])
    expect(nav.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('button', { name: 'Today' })).toHaveClass('active')
    expect(nav.getByRole('button', { name: 'Garden' })).not.toHaveAttribute('aria-current')
    expect(nav.getByRole('button', { name: 'Garden' })).not.toHaveAttribute('class')
    await userEvent.setup().click(nav.getByRole('button', { name: 'Shop' }))
    expect(onNavigate).toHaveBeenCalledWith('shop')
  })

  it('reads a badge after the page name and shows its dot', () => {
    render(<PrimaryNav items={withReminder} current="garden" onNavigate={vi.fn()} />)
    const settings = screen.getByRole('button', { name: 'Settings, a reminder' })
    expect(settings.querySelector('.nav-badge')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'Shop' }).querySelector('.nav-badge')).toBeNull()
  })
})

describe('the dock', () => {
  it('leads with Garden, Today, Care and Journal, then More', () => {
    renderDock()
    const tabs = dock().getAllByRole('button')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Garden',
      'Today',
      'Care',
      'Journal',
      'Shop',
      'Flight',
      'Guide',
      'Settings',
      'More',
    ])
    // The stylesheet shows these four only where every page has a tab.
    for (const label of ['Shop', 'Flight', 'Guide', 'Settings'])
      expect(dock().getByRole('button', { name: label })).toHaveClass('in-more')
    for (const label of ['Garden', 'Today', 'Care', 'Journal'])
      expect(dock().getByRole('button', { name: label })).not.toHaveClass('in-more')
    expect(dock().getByRole('button', { name: 'More' })).toHaveClass('more-tab')
  })

  it('goes straight to a page in the dock', async () => {
    const { user, onNavigate, sheet } = renderDock()
    await user.click(dock().getByRole('button', { name: 'Journal' }))
    expect(onNavigate).toHaveBeenCalledWith('journal')
    expect(sheet).not.toHaveAttribute('open')
  })

  it('opens the More sheet, with a heading and the four other pages', async () => {
    const { user, more, sheet } = renderDock()
    expect(more).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(more)
    expect(sheet).toHaveAttribute('open')
    const dialog = screen.getByRole('dialog', { name: 'More' })
    expect(within(dialog).getByRole('heading', { name: 'More' })).toBeInTheDocument()
    const pages = within(within(dialog).getByRole('list')).getAllByRole('button')
    expect(pages.map((page) => page.textContent)).toEqual(['Shop', 'Flight', 'Guide', 'Settings'])
  })

  it('closes the sheet and goes to the page chosen, with focus back on More', async () => {
    const { user, onNavigate, more, sheet } = renderDock()
    await user.click(more)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guide' }))
    expect(onNavigate).toHaveBeenCalledWith('guide')
    expect(sheet).not.toHaveAttribute('open')
    expect(more).toHaveFocus()
  })

  it('closes from its Close button without going anywhere', async () => {
    const { user, onNavigate, more, sheet } = renderDock()
    await user.click(more)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(sheet).not.toHaveAttribute('open')
    expect(onNavigate).not.toHaveBeenCalled()
    expect(more).toHaveFocus()
  })

  it('closes on a tap outside the sheet, but not on one inside it', async () => {
    const { user, more, sheet } = renderDock()
    await user.click(more)
    fireEvent.click(within(sheet).getByRole('heading', { name: 'More' }))
    expect(sheet).toHaveAttribute('open')
    // A tap on the backdrop is delivered to the dialog element itself.
    fireEvent.click(sheet)
    expect(sheet).not.toHaveAttribute('open')
    expect(more).toHaveFocus()
  })

  it("closes with Android's back gesture before anything else, with focus back on More", async () => {
    const { user, onNavigate, more, sheet } = renderDock('shop')
    await user.click(more)
    const action = backAction('shop')
    expect(action).toEqual({ kind: 'close-dialog', dialog: sheet })
    act(() => {
      if (action.kind === 'close-dialog') requestDialogClose(action.dialog)
    })
    expect(sheet).not.toHaveAttribute('open')
    expect(onNavigate).not.toHaveBeenCalled()
    expect(more).toHaveFocus()
    // Closed, it no longer stands in the way of the page's own step back.
    expect(backAction('shop')).toEqual({ kind: 'view', view: 'garden' })
  })

  it('marks More as the current page whenever one of its pages is open', () => {
    const { more, rerender } = renderDock('settings')
    expect(more).toHaveAttribute('aria-current', 'page')
    expect(more).toHaveClass('active')
    for (const view of ['shop', 'flight-patterns', 'guide'] as const) {
      rerender(<BottomNav items={items} current={view} onNavigate={vi.fn()} />)
      expect(more).toHaveAttribute('aria-current', 'page')
    }
    for (const view of ['garden', 'today', 'care', 'journal', 'privacy'] as const) {
      rerender(<BottomNav items={items} current={view} onNavigate={vi.fn()} />)
      expect(more).not.toHaveAttribute('aria-current')
      expect(more).not.toHaveClass('active')
    }
  })

  it('marks the page on screen inside the sheet too', async () => {
    const { user, more } = renderDock('flight-patterns')
    await user.click(more)
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('button', { name: 'Flight' })).toHaveAttribute('aria-current', 'page')
    expect(dialog.getByRole('button', { name: 'Shop' })).not.toHaveAttribute('aria-current')
  })

  it('shows a badge behind More on More itself and on its page in the sheet', async () => {
    const { user, more } = renderDock('garden', withReminder)
    expect(more).toHaveAccessibleName('More, a reminder in Settings')
    expect(more.querySelector('.nav-badge')).toHaveAttribute('aria-hidden', 'true')
    await user.click(more)
    const settings = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Settings, a reminder',
    })
    expect(settings.querySelector('.nav-badge')).not.toBeNull()
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Shop' }).querySelector('.nav-badge'),
    ).toBeNull()
  })

  it('names More by its label alone while nothing behind it waits', () => {
    const { more } = renderDock()
    expect(more).toHaveAccessibleName('More')
    expect(more).not.toHaveAttribute('aria-label')
    expect(more.querySelector('.nav-badge')).toBeNull()
  })
})
