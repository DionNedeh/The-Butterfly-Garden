import { plants as plantCatalog } from '../data/content'
import type { AppState } from '../types'
import { daysBetweenLocalDates } from './date'
import { MAX_PLANT_GROWTH } from './progression'

/**
 * The one small thing the garden shows on a return after a few days away
 * (lib/visits): a line about something the garden really holds, a plant or
 * a companion, or a note from Marigold, who is in every garden.
 *
 * Every line is about the garden, never about the gardener's absence: none
 * says how long, none says anything was missed, waited for or lost, and none
 * claims a change the garden does not show. A host plant is never said to
 * have opened a new bloom, since under Keep giving that would promise an egg.
 */

type Line = (subject: string) => string

const NOTE_FROM_THE_FIRST: Record<'caterpillar' | 'chrysalis' | 'butterfly', Line> = {
  caterpillar: (name) => `A note from ${name}, nibbled into a leaf: “Hello again.”`,
  chrysalis: (name) => `A note from ${name}, tucked beside the chrysalis: “Still dreaming. Glad you’re here.”`,
  butterfly: (name) => `A note from ${name}: “The flowers smelled lovely today. Glad you’re here.”`,
}

const MARIGOLD_NOTES: readonly string[] = [
  'A note from Marigold: “The garden kept a sunny spot for you.”',
  'A note from Marigold: “The breeze has been soft today. Make yourself at home.”',
]

/** One family of lines: everything it could say about this garden. */
type Family = readonly string[]

function plantName(plantId: string): string | undefined {
  return plantCatalog.find((plant) => plant.id === plantId)?.name.toLowerCase()
}

function familiesOf(state: Pick<AppState, 'plants' | 'creatures'>): Family[] {
  const blooms: string[] = []
  const visits: string[] = []
  const leaves: string[] = []
  const seeds: string[] = []
  const seen = new Set<string>()
  for (const plant of state.plants) {
    const name = plantName(plant.plantId)
    // One line a kind of plant, however many of it are growing.
    if (!name || seen.has(plant.plantId)) continue
    seen.add(plant.plantId)
    const host = plantCatalog.some((entry) => entry.id === plant.plantId && entry.kind === 'host')
    if (plant.growth >= MAX_PLANT_GROWTH) {
      visits.push(`A visitor fluttered by the ${name} while the garden rested.`)
      if (!host) blooms.push(`The ${name} opened a new bloom while the garden rested.`)
      else leaves.push(`The ${name} swayed in the breeze while the garden rested.`)
    } else if (plant.growth > 0) {
      leaves.push(`Dew gathered on the ${name} while the garden rested.`)
    } else {
      seeds.push(`The ${name} seed stayed tucked in, warm in the soil.`)
    }
  }
  const flyers = state.creatures
    .filter((creature) => creature.stage === 'butterfly')
    .map((creature) => `${creature.name} fluttered a slow loop over the garden, just because.`)
  // The first companion is the one the garden began with.
  const first = state.creatures[0]
  const note = first && first.stage !== 'egg' ? [NOTE_FROM_THE_FIRST[first.stage](first.name)] : []
  return [note, flyers, blooms, visits, leaves, seeds, MARIGOLD_NOTES].filter(
    (family) => family.length > 0,
  )
}

/**
 * The line for a return on `returnedOn`, chosen from what the garden holds.
 * The same garden on the same day always says the same thing, so a reload
 * never swaps it for another; a different day or garden can say something
 * else. The day picks a family first, then a line in it, so a garden full
 * of plants still hears from its companions.
 */
export function welcomeBackLine(
  state: Pick<AppState, 'plants' | 'creatures'>,
  returnedOn: string,
): string {
  const families = familiesOf(state)
  const day = Math.abs(daysBetweenLocalDates('1970-01-01', returnedOn))
  const family = families[day % families.length]
  return family[Math.floor(day / families.length) % family.length]
}
