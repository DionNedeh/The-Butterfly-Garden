import type { CreatureInstance } from '../types'
import { localDateToNoon, toLocalDate } from './date'

/**
 * The Journal's field notes: one card for each species raised to a
 * butterfly, counted by species rather than by creature, so two Monarchs are
 * one species welcomed (a.4 A4).
 */

/** One species' card. */
export interface FieldNote {
  /** The species' first butterfly to arrive, whose name and date the card gives. */
  first: CreatureInstance
  /** How many of the garden's butterflies are of this species. */
  count: number
}

/**
 * When a creature arrived, as a sortable time, or undefined when unknown. A
 * damaged garden's missing date is repaired to the epoch (validateGarden),
 * which is no more a real arrival than an unreadable one.
 */
function arrivalTime(creature: Pick<CreatureInstance, 'discoveredAt'>): number | undefined {
  const time = Date.parse(creature.discoveredAt)
  return Number.isFinite(time) && time > 0 ? time : undefined
}

/**
 * The garden's butterflies by species, each with the first to be welcomed:
 * the earliest discovery, with the garden's own order (the order they
 * arrived in) breaking a tie, and a creature of unknown date after those
 * with one.
 */
export function fieldNotesBySpecies(
  creatures: readonly CreatureInstance[],
): Map<string, FieldNote> {
  const notes = new Map<string, FieldNote>()
  for (const creature of creatures) {
    if (creature.stage !== 'butterfly') continue
    const note = notes.get(creature.speciesId)
    if (!note) {
      notes.set(creature.speciesId, { first: creature, count: 1 })
      continue
    }
    note.count += 1
    const time = arrivalTime(creature)
    const firstTime = arrivalTime(note.first)
    if (time !== undefined && (firstTime === undefined || time < firstTime)) {
      note.first = creature
    }
  }
  return notes
}

/**
 * Built once, with the Journal that uses it. A day, month and year, as the
 * gardener's locale writes them: "3 March 2026", "March 3, 2026".
 */
const welcomedFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * The local calendar day a creature was welcomed, in words, or undefined when
 * its date is unknown. `discoveredAt` is an instant, so it is read as one and
 * then named by the gardener's own calendar: an egg found late on the 3rd in
 * New York is welcomed on the 3rd, though it is already the 4th in UTC.
 */
export function formatWelcomedOn(
  creature: Pick<CreatureInstance, 'discoveredAt'>,
): string | undefined {
  const time = arrivalTime(creature)
  if (time === undefined) return undefined
  return formatDayInWords(toLocalDate(new Date(time)))
}

/**
 * A local calendar day in the same words as a welcome: "3 March 2026". A
 * companion's story (lib/companionStory) dates the rest of its life this way.
 */
export function formatDayInWords(localDate: string): string {
  return welcomedFormat.format(localDateToNoon(localDate))
}
