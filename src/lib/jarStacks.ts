import { jarCharacters, jarColors } from '../data/jars'
import type { JarColorId, JarInstance, JarPlacement } from '../types'

/** Jars that look alike: the same character in the same colour. */
export interface JarStack {
  /** The character and colour, unique among stacks. */
  key: string
  character: string
  colorId: JarColorId
  /** Every jar of the kind, in shelf order. */
  jars: JarInstance[]
  /** Those on no plant, in shelf order: what placing or recycling takes from. */
  loose: JarInstance[]
}

/** What alike jars share, and so what names their stack. */
export function stackKey(jar: Pick<JarInstance, 'colorId' | 'character'>): string {
  return `${jar.colorId} ${jar.character}`
}

/**
 * The shelf as the gardener sees it, alike jars stacked ("A ×3").
 *
 * Sixty jars bought one at a time for eight plant spots made sixty rows to
 * scroll through. A stack is one row, and acting on it acts on one jar of it.
 * Stacks keep the shop's order, by character and then by colour, so a name
 * spelled across the shelf can be found letter by letter.
 *
 * Kept apart from lib/jars, which the app shell loads: only the shop and a
 * plant's jar panel, both loaded when opened, stack the shelf.
 */
export function stackJars(
  jars: readonly JarInstance[],
  placements: readonly JarPlacement[],
): JarStack[] {
  const placed = new Set(placements.map((placement) => placement.jarId))
  const stacks = new Map<string, JarStack>()
  for (const jar of jars) {
    const key = stackKey(jar)
    let stack = stacks.get(key)
    if (!stack) {
      stack = { key, character: jar.character, colorId: jar.colorId, jars: [], loose: [] }
      stacks.set(key, stack)
    }
    stack.jars.push(jar)
    if (!placed.has(jar.id)) stack.loose.push(jar)
  }
  const rank = (stack: JarStack) =>
    jarCharacters.indexOf(stack.character) * jarColors.length +
    jarColors.findIndex((color) => color.id === stack.colorId)
  return [...stacks.values()].sort((a, b) => rank(a) - rank(b))
}
