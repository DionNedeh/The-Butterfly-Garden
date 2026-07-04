import { getCareAction } from '../data/careActions'
import type { AppState, CreatureInstance, CreatureStage } from '../types'
import { toLocalDate } from './date'

export const STAGE_ORDER: CreatureStage[] = [
  'egg',
  'caterpillar',
  'chrysalis',
  'butterfly',
]

/** Distinct care days required to advance out of each pre-butterfly stage. */
export const STAGE_CARE_DAYS = 3

/** Bond points per level; every level rewards Stardust and Nectar. */
export const BOND_PER_LEVEL = 10
export const BOND_LEVEL_STARDUST = 1
export const BOND_LEVEL_NECTAR = 3

export const HATCH_NECTAR_REWARD = 2
export const PUPATE_NECTAR_REWARD = 3
export const EMERGENCE_NECTAR_REWARD = 5
export const EMERGENCE_STARDUST_REWARD = 1
export const EMERGENCE_SEED_REWARD = 2

export const stageLabels: Record<CreatureStage, string> = {
  egg: 'Egg',
  caterpillar: 'Caterpillar',
  chrysalis: 'Chrysalis',
  butterfly: 'Butterfly',
}

export function nextStage(stage: CreatureStage): CreatureStage | undefined {
  const index = STAGE_ORDER.indexOf(stage)
  return index >= 0 ? STAGE_ORDER[index + 1] : undefined
}

export function careDatesForStage(
  creature: CreatureInstance,
  stage: CreatureStage = creature.stage,
): string[] {
  return creature.careDates[stage] ?? []
}

export function careDaysCompleted(creature: CreatureInstance): number {
  return careDatesForStage(creature).length
}

export function hasCaredToday(
  creature: CreatureInstance,
  localDate = toLocalDate(),
): boolean {
  return careDatesForStage(creature).includes(localDate)
}

export function actionDoneToday(
  creature: CreatureInstance,
  actionId: string,
  localDate = toLocalDate(),
): boolean {
  return creature.actionLog[actionId] === localDate
}

export function bondLevel(bond: number): number {
  return Math.floor(bond / BOND_PER_LEVEL) + 1
}

export function bondProgress(bond: number): number {
  return bond % BOND_PER_LEVEL
}

/**
 * Whether the creature is ready to advance: three distinct care days logged
 * in the current stage. Butterflies are the final stage and never advance.
 */
export function readyToAdvance(creature: CreatureInstance): boolean {
  if (creature.stage === 'butterfly') return false
  return careDaysCompleted(creature) >= STAGE_CARE_DAYS
}

function advanceCreature(
  creature: CreatureInstance,
  now: Date,
): CreatureInstance {
  const stage = nextStage(creature.stage)
  if (!stage) return creature
  return {
    ...creature,
    stage,
    chrysalisStartedAt:
      stage === 'chrysalis' ? now.toISOString() : creature.chrysalisStartedAt,
    emergedAt: stage === 'butterfly' ? now.toISOString() : creature.emergedAt,
    emergeAt: undefined,
  }
}

export interface CareResult {
  state: AppState
  performed: boolean
  advancedTo?: CreatureStage
  bondLevelsGained: number
}

/**
 * Perform one care action on a creature.
 *
 * Rules:
 * - The action must belong to the creature's current stage.
 * - Each action can be used once per creature per local day.
 * - Supply-based actions consume one item from the inventory.
 * - Any action marks today as a care day for the current stage; three
 *   distinct care days (they need not be consecutive) advance the stage.
 * - Bond accumulates forever; each bond level grants Stardust and Nectar.
 */
export function performCare(
  inputState: AppState,
  creatureId: string,
  actionId: string,
  now = new Date(),
): CareResult {
  const noop: CareResult = {
    state: inputState,
    performed: false,
    bondLevelsGained: 0,
  }
  const creature = inputState.creatures.find((item) => item.id === creatureId)
  const action = getCareAction(actionId)
  if (!creature || !action) return noop
  if (action.stage !== creature.stage) return noop

  const localDate = toLocalDate(now)
  if (actionDoneToday(creature, actionId, localDate)) return noop

  let inventory = inputState.inventory
  if (action.requiresItemId) {
    const count = inventory[action.requiresItemId] ?? 0
    if (count < 1) return noop
    inventory = { ...inventory, [action.requiresItemId]: count - 1 }
  }

  const stageDates = careDatesForStage(creature)
  const newCareDay = !stageDates.includes(localDate)
  const careDates = newCareDay
    ? { ...creature.careDates, [creature.stage]: [...stageDates, localDate] }
    : creature.careDates

  const previousLevel = bondLevel(creature.bond)
  const bond = creature.bond + action.bond
  const bondLevelsGained = bondLevel(bond) - previousLevel

  let updated: CreatureInstance = {
    ...creature,
    careDates,
    actionLog: { ...creature.actionLog, [actionId]: localDate },
    bond,
  }

  let advancedTo: CreatureStage | undefined
  if (readyToAdvance(updated)) {
    const previousStage = updated.stage
    updated = advanceCreature(updated, now)
    if (updated.stage !== previousStage) advancedTo = updated.stage
  }

  let nectar = inputState.nectar
  let stardust = inputState.stardust
  let seeds = inputState.seeds
  if (bondLevelsGained > 0) {
    stardust += bondLevelsGained * BOND_LEVEL_STARDUST
    nectar += bondLevelsGained * BOND_LEVEL_NECTAR
  }
  if (advancedTo === 'caterpillar') nectar += HATCH_NECTAR_REWARD
  if (advancedTo === 'chrysalis') nectar += PUPATE_NECTAR_REWARD
  if (advancedTo === 'butterfly') {
    nectar += EMERGENCE_NECTAR_REWARD
    stardust += EMERGENCE_STARDUST_REWARD
    seeds += EMERGENCE_SEED_REWARD
  }

  const creatures = inputState.creatures.map((item) =>
    item.id === creatureId ? updated : item,
  )

  const profile =
    advancedTo === 'butterfly' &&
    inputState.profile &&
    !inputState.profile.activeCompanionId
      ? { ...inputState.profile, activeCompanionId: updated.id }
      : inputState.profile

  return {
    state: {
      ...inputState,
      creatures,
      inventory,
      nectar,
      stardust,
      seeds,
      profile,
    },
    performed: true,
    advancedTo,
    bondLevelsGained,
  }
}
