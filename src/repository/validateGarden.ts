import { DEFAULT_FLIGHT_PATTERN_ID } from '../lib/flightPatterns'
import { flightPatterns } from '../data/flightPatterns'
import { jarCharacters, jarColors } from '../data/jars'
import { ambientTracks, DEFAULT_AMBIENT_TRACK_ID } from '../data/ambientTracks'
import { isValidCustomBackdropCollection } from '../lib/customBackdrops'
import { createId } from '../lib/id'
import type { AmbientTrackId, AppState, OutfitSlot } from '../types'

/** Newest schema this build understands. Anything higher was written by a
 *  newer client and must be left untouched rather than overwritten. */
export const CURRENT_STATE_VERSION = 6

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

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day written as YYYY-MM-DD, the app's only date shape. */
export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
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
    return raw as unknown as AppState['moods'][number]
  }
  ctx.repaired += 1
  const level =
    typeof raw.level === 'number' && Number.isFinite(raw.level)
      ? Math.min(5, Math.max(1, Math.round(raw.level)))
      : 3
  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : createId(),
    level,
    note: asText(raw.note, ctx),
    createdAt: stamp(raw.createdAt),
    updatedAt: stamp(raw.updatedAt),
  } as AppState['moods'][number]
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
 * Recaps that survive validation, at most one per local date.
 *
 * A recap with words but no valid day refuses the garden like any other
 * writing; an empty one is dropped. Identity is repaired rather than required:
 * a recap is the gardener's writing whether or not its id survived.
 */
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
    return raw as unknown as AppState['plants'][number]
  }
  ctx.repaired += 1
  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : createId(),
    growth:
      typeof raw.growth === 'number' && Number.isFinite(raw.growth)
        ? Math.min(3, Math.max(0, Math.floor(raw.growth)))
        : 0,
    plantedAt: stamp(raw.plantedAt),
  } as AppState['plants'][number]
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

function checkCreature(raw: unknown, ctx: Context) {
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
  return {
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

const AMBIENT_TRACK_IDS = new Set<string>(
  ambientTracks.map((track) => track.id),
)
const THEMES = new Set(['sunlight', 'night'])

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
  if (value.theme !== undefined && !THEMES.has(value.theme as string)) {
    ctx.repaired += 1
    delete profile.theme
  }
  return profile
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
  const storedCustomBackdrops = candidate.customBackdrops
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
  const moods = sanitise(candidate.moods, ctx, checkMood)
  const reflections = sanitise(candidate.reflections, ctx, checkReflection)
  const sunlight = sanitise(candidate.sunlight, ctx, checkSunlight)
  const creatures = sanitise(candidate.creatures, ctx, checkCreature)
  // Absent in every garden written before version 5, which is why these are
  // tolerated rather than required the way `moods` is above.
  const recaps = migrateRecaps(candidate.recaps, ctx)
  const moonlight = migrateMoonlight(candidate.moonlight)

  if (ctx.refused) return { repaired: ctx.repaired, refused: ctx.refused }

  const state: AppState = {
    ...(candidate as unknown as AppState),
    version: 6,
    profile: checkProfile(candidate.profile, ctx),
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
