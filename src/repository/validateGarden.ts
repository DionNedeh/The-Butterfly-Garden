import { DEFAULT_FLIGHT_PATTERN_ID } from '../lib/flightPatterns'
import { flightPatterns } from '../data/flightPatterns'
import { getCareAction } from '../data/careActions'
import { getShopItem } from '../data/shopItems'
import {
  MAX_GOAL_DAYS,
  MAX_OUTFIT_PRESETS,
  MAX_OUTFITS_WORN,
  presetName,
} from '../lib/companionDiary'
import { JAR_LETTERS, JAR_NUMBERS, jarCharacters, jarColors } from '../data/jars'
import { ambientTracks, DEFAULT_AMBIENT_TRACK_ID } from '../data/ambientTracks'
import { isValidBrightness, isValidCustomBackdropCollection } from '../lib/customBackdrops'
import { cleanFeelings, isEnergyLevel } from '../lib/feelings'
import { createId } from '../lib/id'
import { isLocalDate, RECAP_GRACE_CHOICES, RECAP_OPENS_CHOICES, toLocalDate } from '../lib/date'
import { REBLOOM_CARE_DAYS } from '../lib/gardenPace'
import { clampVolume } from '../lib/sound'
import { isRegionId } from '../lib/region'
import { isReminderTime } from '../lib/reminderTime'
import type {
  AmbientTrackId,
  AppState,
  GrownAlongside,
  OutfitPreset,
  OutfitSlot,
  PlantInstance,
} from '../types'

/** Newest schema this build understands. Anything higher was written by a
 *  newer client and must be left untouched rather than overwritten. */
export const CURRENT_STATE_VERSION = 7

/** The jars a version 6 build keeps: it drops any other, silently. */
const VERSION_6_JAR_CHARACTERS = new Set<string>([...JAR_LETTERS, ...JAR_NUMBERS])

/**
 * The version a garden is stored and exported at.
 *
 * Version 7 holds nothing new but a jar's accented letter or mark. A build
 * that knows only version 6 reads a garden at 6 as its own, and would keep
 * every jar but those, silently, with their placements and the Nectar they
 * cost; a garden at 7 it sets aside untouched, as the work of a newer
 * version, and a backup at 7 it refuses. So a garden is written at 7 only
 * once it holds such a jar. Every other garden stays at 6, and an older app
 * can still read it and its backups.
 */
export function storedVersionOf(state: Pick<AppState, 'jars'>): AppState['version'] {
  return state.jars.some((jar) => !VERSION_6_JAR_CHARACTERS.has(jar.character)) ? 7 : 6
}

/**
 * Every state version this build can read: all of them up to the current one.
 * Derived rather than listed, so raising CURRENT_STATE_VERSION cannot leave the
 * previous version out and turn every existing garden into a "damaged" one.
 */
const READABLE_STATE_VERSIONS = new Set(
  Array.from({ length: CURRENT_STATE_VERSION }, (_, index) => index + 1),
)

/**
 * What validating a garden found.
 *
 * The rule, applied entry by entry:
 *
 * - Something the gardener could earn again -- a Sunlight row, a supply count,
 *   a plant, a completion -- is **repaired or dropped** when it is damaged, and
 *   counted in `repaired`.
 * - Something the gardener *wrote* -- a check-in note, a reflection, a recap --
 *   is never silently dropped. If it cannot be placed (no valid day), the whole
 *   garden is **refused**, which sends a stored garden down the withheld path
 *   and makes an import fail with a reason, exactly as damaged images already
 *   do. Text that arrives as the wrong type is kept as text rather than lost.
 *
 * Before this, only the outer arrays were checked, so a hand-edited backup with
 * `goals: [null]` imported "successfully" and then crashed every launch.
 */
export interface GardenValidation {
  state?: AppState
  /** Entries repaired or dropped because they were damaged but recoverable. */
  repaired: number
  /** Plain wording for why the garden was refused, when it was. */
  refused?: string
}

interface Context {
  repaired: number
  refused?: string
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const EPOCH = new Date(0).toISOString()

/**
 * Text that arrived as something else is kept as text: a number becomes its
 * digits and an object its JSON, so nothing the gardener wrote is lost to a
 * type error and nothing reaches React as an object it cannot render.
 */
function asText(value: unknown, ctx: Context, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return fallback
  ctx.repaired += 1
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return fallback
  }
}

function hasText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  return value !== undefined && value !== null && value !== ''
}

/**
 * Map over a stored collection, keeping its identity when nothing changed.
 *
 * The repository's dirty check compares collections element by element
 * (`sameCollection`), so handing back the very array that was read means a
 * garden that needed no repair costs no extra write and no extra allocation.
 */
function sanitise<T>(
  items: unknown[],
  ctx: Context,
  check: (item: unknown, ctx: Context) => T | undefined,
): T[] {
  let changed = false
  const out: T[] = []
  for (const item of items) {
    const next = check(item, ctx)
    if (next === undefined) {
      changed = true
      continue
    }
    if (next !== item) changed = true
    out.push(next)
  }
  return changed ? out : (items as T[])
}

const GOAL_SCHEDULES = new Set(['once', 'daily', 'weekdays'])

function checkGoal(raw: unknown, ctx: Context) {
  if (!isRecord(raw)) {
    ctx.repaired += 1
    return undefined
  }
  const fix: UnknownRecord = { ...raw }
  let changed = false
  if (typeof raw.id !== 'string' || !raw.id) {
    fix.id = createId()
    changed = true
  }
  if (typeof raw.title !== 'string') {
    fix.title = asText(raw.title, ctx)
    changed = true
  }
  if (typeof raw.schedule !== 'string' || !GOAL_SCHEDULES.has(raw.schedule)) {
    fix.schedule = 'daily'
    changed = true
  }
  const weekdays = Array.isArray(raw.weekdays)
    ? raw.weekdays.filter(
        (day, index, all): day is number =>
          typeof day === 'number' &&
          Number.isInteger(day) &&
          day >= 0 &&
          day <= 6 &&
          all.indexOf(day) === index,
      )
    : []
  if (!Array.isArray(raw.weekdays) || weekdays.length !== raw.weekdays.length) {
    fix.weekdays = weekdays
    changed = true
  }
  if (!isLocalDate(raw.createdDate)) {
    fix.createdDate = '1970-01-01'
    changed = true
  }
  if (typeof raw.archived !== 'boolean') {
    fix.archived = raw.archived === true
    changed = true
  }
  for (const field of ['scheduledDate', 'snoozedUntil'] as const) {
    if (raw[field] !== undefined && !isLocalDate(raw[field])) {
      delete fix[field]
      changed = true
    }
  }
  // Optional, and only ever a few words beside the title: one that is not
  // text, or is blank, is dropped rather than shown as an empty line.
  if (
    raw.tinyTitle !== undefined &&
    (typeof raw.tinyTitle !== 'string' || !raw.tinyTitle.trim())
  ) {
    delete fix.tinyTitle
    changed = true
  }
  if (raw.skippedDates !== undefined) {
    const skipped = Array.isArray(raw.skippedDates)
      ? raw.skippedDates.filter(isLocalDate)
      : []
    if (
      !Array.isArray(raw.skippedDates) ||
      skipped.length !== raw.skippedDates.length
    ) {
      fix.skippedDates = skipped
      changed = true
    }
  }
  if (changed) ctx.repaired += 1
  return (changed ? fix : raw) as unknown as AppState['goals'][number]
}

function checkCompletion(raw: unknown, ctx: Context) {
  if (
    !isRecord(raw) ||
    typeof raw.goalId !== 'string' ||
    !isLocalDate(raw.localDate)
  ) {
    ctx.repaired += 1
    return undefined
  }
  if (typeof raw.id === 'string' && typeof raw.completedAt === 'string') {
    return raw as unknown as AppState['completions'][number]
  }
  ctx.repaired += 1
  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : `${raw.goalId}:${raw.localDate}`,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : EPOCH,
  } as AppState['completions'][number]
}

/**
 * An entry the gardener wrote. Without a real day it cannot be placed in the
 * journal; if it carries words, the garden is refused rather than lose them.
 */
function placeWrittenEntry(
  raw: UnknownRecord,
  textFields: readonly string[],
  what: string,
  ctx: Context,
): 'keep' | 'drop' {
  if (isLocalDate(raw.localDate)) return 'keep'
  if (textFields.some((field) => hasText(raw[field]))) {
    ctx.refused ??= `It contains ${what} without a valid date, and this app will not drop anything you wrote.`
    return 'drop'
  }
  ctx.repaired += 1
  return 'drop'
}

function stamp(value: unknown): string {
  return typeof value === 'string' ? value : EPOCH
}

/**
 * A check-in's optional feelings and energy, kept only when well formed:
 * feelings as known ids, each once, in the list's order, never an empty list;
 * energy as one of its three steps. Anything else is left out, like any
 * later optional field, and not counted as damage: the check-in itself, its
 * weather and its words, is untouched. Hands back the same entry when there
 * is nothing to tidy, so an undamaged garden costs no extra write.
 */
function withCheckInDetails(entry: UnknownRecord): UnknownRecord {
  const stored = entry.feelings
  const feelings = cleanFeelings(stored)
  // Clean already when cleaning it changes nothing, item for item.
  const feelingsOk =
    stored === undefined ||
    (Array.isArray(stored) &&
      stored.length === feelings?.length &&
      feelings.every((id, index) => stored[index] === id))
  const energyOk = entry.energy === undefined || isEnergyLevel(entry.energy)
  if (feelingsOk && energyOk) return entry
  const tidy = { ...entry }
  if (!feelingsOk) {
    if (feelings) tidy.feelings = feelings
    else delete tidy.feelings
  }
  if (!energyOk) delete tidy.energy
  return tidy
}

function checkMood(raw: unknown, ctx: Context) {
  if (!isRecord(raw)) {
    ctx.repaired += 1
    return undefined
  }
  if (placeWrittenEntry(raw, ['note'], 'a check-in', ctx) === 'drop') {
    return undefined
  }
  const levelOk =
    typeof raw.level === 'number' &&
    Number.isInteger(raw.level) &&
    raw.level >= 1 &&
    raw.level <= 5
  if (
    typeof raw.id === 'string' &&
    levelOk &&
    typeof raw.note === 'string' &&
    typeof raw.createdAt === 'string' &&
    typeof raw.updatedAt === 'string'
  ) {
    return withCheckInDetails(raw) as unknown as AppState['moods'][number]
  }
  ctx.repaired += 1
  const level =
    typeof raw.level === 'number' && Number.isFinite(raw.level)
      ? Math.min(5, Math.max(1, Math.round(raw.level)))
      : 3
  return withCheckInDetails({
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : createId(),
    level,
    note: asText(raw.note, ctx),
    createdAt: stamp(raw.createdAt),
    updatedAt: stamp(raw.updatedAt),
  }) as unknown as AppState['moods'][number]
}

function checkReflection(raw: unknown, ctx: Context) {
  if (!isRecord(raw)) {
    ctx.repaired += 1
    return undefined
  }
  if (placeWrittenEntry(raw, ['body'], 'a reflection', ctx) === 'drop') {
    return undefined
  }
  if (
    typeof raw.id === 'string' &&
    typeof raw.body === 'string' &&
    typeof raw.promptId === 'string' &&
    typeof raw.createdAt === 'string' &&
    typeof raw.updatedAt === 'string'
  ) {
    return raw as unknown as AppState['reflections'][number]
  }
  ctx.repaired += 1
  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : createId(),
    promptId: asText(raw.promptId, ctx),
    body: asText(raw.body, ctx),
    createdAt: stamp(raw.createdAt),
    updatedAt: stamp(raw.updatedAt),
  } as AppState['reflections'][number]
}

/**
 * An entry written later for an earlier day says so with `writtenLater: true`,
 * and only ever with true. Any other value is no mark at all, so a hand-edited
 * "yes" or false can neither make an entry read as written later nor reach
 * the timeline as something React cannot draw. The entry itself is kept.
 */
function writtenLaterChecked<T extends { writtenLater?: true }>(entry: T | undefined): T | undefined {
  if (!entry || !('writtenLater' in entry) || entry.writtenLater === true) return entry
  const fixed = { ...entry }
  delete fixed.writtenLater
  return fixed
}

/**
 * Recaps that survive validation, at most one per local date.
 *
 * A recap with words but no valid day refuses the garden like any other
 * writing; an empty one is dropped. Identity is repaired rather than required:
 * a recap is the gardener's writing whether or not its id survived.
 */
/** The goals a recap's notes became, kept only as a list of ids. */
function plannedGoalIdsOf(value: unknown): { plannedGoalIds?: string[] } {
  if (!Array.isArray(value)) return {}
  const ids = value.filter((id): id is string => typeof id === 'string')
  return ids.length ? { plannedGoalIds: ids } : {}
}

function migrateRecaps(value: unknown, ctx: Context): AppState['recaps'] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const recaps: AppState['recaps'] = []
  for (const entry of value) {
    if (!isRecord(entry)) {
      ctx.repaired += 1
      continue
    }
    const fields = ['wentWell', 'settingDown', 'forTomorrow']
    if (placeWrittenEntry(entry, fields, 'an evening recap', ctx) === 'drop') {
      continue
    }
    const localDate = entry.localDate as string
    if (seen.has(localDate)) continue
    seen.add(localDate)
    const level =
      typeof entry.level === 'number' &&
      Number.isInteger(entry.level) &&
      entry.level >= 1 &&
      entry.level <= 5
        ? (entry.level as NonNullable<AppState['recaps'][number]['level']>)
        : undefined
    recaps.push({
      id: typeof entry.id === 'string' ? entry.id : createId(),
      localDate,
      ...(level === undefined ? {} : { level }),
      wentWell: asText(entry.wentWell, ctx),
      settingDown: asText(entry.settingDown, ctx),
      forTomorrow: asText(entry.forTomorrow, ctx),
      ...(typeof entry.plannedGoalId === 'string'
        ? { plannedGoalId: entry.plannedGoalId }
        : {}),
      ...plannedGoalIdsOf(entry.plannedGoalIds),
      createdAt: stamp(entry.createdAt),
      updatedAt: stamp(entry.updatedAt),
    })
  }
  return recaps
}

/**
 * Collected Moonlight, at most one award per local date.
 *
 * Stricter than recaps on purpose: this is the ledger that decides whether a
 * night has already paid out, so a malformed award is dropped rather than
 * repaired into one that might pay twice.
 */
function migrateMoonlight(value: unknown): AppState['moonlight'] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const awards: AppState['moonlight'] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    if (
      typeof entry.id !== 'string' ||
      !isLocalDate(entry.localDate) ||
      typeof entry.awardedAt !== 'string' ||
      seen.has(entry.localDate)
    ) {
      continue
    }
    seen.add(entry.localDate)
    awards.push({
      id: entry.id,
      localDate: entry.localDate,
      awardedAt: entry.awardedAt,
    })
  }
  return awards
}

function checkPlant(raw: unknown, ctx: Context) {
  if (!isRecord(raw) || typeof raw.plantId !== 'string') {
    ctx.repaired += 1
    return undefined
  }
  const growthOk =
    typeof raw.growth === 'number' &&
    Number.isInteger(raw.growth) &&
    raw.growth >= 0 &&
    raw.growth <= 3
  if (typeof raw.id === 'string' && growthOk && typeof raw.plantedAt === 'string') {
    return withBloomCountChecked(raw as unknown as PlantInstance)
  }
  ctx.repaired += 1
  return withBloomCountChecked({
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : createId(),
    growth:
      typeof raw.growth === 'number' && Number.isFinite(raw.growth)
        ? Math.min(3, Math.max(0, Math.floor(raw.growth)))
        : 0,
    plantedAt: stamp(raw.plantedAt),
  } as PlantInstance)
}

/**
 * A plant's count toward its next bloom (Keep giving) is kept only as whole
 * days of care, from 1 to the days a bloom takes. A larger whole number, as
 * a build with a longer wait might leave, reads as ready rather than losing
 * the days counted; anything else is dropped, and the count starts again.
 * Not counted as a repair: nothing the gardener made is changed.
 */
function withBloomCountChecked(plant: PlantInstance): PlantInstance {
  const days: unknown = plant.careDaysSinceBloom
  if (days === undefined) return plant
  const whole = typeof days === 'number' && Number.isInteger(days) && days >= 1
  if (whole && days <= REBLOOM_CARE_DAYS) return plant
  const next = { ...plant }
  if (whole) next.careDaysSinceBloom = REBLOOM_CARE_DAYS
  else delete next.careDaysSinceBloom
  return next
}

function checkSunlight(raw: unknown, ctx: Context) {
  if (
    !isRecord(raw) ||
    !isLocalDate(raw.localDate) ||
    typeof raw.source !== 'string'
  ) {
    ctx.repaired += 1
    return undefined
  }
  if (typeof raw.id === 'string' && typeof raw.awardedAt === 'string') {
    return raw as unknown as AppState['sunlight'][number]
  }
  ctx.repaired += 1
  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : createId(),
    awardedAt: stamp(raw.awardedAt),
  } as AppState['sunlight'][number]
}

const CREATURE_STAGES = new Set(['egg', 'caterpillar', 'chrysalis', 'butterfly'])
const OUTFIT_SLOTS = new Set<OutfitSlot>(['headwear', 'accessory', 'aura'])
const FLIGHT_PATTERN_IDS = new Set<string>(flightPatterns.map((pattern) => pattern.id))

/**
 * `activeGoalIds` are the goals a companion may be grown alongside: those
 * the garden has, and has not archived.
 */
function checkCreature(raw: unknown, ctx: Context, activeGoalIds: ReadonlySet<string>) {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    typeof raw.speciesId !== 'string'
  ) {
    ctx.repaired += 1
    return undefined
  }
  // 1.x used 'emerged' as the final stage; 2.0 renames it 'butterfly' and
  // adds the 'egg' stage plus per-stage care tracking.
  const rawStage = raw.stage === 'emerged' ? 'butterfly' : raw.stage
  const stage = (
    typeof rawStage === 'string' && CREATURE_STAGES.has(rawStage)
      ? rawStage
      : 'caterpillar'
  ) as AppState['creatures'][number]['stage']

  const careDates: Record<string, string[]> = {}
  if (isRecord(raw.careDates)) {
    for (const [key, dates] of Object.entries(raw.careDates)) {
      if (!CREATURE_STAGES.has(key) || !Array.isArray(dates)) {
        ctx.repaired += 1
        continue
      }
      const kept = dates.filter(isLocalDate)
      if (kept.length !== dates.length) ctx.repaired += 1
      careDates[key] = kept
    }
  }
  const actionLog: Record<string, string> = {}
  if (isRecord(raw.actionLog)) {
    for (const [key, date] of Object.entries(raw.actionLog)) {
      if (isLocalDate(date)) actionLog[key] = date
      else ctx.repaired += 1
    }
  }
  const outfit: Partial<Record<OutfitSlot, string>> = {}
  if (isRecord(raw.outfit)) {
    for (const [slot, item] of Object.entries(raw.outfit)) {
      if (OUTFIT_SLOTS.has(slot as OutfitSlot) && typeof item === 'string') {
        outfit[slot as OutfitSlot] = item
      } else {
        ctx.repaired += 1
      }
    }
  }
  const finite = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value
      : 0
  const optionalStamp = (value: unknown) =>
    typeof value === 'string' ? value : undefined
  const creature = {
    ...(raw as unknown as AppState['creatures'][number]),
    stage,
    name: asText(raw.name, ctx, 'Little one'),
    careDates,
    actionLog,
    bond: finite(raw.bond),
    outfit,
    carePoints: finite(raw.carePoints),
    discoveredAt: stamp(raw.discoveredAt),
    chrysalisStartedAt: optionalStamp(raw.chrysalisStartedAt),
    emergeAt: optionalStamp(raw.emergeAt),
    emergedAt: optionalStamp(raw.emergedAt),
    sourcePlantId: optionalStamp(raw.sourcePlantId),
  }
  // An open offer to name an egg is only ever stored as true. Anything else
  // is no offer, so a hand-edited value can never reach the Care page.
  if (raw.awaitingName !== true) delete creature.awaitingName
  // A companion's own flight pattern is kept only when the catalogue knows
  // it; without one it flies the garden's, which is no damage to report.
  // Whether the garden still owns it is asked when the garden is drawn
  // (flightPatternFor), so a choice is not lost while a pattern is unowned.
  if (
    typeof raw.flightPatternId !== 'string' ||
    !FLIGHT_PATTERN_IDS.has(raw.flightPatternId)
  )
    delete creature.flightPatternId
  // The companion's diary, kept only in the shapes it is written in, so a
  // hand-edited value never reaches its story. A dropped note is not damage:
  // the diary is a keepsake, and nothing is earned from it.
  if (raw.hatchedAt !== undefined && !isTimestamp(raw.hatchedAt)) delete creature.hatchedAt
  const careCounts = checkCareCounts(raw.careCounts)
  if (careCounts) creature.careCounts = careCounts
  else delete creature.careCounts
  const outfitsWorn = checkOutfitsWorn(raw.outfitsWorn)
  if (outfitsWorn) creature.outfitsWorn = outfitsWorn
  else delete creature.outfitsWorn
  const grownAlongside = checkGrownAlongside(raw.grownAlongside)
  if (grownAlongside) creature.grownAlongside = grownAlongside
  else delete creature.grownAlongside
  // Grown alongside a goal only while it grows, and only a goal still in
  // use: archiving or deleting one lets its companions go, which an older
  // build does not know to do, and a butterfly has no stage left for a goal
  // to count toward. Letting go loses nothing (the diary above keeps the
  // story), so it is not damage to report.
  if (
    typeof raw.adoptedGoalId !== 'string' ||
    !activeGoalIds.has(raw.adoptedGoalId) ||
    stage === 'butterfly'
  ) {
    delete creature.adoptedGoalId
  }
  return creature
}

/**
 * The goals a companion was grown alongside, kept only in the shape the
 * diary writes: a goal's id and title as text, and real local dates, each
 * day once across them all and at most MAX_GOAL_DAYS. A goal the garden no
 * longer has is still part of the story, so its id need not name one.
 */
function checkGrownAlongside(value: unknown): GrownAlongside[] | undefined {
  if (!Array.isArray(value)) return undefined
  const goals = new Set<string>()
  const days = new Set<string>()
  const kept: GrownAlongside[] = []
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      typeof entry.goalId !== 'string' ||
      !entry.goalId ||
      goals.has(entry.goalId) ||
      typeof entry.title !== 'string' ||
      !entry.title.trim() ||
      !Array.isArray(entry.dates)
    ) {
      continue
    }
    const dates: string[] = []
    for (const date of entry.dates) {
      if (!isLocalDate(date) || days.has(date) || days.size >= MAX_GOAL_DAYS) continue
      days.add(date)
      dates.push(date)
    }
    if (dates.length === 0) continue
    goals.add(entry.goalId)
    kept.push({ goalId: entry.goalId, title: entry.title, dates })
  }
  return kept.length > 0 ? kept : undefined
}

/** Counts of care actions this build knows, each a whole number above zero. */
function checkCareCounts(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined
  const counts: Record<string, number> = {}
  for (const [actionId, count] of Object.entries(value)) {
    if (getCareAction(actionId) && Number.isSafeInteger(count) && (count as number) > 0) {
      counts[actionId] = count as number
    }
  }
  return Object.keys(counts).length > 0 ? counts : undefined
}

/** Whether an id names a piece the closet could hold, in this slot if one is given. */
function isCosmetic(itemId: unknown, slot?: string): itemId is string {
  if (typeof itemId !== 'string') return false
  const item = getShopItem(itemId)
  if (item?.kind !== 'cosmetic') return false
  return !slot || item.slot === slot
}

/** Known cosmetics, each once, in the order worn, no more than the diary keeps. */
function checkOutfitsWorn(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const worn = value
    .filter((itemId, index): itemId is string => isCosmetic(itemId) && value.indexOf(itemId) === index)
    .slice(0, MAX_OUTFITS_WORN)
  if (worn.length === 0) return undefined
  return worn.length === value.length ? (value as string[]) : worn
}

/**
 * A saved look's outfit: known slots, each holding a cosmetic made for that
 * slot. Whether the gardener still owns it is asked when it is worn.
 */
function checkPresetOutfit(value: unknown): OutfitPreset['outfit'] {
  const outfit: OutfitPreset['outfit'] = {}
  if (!isRecord(value)) return outfit
  for (const [slot, itemId] of Object.entries(value)) {
    if (OUTFIT_SLOTS.has(slot as OutfitSlot) && isCosmetic(itemId, slot)) {
      outfit[slot as OutfitSlot] = itemId
    }
  }
  return outfit
}

/**
 * Saved looks (lib/outfitPresets), kept in the profile: each with an id of
 * its own, a name as the wardrobe keeps names, and at least one piece the
 * catalogue knows; no more than the closet keeps. The very same list when
 * nothing needed changing. Undefined when none are left, or there never were
 * any: no looks are stored as no field, so an older garden stays exactly as
 * it was.
 */
function checkOutfitPresets(value: unknown): OutfitPreset[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<string>()
  let changed = false
  const presets: OutfitPreset[] = []
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || seen.has(raw.id)) {
      changed = true
      continue
    }
    const outfit = checkPresetOutfit(raw.outfit)
    const pieces = Object.keys(outfit).length
    if (pieces === 0) {
      changed = true
      continue
    }
    seen.add(raw.id)
    const name = (typeof raw.name === 'string' && presetName(raw.name)) || 'Saved look'
    if (
      name === raw.name &&
      isRecord(raw.outfit) &&
      Object.keys(raw.outfit).length === pieces &&
      Object.keys(raw).length === 3
    ) {
      presets.push(raw as unknown as OutfitPreset)
    } else {
      changed = true
      presets.push({ id: raw.id, name, outfit })
    }
  }
  if (presets.length === 0) return undefined
  if (presets.length > MAX_OUTFIT_PRESETS) {
    changed = true
    presets.length = MAX_OUTFIT_PRESETS
  }
  return changed ? presets : (value as OutfitPreset[])
}

/** Counts that can be earned again: whole, finite, never negative. */
function balance(value: unknown, ctx: Context): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Number.isInteger(value) ? value : Math.floor(value)
  }
  if (value !== undefined) ctx.repaired += 1
  return 0
}

/**
 * Image collections already found sound, by identity.
 *
 * Checking one runs a pattern over up to ~4 MB of base64. A sync from another
 * tab validates the whole garden again, though its images rarely changed, and
 * adopt() hands an unchanged collection back as the very same array. Garden
 * state is replaced, never edited in place, so an array that passed once
 * still holds what passed. A changed collection is a new array and is checked
 * in full.
 *
 * Moving images to Blobs in a store of their own (the plan's first idea) would
 * also save the base64 third, but costs a schema migration and object-URL
 * lifetimes for three images at most; this removes the repeated cost, which
 * was the measured problem.
 */
const checkedImageCollections = new WeakSet<object>()

function imagesChecked(value: unknown): boolean {
  return typeof value === 'object' && value !== null && checkedImageCollections.has(value)
}

/**
 * An image's brightness that is not a number in range is dropped, not
 * refused: the picture itself is sound, and showing it as taken loses
 * nothing. The same list comes back when nothing was dropped, so an image
 * collection is not rewritten for want of a change.
 */
function withBrightnessInRange(value: unknown): unknown {
  if (!Array.isArray(value) || imagesChecked(value)) return value
  let dropped = false
  const records = value.map((record: unknown) => {
    if (!isRecord(record) || record.brightness === undefined || isValidBrightness(record.brightness))
      return record
    dropped = true
    const copy = { ...record }
    delete copy.brightness
    return copy
  })
  return dropped ? records : value
}

const AMBIENT_TRACK_IDS = new Set<string>(
  ambientTracks.map((track) => track.id),
)
const THEMES = new Set(['sunlight', 'night'])
const THEME_FOLLOWS = new Set(['device', 'evening'])
const TEXT_SIZES = new Set(['larger', 'largest'])

function checkProfile(
  value: unknown,
  ctx: Context,
): AppState['profile'] | undefined {
  if (!isRecord(value)) return undefined
  const optionalText = (field: unknown) =>
    typeof field === 'string' ? field : undefined
  const ambientTrack =
    typeof value.ambientTrack === 'string' &&
    AMBIENT_TRACK_IDS.has(value.ambientTrack)
      ? (value.ambientTrack as AmbientTrackId)
      : DEFAULT_AMBIENT_TRACK_ID
  const profile = {
    ...(value as unknown as NonNullable<AppState['profile']>),
    id: 'profile' as const,
    name: asText(value.name, ctx, 'Gardener'),
    gardenName: asText(value.gardenName, ctx, 'My Butterfly Garden'),
    createdAt: stamp(value.createdAt),
    reducedMotion: value.reducedMotion === true,
    ambientTrack,
    activeCompanionId: optionalText(value.activeCompanionId),
    selectedBackdropId: optionalText(
      value.selectedBackdropId,
    ) as NonNullable<AppState['profile']>['selectedBackdropId'],
    selectedCustomBackdropId: optionalText(value.selectedCustomBackdropId),
    lastSeenReleaseId: optionalText(value.lastSeenReleaseId),
    unlockedBackdropIds: Array.isArray(value.unlockedBackdropIds)
      ? (value.unlockedBackdropIds.filter(
          (id) => typeof id === 'string',
        ) as NonNullable<AppState['profile']>['unlockedBackdropIds'])
      : undefined,
  }
  if (value.ambientSound !== undefined) {
    profile.ambientSound = value.ambientSound === true
  }
  if (value.calmMotion !== undefined) {
    profile.calmMotion = value.calmMotion === true
  }
  // Later optional choices: kept when well-formed, dropped otherwise, so a
  // hand-edited value can never reach the screen in the wrong type.
  if (value.hideDayCounts !== undefined) {
    profile.hideDayCounts = value.hideDayCounts === true
  }
  if (value.gentleDay !== undefined && !isLocalDate(value.gentleDay)) {
    delete profile.gentleDay
  }
  if (value.tendFirstPlantId !== undefined && typeof value.tendFirstPlantId !== 'string') {
    delete profile.tendFirstPlantId
  }
  if (
    value.recapOpensHour !== undefined &&
    !RECAP_OPENS_CHOICES.includes(value.recapOpensHour as number)
  ) {
    delete profile.recapOpensHour
  }
  if (
    value.recapGraceEndsHour !== undefined &&
    !RECAP_GRACE_CHOICES.includes(value.recapGraceEndsHour as number)
  ) {
    delete profile.recapGraceEndsHour
  }
  // The night's image: dropped when it is not an id, and the day's shows.
  if (value.nightCustomBackdropId !== undefined && typeof value.nightCustomBackdropId !== 'string') {
    delete profile.nightCustomBackdropId
  }
  if (value.theme !== undefined && !THEMES.has(value.theme as string)) {
    ctx.repaired += 1
    delete profile.theme
  }
  if (value.lastBackupAt !== undefined && !isTimestamp(value.lastBackupAt)) {
    delete profile.lastBackupAt
  }
  if (value.diarySince !== undefined && !isTimestamp(value.diarySince)) {
    delete profile.diarySince
  }
  // Dropped, not repaired, when unknown: the hand-chosen theme is still there
  // underneath, and the usual text size is always readable.
  if (value.themeFollows !== undefined && !THEME_FOLLOWS.has(value.themeFollows as string)) {
    delete profile.themeFollows
  }
  if (value.textSize !== undefined && !TEXT_SIZES.has(value.textSize as string)) {
    delete profile.textSize
  }
  // The sound's choices. A volume out of range is brought into it, since what
  // was meant is plain; anything that is not a number is dropped, and the
  // usual volume plays. The two switches are stored only in their one
  // non-default value, so any other is dropped and the default stands.
  if (value.ambientVolume !== undefined) {
    if (typeof value.ambientVolume === 'number' && Number.isFinite(value.ambientVolume)) {
      profile.ambientVolume = clampVolume(value.ambientVolume)
    } else {
      delete profile.ambientVolume
    }
  }
  if (value.soundFollowsTheme !== undefined && value.soundFollowsTheme !== true) {
    delete profile.soundFollowsTheme
  }
  if (value.soundInBackground !== undefined && value.soundInBackground !== false) {
    delete profile.soundInBackground
  }
  // Classic is the absence of a pace, so anything but Keep giving is Classic.
  if (value.gardenPace !== undefined && value.gardenPace !== 'keep-giving') {
    delete profile.gardenPace
  }
  // An unknown region is dropped, not guessed at: without one the Guide
  // simply marks nothing, as it did before there was a choice.
  if (value.region !== undefined && !isRegionId(value.region)) {
    delete profile.region
  }
  // Only ever a suggestion for the time field, so anything that is not a
  // time of day is dropped and Settings offers the morning's again.
  if (value.reminderTime !== undefined && !isReminderTime(value.reminderTime)) {
    delete profile.reminderTime
  }
  // Visits are days that have happened: a date in the future could hold
  // back a welcome, or show one, on the wrong day.
  const today = toLocalDate()
  for (const field of ['lastVisitOn', 'welcomeBackOn'] as const) {
    const date = value[field]
    if (date !== undefined && !(isLocalDate(date) && date <= today)) delete profile[field]
  }
  // Saved looks live here, in the profile, because every older build carries
  // the profile through whole (see Profile.outfitPresets). A look dropped is
  // not damage: it is only an arrangement of pieces, and nothing is lost
  // from the closet with it.
  const outfitPresets = checkOutfitPresets(value.outfitPresets)
  if (outfitPresets) profile.outfitPresets = outfitPresets
  else delete profile.outfitPresets
  return profile
}

/**
 * An ISO 8601 date and time that names a real moment, as `toISOString()`
 * writes it. Anything else could not be compared with the clock, so it is
 * dropped and the garden simply has no copy on record.
 */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP.test(value) &&
    !Number.isNaN(Date.parse(value))
  )
}

function checkInventory(value: unknown, ctx: Context): Record<string, number> {
  if (!isRecord(value)) return {}
  const inventory: Record<string, number> = {}
  for (const [itemId, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
      inventory[itemId] = Math.floor(count)
    } else {
      ctx.repaired += 1
    }
  }
  return inventory
}

/**
 * Validate and migrate any stored or imported garden into the current shape.
 *
 * Shared by the load path and the import path, so a stored garden and a backup
 * are held to one standard.
 */
export function validateGarden(value: unknown): GardenValidation {
  const ctx: Context = { repaired: 0 }
  if (!isRecord(value)) {
    return { repaired: 0, refused: 'It is not a garden.' }
  }
  const candidate = value
  if (
    typeof candidate.version !== 'number' ||
    !READABLE_STATE_VERSIONS.has(candidate.version)
  ) {
    return {
      repaired: 0,
      refused:
        typeof candidate.version === 'number' &&
        candidate.version > CURRENT_STATE_VERSION
          ? 'It was written by a newer version of the garden.'
          : 'It is not a garden this version can read.',
    }
  }
  if (
    !Array.isArray(candidate.goals) ||
    !Array.isArray(candidate.completions) ||
    !Array.isArray(candidate.moods) ||
    !Array.isArray(candidate.reflections) ||
    !Array.isArray(candidate.plants) ||
    !Array.isArray(candidate.creatures) ||
    !Array.isArray(candidate.sunlight) ||
    typeof candidate.seeds !== 'number'
  ) {
    return { repaired: 0, refused: 'Part of the garden is missing.' }
  }

  const knownPatternIds = new Set(flightPatterns.map((pattern) => pattern.id))
  const owned = [
    DEFAULT_FLIGHT_PATTERN_ID,
    ...(Array.isArray(candidate.ownedFlightPatternIds)
      ? candidate.ownedFlightPatternIds.filter(
          (id): id is AppState['ownedFlightPatternIds'][number] =>
            typeof id === 'string' &&
            knownPatternIds.has(id as AppState['ownedFlightPatternIds'][number]),
        )
      : []),
  ].filter((id, index, ids) => ids.indexOf(id) === index)
  const selected =
    typeof candidate.selectedFlightPatternId === 'string' &&
    owned.includes(
      candidate.selectedFlightPatternId as AppState['selectedFlightPatternId'],
    )
      ? candidate.selectedFlightPatternId
      : DEFAULT_FLIGHT_PATTERN_ID

  const knownColorIds = new Set<string>(jarColors.map((color) => color.id))
  const seenJarIds = new Set<string>()
  const jars = Array.isArray(candidate.jars)
    ? candidate.jars.filter(
        (jar): jar is AppState['jars'][number] & UnknownRecord => {
          if (!isRecord(jar)) return false
          const ok =
            typeof jar.id === 'string' &&
            !seenJarIds.has(jar.id) &&
            typeof jar.character === 'string' &&
            jarCharacters.includes(jar.character) &&
            typeof jar.colorId === 'string' &&
            knownColorIds.has(jar.colorId) &&
            typeof jar.purchasedAt === 'string'
          if (ok) seenJarIds.add(jar.id as string)
          return ok
        },
      )
    : []

  const plants = sanitise(candidate.plants, ctx, checkPlant)
  const knownJarIds = new Set(jars.map((jar) => jar.id))
  const knownPlantIds = new Set(plants.map((plant) => plant.id))
  const placedJarIds = new Set<string>()
  const placedPlantIds = new Set<string>()
  const jarPlacements = Array.isArray(candidate.jarPlacements)
    ? candidate.jarPlacements.filter(
        (
          placement,
        ): placement is AppState['jarPlacements'][number] & UnknownRecord => {
          if (!isRecord(placement)) return false
          if (
            typeof placement.jarId !== 'string' ||
            typeof placement.plantId !== 'string' ||
            !knownJarIds.has(placement.jarId) ||
            !knownPlantIds.has(placement.plantId) ||
            placedJarIds.has(placement.jarId) ||
            placedPlantIds.has(placement.plantId)
          ) {
            return false
          }
          placedJarIds.add(placement.jarId)
          placedPlantIds.add(placement.plantId)
          return true
        },
      )
    : []

  /**
   * Images are refused outright when malformed, rather than filtered like the
   * other collections.
   *
   * Everything else here can be re-earned or re-written. A gardener's own
   * photographs cannot, and this build is the only thing standing between a
   * damaged file and a restore that reports success while having quietly
   * dropped them. Refusing sends it down the withheld path instead, which
   * leaves the stored garden untouched and says so.
   */
  const storedCustomBackdrops = withBrightnessInRange(candidate.customBackdrops)
  if (storedCustomBackdrops !== undefined && !imagesChecked(storedCustomBackdrops)) {
    if (!isValidCustomBackdropCollection(storedCustomBackdrops)) {
      return { repaired: 0, refused: 'One of its images is damaged.' }
    }
    checkedImageCollections.add(storedCustomBackdrops as object)
  }
  const customBackdrops = (storedCustomBackdrops ??
    []) as AppState['customBackdrops']

  const goals = sanitise(candidate.goals, ctx, checkGoal)
  const completions = sanitise(candidate.completions, ctx, checkCompletion)
  const moods = sanitise(candidate.moods, ctx, (raw, c) => writtenLaterChecked(checkMood(raw, c)))
  const reflections = sanitise(candidate.reflections, ctx, (raw, c) =>
    writtenLaterChecked(checkReflection(raw, c)),
  )
  const sunlight = sanitise(candidate.sunlight, ctx, checkSunlight)
  const activeGoalIds = new Set(goals.filter((goal) => !goal.archived).map((goal) => goal.id))
  const creatures = sanitise(candidate.creatures, ctx, (raw, c) =>
    checkCreature(raw, c, activeGoalIds),
  )
  // Absent in every garden written before version 5, which is why these are
  // tolerated rather than required the way `moods` is above.
  const recaps = migrateRecaps(candidate.recaps, ctx)
  const moonlight = migrateMoonlight(candidate.moonlight)

  if (ctx.refused) return { repaired: ctx.repaired, refused: ctx.refused }

  const profile = checkProfile(candidate.profile, ctx)
  // A night image the garden no longer holds (removed in a build that did
  // not know about night images) would have every night say the image is
  // unavailable; without one, the night shows what the day does.
  if (
    profile?.nightCustomBackdropId !== undefined &&
    !customBackdrops.some((image) => image.id === profile.nightCustomBackdropId)
  ) {
    delete profile.nightCustomBackdropId
  }

  const state: AppState = {
    ...(candidate as unknown as AppState),
    version: storedVersionOf({ jars }),
    profile,
    goals,
    completions,
    moods,
    reflections,
    recaps,
    moonlight,
    customBackdrops,
    plants,
    creatures,
    sunlight,
    seeds: balance(candidate.seeds, ctx),
    nectar: balance(candidate.nectar, ctx),
    stardust: balance(candidate.stardust, ctx),
    inventory: checkInventory(candidate.inventory, ctx),
    ownedItemIds: Array.isArray(candidate.ownedItemIds)
      ? candidate.ownedItemIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : [],
    ownedFlightPatternIds: owned,
    selectedFlightPatternId: selected as AppState['selectedFlightPatternId'],
    jars,
    jarPlacements,
  }
  return { state, repaired: ctx.repaired }
}

export function migrateState(value: unknown): AppState | undefined {
  return validateGarden(value).state
}

/**
 * Why a stored record could not be read. 'incompatible' means a newer client
 * wrote it; that data is still good and must never be overwritten.
 */
export function classifyRecord(
  value: unknown,
): 'readable' | 'incompatible' | 'malformed' {
  if (!isRecord(value)) return 'malformed'
  const version = value.version
  if (typeof version === 'number' && version > CURRENT_STATE_VERSION) {
    return 'incompatible'
  }
  return migrateState(value) ? 'readable' : 'malformed'
}
