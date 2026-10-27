import { useCallback, useSyncExternalStore } from 'react'
import { gardenRepository, type Drafts } from '../repository/gardenRepository'
import { addDaysToLocalDate, toLocalDate } from './date'

/**
 * Unsaved writing that survives a change of page, a reload or a closed tab.
 *
 * Drafts are not entries: they earn nothing, are never exported and are
 * dropped the moment the entry they belong to is saved. That is why they may
 * be written lazily, a moment after typing pauses, where a real entry is
 * written straight through (see the no-debounce rule in useGardenState).
 *
 * Keys name the field and the day it belongs to, for example
 * `reflection:2026-10-26` or `recap:2026-10-26:wentWell`, so a draft can never
 * end up saved against the wrong day.
 */

let drafts: Drafts = {}
const listeners = new Set<() => void>()
let writeTimer: ReturnType<typeof setTimeout> | undefined

/** How long typing has to pause before a draft is written. */
const WRITE_DELAY_MS = 600

function emit() {
  for (const listener of listeners) listener()
}

function scheduleWrite() {
  if (writeTimer !== undefined) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = undefined
    void gardenRepository.writeDrafts(drafts)
  }, WRITE_DELAY_MS)
}

/** Write any pending draft now, for example as the page is being hidden. */
export function flushDrafts() {
  if (writeTimer === undefined) return
  clearTimeout(writeTimer)
  writeTimer = undefined
  void gardenRepository.writeDrafts(drafts)
}

/** A day named in a draft's key, as in `reflection:2026-10-26:…`. */
const KEY_DAY = /:(\d{4}-\d{2}-\d{2})(?::|$)/

/**
 * How long a draft that names its day is kept. A day's words are only ever
 * offered on that day, or the next while a recap's late night runs, so a
 * week is generous; without a limit, the marks a day leaves (an offer put
 * away, a gentle day's list) would be stored and copied on every keystroke
 * for as long as the garden lives.
 */
const DAY_DRAFT_DAYS = 7

/** The stored drafts without those whose day has long passed. */
function withoutOldDays(stored: Drafts, today: string): { kept: Drafts; dropped: boolean } {
  const oldest = addDaysToLocalDate(today, -DAY_DRAFT_DAYS)
  const kept: Drafts = {}
  let dropped = false
  for (const [key, value] of Object.entries(stored)) {
    const day = KEY_DAY.exec(key)?.[1]
    if (day !== undefined && day < oldest) dropped = true
    else kept[key] = value
  }
  return { kept, dropped }
}

/** Read stored drafts once, after the garden itself has loaded. */
export async function loadDrafts(): Promise<void> {
  const stored = await gardenRepository.readDrafts()
  const { kept, dropped } = withoutOldDays(stored, toLocalDate())
  // Anything typed while the read was in flight wins over what was stored.
  drafts = { ...kept, ...drafts }
  emit()
  if (dropped) scheduleWrite()
}

export function getDraft(key: string): string | undefined {
  return drafts[key]
}

export function setDraft(key: string, value: string) {
  if (drafts[key] === value) return
  drafts = { ...drafts, [key]: value }
  emit()
  scheduleWrite()
}

export function clearDraft(...keys: string[]) {
  if (!keys.some((key) => key in drafts)) return
  const next = { ...drafts }
  for (const key of keys) delete next[key]
  drafts = next
  emit()
  scheduleWrite()
}

/** Forget every draft, as deleting the garden does. */
export function resetDrafts() {
  if (writeTimer !== undefined) clearTimeout(writeTimer)
  writeTimer = undefined
  drafts = {}
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDrafts()
  })
}

/**
 * A text field backed by a stored draft.
 *
 * Returns the draft for `key` when there is one, otherwise `fallback` (the
 * saved entry, typically). Setting the value stores it as a draft. Setting it
 * back to exactly `fallback` clears the draft, so an untouched field never
 * holds one.
 */
export function useDraft(
  key: string,
  fallback: string,
): [string, (value: string) => void] {
  const draft = useSyncExternalStore(
    subscribe,
    () => drafts[key],
    () => undefined,
  )
  const set = useCallback(
    (value: string) => {
      if (value === fallback) clearDraft(key)
      else setDraft(key, value)
    },
    [key, fallback],
  )
  return [draft ?? fallback, set]
}
