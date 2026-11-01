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
/**
 * The drafts as storage holds them, as far as this tab knows: read at load,
 * or written since, and nothing once another tab has written them. A draft
 * on screen is kept (isDraftKept, lib/draftKept) only when it is the same
 * here, never because a write was merely asked for.
 */
let inStorage: Drafts = {}
const listeners = new Set<() => void>()
let writeTimer: ReturnType<typeof setTimeout> | undefined

/** How long typing has to pause before a draft is written. */
const WRITE_DELAY_MS = 600

function emit() {
  for (const listener of listeners) listener()
}

/**
 * Every tab writes all of its drafts over the one stored record, so a tab
 * that has written says so here. The others may have just lost theirs from
 * storage, and call none kept until they have written them again.
 */
const channel =
  typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('butterfly-garden-drafts')
/** How many writes by other tabs this tab has heard of. */
let heard = 0
if (channel)
  channel.onmessage = () => {
    heard += 1
    inStorage = {}
    emit()
  }

/** Write the drafts as they are now, noting them as stored once they are. */
function write(): Promise<void> {
  const writing = drafts
  const since = heard
  return gardenRepository.writeDrafts(writing).then((written) => {
    if (!written) return
    channel?.postMessage(null)
    // Not if another tab wrote meanwhile: its write may have come after.
    if (since === heard) {
      inStorage = writing
      emit()
    }
  })
}

function scheduleWrite() {
  if (writeTimer !== undefined) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = undefined
    void write()
  }, WRITE_DELAY_MS)
}

/**
 * Write any pending draft now, for example as the page is being hidden.
 * Settles once it is written, so a reload can wait for it.
 */
export function flushDrafts(): Promise<void> {
  if (writeTimer === undefined) return Promise.resolve()
  clearTimeout(writeTimer)
  writeTimer = undefined
  return write()
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
  const since = heard
  const { kept, dropped } = withoutOldDays(await gardenRepository.readDrafts(), toLocalDate())
  if (since === heard) inStorage = kept
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
  inStorage = {}
  emit()
}

/** Hear of every change to the drafts, or to what storage holds of them. */
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushDrafts()
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

/**
 * Whether the draft for `key` has reached storage as it stands, for the
 * "Draft kept" hint (lib/draftKept, which follows it as drafts change).
 */
export function isDraftKept(key: string): boolean {
  return drafts[key] !== undefined && inStorage[key] === drafts[key]
}
