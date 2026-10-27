import { describe, expect, it } from 'vitest'
import {
  inDockOrder,
  isMorePage,
  labelWithBadge,
  moreBadge,
  type NavItem,
} from './navigation'

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

describe('the dock order', () => {
  it('puts Today beside the garden and keeps the rest in the header order', () => {
    expect(inDockOrder(items).map((item) => item.label)).toEqual([
      'Garden',
      'Today',
      'Care',
      'Journal',
      'Shop',
      'Flight',
      'Guide',
      'Settings',
    ])
  })

  it('leaves the list it was given as it was', () => {
    const before = items.map((item) => item.id)
    inDockOrder(items)
    expect(items.map((item) => item.id)).toEqual(before)
  })

  it('copes with a list that lacks a page it would lead with', () => {
    const withoutToday = items.filter((item) => item.id !== 'today')
    expect(inDockOrder(withoutToday).map((item) => item.id)).toEqual([
      'garden',
      'care',
      'journal',
      'shop',
      'flight-patterns',
      'guide',
      'settings',
    ])
  })
})

describe('what More stands for', () => {
  it('is each page it holds, and nothing in the dock', () => {
    for (const view of ['shop', 'flight-patterns', 'guide', 'settings'] as const)
      expect(isMorePage(items, view)).toBe(true)
    for (const view of ['garden', 'care', 'today', 'journal'] as const)
      expect(isMorePage(items, view)).toBe(false)
  })

  it('is not a page outside the navigation, such as one opened from Settings', () => {
    expect(isMorePage(items, 'privacy')).toBe(false)
    expect(isMorePage(items, 'recap')).toBe(false)
  })
})

describe('badges', () => {
  it('name a button by its label first, then what waits there', () => {
    expect(labelWithBadge({ label: 'Settings', badge: 'a reminder' })).toBe(
      'Settings, a reminder',
    )
  })

  it('leave a button without one to be named by its label', () => {
    expect(labelWithBadge({ label: 'Settings' })).toBeUndefined()
    expect(labelWithBadge({ label: 'Settings', badge: '' })).toBeUndefined()
  })

  it('give More nothing to say while nothing behind it waits', () => {
    expect(moreBadge(items)).toBeUndefined()
  })

  it('say on More what waits behind it, and where', () => {
    const badged = items.map((item) =>
      item.id === 'settings' ? { ...item, badge: 'a reminder' } : item,
    )
    expect(moreBadge(badged)).toBe('a reminder in Settings')
  })

  it('list every page behind More that has one', () => {
    const badged = items.map((item) =>
      item.id === 'settings' || item.id === 'shop'
        ? { ...item, badge: item.id === 'shop' ? 'something new' : 'a reminder' }
        : item,
    )
    expect(moreBadge(badged)).toBe('something new in Shop, a reminder in Settings')
  })

  it('leave More alone when the badge is on a page in the dock', () => {
    const badged = items.map((item) =>
      item.id === 'today' ? { ...item, badge: 'a reminder' } : item,
    )
    expect(moreBadge(badged)).toBeUndefined()
  })
})
