import { energyLevels, feelings } from '../data/feelings'
import type { CheckInDetails, EnergyLevel } from '../types'

/**
 * The most feeling words one check-in holds.
 *
 * Five is room for a mixed day ("tired, proud, a bit lonely") while choosing
 * stays a matter of naming what is there rather than ticking down a list, and
 * the journal can still say them in one short line on a phone.
 */
export const MAX_FEELINGS = 5

const feelingOrder = new Map(feelings.map((feeling, index) => [feeling.id, index]))
const feelingNames = new Map(feelings.map((feeling) => [feeling.id, feeling.name]))

/**
 * A list of feelings as a check-in stores it: known ids only, each once, in
 * the list's own order, and at most MAX_FEELINGS of them. Undefined when none
 * are left, since an empty list is never stored.
 *
 * The one definition of a clean list, used when a check-in is saved and when
 * a stored or imported garden is read, so the two can never disagree.
 */
export function cleanFeelings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const known = new Set(
    value.filter((id): id is string => typeof id === 'string' && feelingOrder.has(id)),
  )
  const ordered = [...known]
    .sort((a, b) => (feelingOrder.get(a) ?? 0) - (feelingOrder.get(b) ?? 0))
    .slice(0, MAX_FEELINGS)
  return ordered.length > 0 ? ordered : undefined
}

export function isEnergyLevel(value: unknown): value is EnergyLevel {
  return energyLevels.some((level) => level.id === value)
}

/** Just the extras that were answered, so nothing unanswered is stored at all. */
export function checkInDetails(details: CheckInDetails): CheckInDetails {
  const chosen = cleanFeelings(details.feelings)
  return {
    ...(chosen ? { feelings: chosen } : {}),
    ...(isEnergyLevel(details.energy) ? { energy: details.energy } : {}),
  }
}

/**
 * The feelings with one chosen or unchosen.
 *
 * At the limit, choosing another changes nothing and hands back the same
 * list; the chips say why beside them, so it is never a silent refusal.
 */
export function toggleFeeling(chosen: readonly string[], id: string): readonly string[] {
  if (chosen.includes(id)) return chosen.filter((item) => item !== id)
  if (chosen.length >= MAX_FEELINGS || !feelingOrder.has(id)) return chosen
  return cleanFeelings([...chosen, id]) ?? chosen
}

/** The words for stored feelings, in their stored order; unknown ids are skipped. */
export function feelingNamesOf(feelingIds: readonly string[] | undefined): string[] {
  return (feelingIds ?? [])
    .map((id) => feelingNames.get(id))
    .filter((name): name is string => name !== undefined)
}

/** The word for a stored energy, or undefined when it was not answered. */
export function energyNameOf(energy: EnergyLevel | undefined): string | undefined {
  return energyLevels.find((level) => level.id === energy)?.name
}

/**
 * A check-in's extras in plain words: "Feeling tired, hopeful · Energy low".
 * Empty when neither was answered. The words keep the list's own order, so
 * nothing reads as ranked first or last.
 */
export function describeCheckInDetails(details: CheckInDetails): string {
  const parts: string[] = []
  const named = feelingNamesOf(details.feelings)
  if (named.length > 0) parts.push(`Feeling ${named.join(', ')}`)
  const energy = energyNameOf(details.energy)
  if (energy) parts.push(`Energy ${energy}`)
  return parts.join(' · ')
}

/** Feelings kept as a draft: their ids in one line, as `useDraft` keeps text. */
export function feelingsToDraft(chosen: readonly string[]): string {
  return chosen.join(',')
}

/** A draft back into feelings, cleaned like anything stored. */
export function feelingsFromDraft(draft: string): string[] {
  return cleanFeelings(draft.split(',')) ?? []
}
