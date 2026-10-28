import { careActions } from '../data/careActions'
import { getShopItem } from '../data/shopItems'
import type { CreatureInstance, CreatureStage, Profile } from '../types'
import { toLocalDate } from './date'
import { careDatesForStage, STAGE_CARE_DAYS, STAGE_ORDER } from './lifecycle'

/**
 * A companion's story, told from what the garden kept: the days each stage
 * began, how many days it was cared for, the care given most, the outfits
 * worn, and the goals it was grown alongside. Nothing is guessed. A day that was never recorded is read
 * only where the rules leave no doubt about it, and otherwise left out, and
 * a companion older than the diary is said to be (`diary`).
 */
export interface CompanionStory {
  /** What it came to the garden as: an egg found on a plant, or a caterpillar. */
  arrivedAs: Extract<CreatureStage, 'egg' | 'caterpillar'>
  /** Local dates (YYYY-MM-DD) each later stage began, where known. */
  hatchedOn?: string
  chrysalisOn?: string
  emergedOn?: string
  /** Distinct days it was cared for, in every stage together. */
  daysCaredFor: number
  /** The care given most often, by name, and how often. */
  favourite?: { name: string; count: number }
  /** Names of the outfits it has worn, first worn first. */
  outfitsWorn: string[]
  /**
   * The goals it was grown alongside, by the title each had when it last
   * counted, and the days each counted as its care, first goal first.
   */
  grownAlongside: { title: string; days: number }[]
  /**
   * Whether its story is whole: it arrived once the diary was kept, the diary
   * began after it arrived (on that local date), or the garden has not begun
   * one yet.
   */
  diary: { kind: 'whole' } | { kind: 'began'; on: string } | { kind: 'not-begun' }
}

/** The moment an ISO time names, or undefined when it names none. */
function timeOf(instant: string | undefined): number | undefined {
  if (!instant) return undefined
  const time = Date.parse(instant)
  // validateGarden repairs a missing date to the epoch, which is no more a
  // real moment than an unreadable one.
  return Number.isFinite(time) && time > 0 ? time : undefined
}

function dayOf(instant: string | undefined): string | undefined {
  const time = timeOf(instant)
  return time === undefined ? undefined : toLocalDate(new Date(time))
}

/**
 * The local day a stage began, if the companion has reached it: as recorded,
 * or else the last care day of the stage before. A stage only ever advances
 * on a care day, the third, so that day is the day it began; with fewer than
 * three such days on record (an older garden's rules) it is not known.
 */
function reachedOn(
  creature: CreatureInstance,
  stage: CreatureStage,
  recorded: string | undefined,
): string | undefined {
  const index = STAGE_ORDER.indexOf(stage)
  if (STAGE_ORDER.indexOf(creature.stage) < index) return undefined
  const day = dayOf(recorded)
  if (day) return day
  const before = careDatesForStage(creature, STAGE_ORDER[index - 1])
  return before.length >= STAGE_CARE_DAYS ? [...before].sort().at(-1) : undefined
}

/**
 * The care given most often. A tie goes to the one given most recently, and
 * then to the one listed first, so the answer never changes on its own.
 */
function favouriteCare(creature: CreatureInstance): CompanionStory['favourite'] {
  let best: { name: string; count: number; last: string } | undefined
  for (const action of careActions) {
    const count = creature.careCounts?.[action.id] ?? 0
    if (count < 1) continue
    const last = creature.actionLog[action.id] ?? ''
    if (!best || count > best.count || (count === best.count && last > best.last)) {
      best = { name: action.name, count, last }
    }
  }
  return best && { name: best.name, count: best.count }
}

export function companionStory(
  creature: CreatureInstance,
  profile: Pick<Profile, 'diarySince'> | undefined,
): CompanionStory {
  const egg =
    creature.stage === 'egg' ||
    creature.hatchedAt !== undefined ||
    careDatesForStage(creature, 'egg').length > 0
  const days = new Set(Object.values(creature.careDates).flatMap((dates) => dates ?? []))
  const wornIds = [...(creature.outfitsWorn ?? []), ...Object.values(creature.outfit)]
  const outfitsWorn = wornIds
    .filter((itemId, index): itemId is string => !!itemId && wornIds.indexOf(itemId) === index)
    .flatMap((itemId) => getShopItem(itemId)?.name ?? [])

  const since = timeOf(profile?.diarySince)
  const arrived = timeOf(creature.discoveredAt)
  const diary: CompanionStory['diary'] =
    since === undefined
      ? { kind: 'not-begun' }
      : arrived !== undefined && arrived >= since
        ? { kind: 'whole' }
        : { kind: 'began', on: toLocalDate(new Date(since)) }

  return {
    arrivedAs: egg ? 'egg' : 'caterpillar',
    hatchedOn: egg ? reachedOn(creature, 'caterpillar', creature.hatchedAt) : undefined,
    chrysalisOn: reachedOn(creature, 'chrysalis', creature.chrysalisStartedAt),
    emergedOn: reachedOn(creature, 'butterfly', creature.emergedAt),
    daysCaredFor: days.size,
    favourite: favouriteCare(creature),
    outfitsWorn,
    grownAlongside: (creature.grownAlongside ?? []).map((entry) => ({
      title: entry.title,
      days: entry.dates.length,
    })),
    diary,
  }
}
