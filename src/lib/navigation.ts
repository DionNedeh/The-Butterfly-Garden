import type { AppView, IconName } from '../types'

/** One page the app's navigation offers. */
export interface NavItem {
  id: AppView
  label: string
  icon: IconName
  /** On a phone, reached through More rather than straight from the dock. */
  inMore?: boolean
  /**
   * A few words on something waiting on the page, such as "a reminder". They
   * are read after its name ("Settings, a reminder") and shown as a small dot,
   * on the page's own button and, on a phone, on More.
   */
  badge?: string
}

/** The pages the dock puts first, ahead of the header's order. */
const DOCK_LEADS: readonly AppView[] = ['garden', 'today']

/**
 * The dock's order. It leads with the garden and the day, so on a phone Today
 * sits beside the garden under the thumb, with Care after it.
 */
export function inDockOrder(items: readonly NavItem[]): NavItem[] {
  const leads = DOCK_LEADS.flatMap((id) => items.filter((item) => item.id === id))
  return [...leads, ...items.filter((item) => !DOCK_LEADS.includes(item.id))]
}

/** Whether the page on screen is one More holds, so More stands for it. */
export function isMorePage(items: readonly NavItem[], view: AppView): boolean {
  return items.some((item) => item.inMore === true && item.id === view)
}

/**
 * A button's accessible name when a badge adds to it: the visible label
 * first, so voice control still finds it by the word on screen. Without a
 * badge the label itself names the button.
 */
export function labelWithBadge(item: Pick<NavItem, 'label' | 'badge'>): string | undefined {
  return item.badge ? `${item.label}, ${item.badge}` : undefined
}

/** What More's own badge says: each badge behind it, and where it is. */
export function moreBadge(items: readonly NavItem[]): string | undefined {
  const waiting = items.filter((item) => item.inMore === true && item.badge)
  if (waiting.length === 0) return undefined
  return waiting.map((item) => `${item.badge} in ${item.label}`).join(', ')
}
