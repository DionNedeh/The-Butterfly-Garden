/**
 * When a companion's bond shares each of its species' three facts
 * (data/speciesFacts): the first from the start, as it always has been, the
 * second at bond level 3 and the third at level 5.
 *
 * A level is ten bond points and a day of care gives one to eight, so a
 * companion visited a little each day shares its second fact after a week or
 * two and its third a few weeks after that. Facts that deepen with care
 * reward a long friendship without making the first days feel bare, and
 * they cost nothing: bond is never spent, and nothing here changes what care
 * earns.
 */
export const FACT_BOND_LEVELS: readonly number[] = [1, 3, 5]

/** How many of a species' facts a bond level has shared. */
export function factsShared(level: number): number {
  return FACT_BOND_LEVELS.filter((needed) => level >= needed).length
}

/** The bond level that shares the next fact, or undefined once all are shared. */
export function nextFactLevel(level: number): number | undefined {
  return FACT_BOND_LEVELS.find((needed) => level < needed)
}
