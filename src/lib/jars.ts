import { JAR_CAPACITY, JAR_PRICE, jarCharacters, jarColors } from '../data/jars'
import type { AppState, JarColorId, JarInstance } from '../types'
import { createId } from './id'
import { payFor, refuse, type PurchaseResult } from './purchase'

export function normalizeJarCharacter(character: string): string | undefined {
  const normalized = character.trim().toUpperCase()
  return jarCharacters.includes(normalized) ? normalized : undefined
}

export function isJarColorId(colorId: string): colorId is JarColorId {
  return jarColors.some((color) => color.id === colorId)
}

/**
 * Buy a jar, and say how it went: refused when the letter or colour is not
 * one the shop makes, when the shelf is full, or when Nectar falls short.
 */
export function buyJar(
  state: AppState,
  character: string,
  colorId: JarColorId,
  now = new Date(),
): PurchaseResult {
  const normalizedCharacter = normalizeJarCharacter(character)
  if (!normalizedCharacter || !isJarColorId(colorId))
    return refuse(state, { kind: 'unavailable', reason: 'unknown' })
  if (state.jars.length >= JAR_CAPACITY)
    return refuse(state, { kind: 'unavailable', reason: 'full' })
  return payFor(state, { cost: JAR_PRICE, currency: 'nectar' }, () => {
    const jar: JarInstance = {
      id: createId(),
      character: normalizedCharacter,
      colorId,
      purchasedAt: now.toISOString(),
    }
    return { jars: [...state.jars, jar] }
  })
}

/** The garden after buying a jar, for callers that need no outcome. */
export function purchaseJar(
  state: AppState,
  character: string,
  colorId: JarColorId,
  now = new Date(),
): AppState {
  return buyJar(state, character, colorId, now).state
}

export function jarPlacementForPlant(state: AppState, plantId: string) {
  return state.jarPlacements.find((placement) => placement.plantId === plantId)
}

export function jarForPlant(state: AppState, plantId: string) {
  const placement = jarPlacementForPlant(state, plantId)
  return placement
    ? state.jars.find((jar) => jar.id === placement.jarId)
    : undefined
}

export function availableJars(state: AppState): JarInstance[] {
  const placedJarIds = new Set(state.jarPlacements.map((placement) => placement.jarId))
  return state.jars.filter((jar) => !placedJarIds.has(jar.id))
}

export function placeJar(
  state: AppState,
  jarId: string,
  plantId: string,
): AppState {
  if (
    !state.jars.some((jar) => jar.id === jarId) ||
    !state.plants.some((plant) => plant.id === plantId)
  ) {
    return state
  }

  if (
    state.jarPlacements.some(
      (placement) => placement.jarId === jarId && placement.plantId === plantId,
    )
  ) {
    return state
  }

  return {
    ...state,
    jarPlacements: [
      ...state.jarPlacements.filter(
        (placement) => placement.jarId !== jarId && placement.plantId !== plantId,
      ),
      { jarId, plantId },
    ],
  }
}

export function removeJarPlacement(state: AppState, plantId: string): AppState {
  if (!state.jarPlacements.some((placement) => placement.plantId === plantId)) {
    return state
  }
  return {
    ...state,
    jarPlacements: state.jarPlacements.filter(
      (placement) => placement.plantId !== plantId,
    ),
  }
}

/** What recycling a jar gives back: half its price, rounded down. */
export const JAR_RECYCLE_NECTAR = Math.floor(JAR_PRICE / 2)

/** A jar just recycled, and what Undo needs to put it back as it was. */
export interface RecycledJar {
  jar: JarInstance
  /** Where it stood on the shelf, so Undo puts it back in the same place. */
  index: number
  /** The Nectar it brought, which Undo takes back. */
  nectar: number
}

/**
 * What became of recycling a jar: done, or refused because it sits on a
 * plant (it comes off first, so nothing in the scene vanishes unasked), or
 * because it is no longer on the shelf (recycled already, in another tab).
 */
export type RecycleOutcome =
  | { kind: 'recycled'; recycled: RecycledJar }
  | { kind: 'placed' }
  | { kind: 'missing' }

/** Recycle a jar that is not on a plant, for JAR_RECYCLE_NECTAR. */
export function recycleJar(
  state: AppState,
  jarId: string,
): { state: AppState; outcome: RecycleOutcome } {
  const index = state.jars.findIndex((jar) => jar.id === jarId)
  if (index < 0) return { state, outcome: { kind: 'missing' } }
  if (state.jarPlacements.some((placement) => placement.jarId === jarId))
    return { state, outcome: { kind: 'placed' } }
  const recycled = { jar: state.jars[index], index, nectar: JAR_RECYCLE_NECTAR }
  return {
    state: {
      ...state,
      nectar: state.nectar + recycled.nectar,
      jars: state.jars.filter((jar) => jar.id !== jarId),
    },
    outcome: { kind: 'recycled', recycled },
  }
}

/**
 * What became of Undo after a recycle. It is refused rather than made to
 * fit: when the Nectar has been spent since (`spent`, saying how much is
 * missing), when the shelf has filled again (`full`), or when the jar is
 * already back (`back`, a second Undo or another tab's).
 */
export type JarRestoreOutcome =
  | { kind: 'restored' }
  | { kind: 'spent'; needed: number }
  | { kind: 'full' }
  | { kind: 'back' }

/**
 * Undo a recycle: the jar returns where it stood and its Nectar goes back,
 * only if the balance still holds that Nectar. Taking it anyway would leave
 * the balance below zero, or quietly hand back a jar for nothing.
 */
export function restoreRecycledJar(
  state: AppState,
  { jar, index, nectar }: RecycledJar,
): { state: AppState; outcome: JarRestoreOutcome } {
  if (state.jars.some((entry) => entry.id === jar.id))
    return { state, outcome: { kind: 'back' } }
  if (state.nectar < nectar)
    return { state, outcome: { kind: 'spent', needed: nectar - state.nectar } }
  if (state.jars.length >= JAR_CAPACITY) return { state, outcome: { kind: 'full' } }
  const jars = [...state.jars]
  jars.splice(Math.max(0, Math.min(index, jars.length)), 0, jar)
  return {
    state: { ...state, nectar: state.nectar - nectar, jars },
    outcome: { kind: 'restored' },
  }
}
