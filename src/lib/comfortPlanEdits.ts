import type { ComfortItem, ComfortPlan, ComfortSection } from '../types'
import { COMFORT_ITEMS, comfortText, phoneNumber } from './comfortPlan'
import { createId } from './id'

/**
 * What a gardener does to their comfort plan, as plain functions of the
 * plan: add a line, change it, move it, remove it and put it back. Each
 * returns a new plan, or the very same plan when nothing changes, and a list
 * left empty is dropped rather than kept empty.
 *
 * Loaded with the plan's page. The app applies them through
 * changeComfortPlan (lib/comfortPlan), which only ever touches the plan.
 */

/** A line as typed: its words (a person's name), and for a person a number. */
export interface ComfortWords {
  text: string
  phone?: string
}

function listOf(plan: ComfortPlan, section: ComfortSection): readonly ComfortItem[] {
  return plan[section] ?? []
}

/** The plan with this list in place of the old one, or without it when empty. */
function withList(plan: ComfortPlan, section: ComfortSection, items: ComfortItem[]): ComfortPlan {
  const next = { ...plan }
  if (items.length > 0) next[section] = items
  else delete next[section]
  return next
}

/** A line as it is kept, or nothing for one with no words. */
function itemOf(section: ComfortSection, words: ComfortWords, id: string): ComfortItem | undefined {
  const text = comfortText(words.text)
  if (!text) return undefined
  // Only a person has a number to call.
  const phone = section === 'people' && words.phone ? phoneNumber(words.phone) : ''
  return phone ? { id, text, phone } : { id, text }
}

/** Add a line at the end of a list, unless it has no words or the list is full. */
export function addComfortItem(
  plan: ComfortPlan,
  section: ComfortSection,
  words: ComfortWords,
  id: string = createId(),
): ComfortPlan {
  const items = listOf(plan, section)
  const item = itemOf(section, words, id)
  if (!item || items.length >= COMFORT_ITEMS) return plan
  return withList(plan, section, [...items, item])
}

/**
 * Change a line's words where it stands. Words left empty change nothing:
 * removing a line is its own action, with its own Undo.
 */
export function changeComfortItem(
  plan: ComfortPlan,
  section: ComfortSection,
  id: string,
  words: ComfortWords,
): ComfortPlan {
  const items = listOf(plan, section)
  const index = items.findIndex((item) => item.id === id)
  const item = itemOf(section, words, id)
  if (index === -1 || !item) return plan
  if (items[index].text === item.text && items[index].phone === item.phone) return plan
  const changed = [...items]
  changed[index] = item
  return withList(plan, section, changed)
}

/** Move a line one place up (-1) or down (1); at either end, nothing moves. */
export function moveComfortItem(
  plan: ComfortPlan,
  section: ComfortSection,
  id: string,
  by: -1 | 1,
): ComfortPlan {
  const items = listOf(plan, section)
  const index = items.findIndex((item) => item.id === id)
  const to = index + by
  if (index === -1 || to < 0 || to >= items.length) return plan
  const moved = [...items]
  ;[moved[index], moved[to]] = [moved[to], moved[index]]
  return withList(plan, section, moved)
}

export function removeComfortItem(
  plan: ComfortPlan,
  section: ComfortSection,
  id: string,
): ComfortPlan {
  const items = listOf(plan, section)
  if (!items.some((item) => item.id === id)) return plan
  return withList(
    plan,
    section,
    items.filter((item) => item.id !== id),
  )
}

/**
 * Put back a line just removed, where it was: what makes Remove undoable.
 * One already back is left alone, and a list filled again in the meantime
 * is not overfilled.
 */
export function restoreComfortItem(
  plan: ComfortPlan,
  section: ComfortSection,
  item: ComfortItem,
  index: number,
): ComfortPlan {
  const items = listOf(plan, section)
  if (items.some((entry) => entry.id === item.id) || items.length >= COMFORT_ITEMS) return plan
  const restored = [...items]
  restored.splice(Math.max(0, Math.min(index, items.length)), 0, item)
  return withList(plan, section, restored)
}

/**
 * Why a typed phone number cannot be kept, or nothing when it can (or when
 * none was typed, since a number is optional). Loose on purpose: any digits,
 * with a plus sign, spaces, dashes, brackets or dots between them, since
 * numbers are written differently everywhere.
 */
export function phoneProblem(text: string): string | undefined {
  if (!text.trim()) return undefined
  if (/[^\d+\s().-]/.test(text)) {
    return 'A phone number can hold digits, a plus sign, spaces and dashes.'
  }
  if ((text.match(/\d/g)?.length ?? 0) < 3) return 'That number looks too short to call.'
  return undefined
}

/** The address that hands a number to the phone's dialler: its digits, and any plus sign. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
