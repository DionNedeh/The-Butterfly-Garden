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
