import { getCareAction } from '../data/careActions'
import type { AppState, CreatureInstance, CreatureStage } from '../types'
import { countCare, diaryBegun, goalDayNoted, noteGoalDay } from './companionDiary'
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

/** What the next bond level asks for, and what it brings. */
export interface BondMilestone {
  level: number
  /** Bond still to earn: each act of care gives its own, one or two. */
  bondToGo: number
  stardust: number
  nectar: number
}

/**
 * The next bond level from here, read from the same constants performCare
 * pays out by, so what Care promises is always what a level gives.
 */
export function nextBondMilestone(bond: number): BondMilestone {
  return {
    level: bondLevel(bond) + 1,
    bondToGo: BOND_PER_LEVEL - bondProgress(bond),
    stardust: BOND_LEVEL_STARDUST,
    nectar: BOND_LEVEL_NECTAR,
  }
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
  const advanced: CreatureInstance = {
    ...creature,
    stage,
    // Recorded from now on. A companion that hatched before has none, and
    // its story reads the day from its last egg care (lib/companionStory).
    ...(stage === 'caterpillar' ? { hatchedAt: now.toISOString() } : {}),
    chrysalisStartedAt:
      stage === 'chrysalis' ? now.toISOString() : creature.chrysalisStartedAt,
    emergedAt: stage === 'butterfly' ? now.toISOString() : creature.emergedAt,
    emergeAt: undefined,
  }
  // Grown: a goal has no stage left to count toward, so the butterfly is let
  // go of it, and its diary (`grownAlongside`) keeps the story.
  if (stage === 'butterfly') delete advanced.adoptedGoalId
  return advanced
}

/**
 * A day of care for the companion's current stage, counted once however
 * often it comes, and the stage it moves on to when that day was the last
 * the stage needed. The one rule for a day of care, from the menu or a goal.
 */
function careDay(
  creature: CreatureInstance,
  localDate: string,
  now: Date,
): { creature: CreatureInstance; advancedTo?: CreatureStage } {
  const stageDates = careDatesForStage(creature)
  const cared = stageDates.includes(localDate)
    ? creature
    : {
        ...creature,
        careDates: { ...creature.careDates, [creature.stage]: [...stageDates, localDate] },
      }
  if (!readyToAdvance(cared)) return { creature: cared }
  const advanced = advanceCreature(cared, now)
  return {
    creature: advanced,
    advancedTo: advanced.stage !== cared.stage ? advanced.stage : undefined,
  }
}

/**
 * What reaching a stage brings: Nectar for hatching and for the chrysalis,
 * and for emerging Nectar, Stardust and seeds, and the garden's companion if
 * it had none yet. The same however the stage was reached, from the care
 * menu or a goal; each companion reaches each stage once.
 */
function reachedStage(
  state: AppState,
  creatureId: string,
  stage: CreatureStage | undefined,
): AppState {
  if (stage === 'caterpillar') return { ...state, nectar: state.nectar + HATCH_NECTAR_REWARD }
  if (stage === 'chrysalis') return { ...state, nectar: state.nectar + PUPATE_NECTAR_REWARD }
  if (stage !== 'butterfly') return state
  return {
    ...state,
    nectar: state.nectar + EMERGENCE_NECTAR_REWARD,
    stardust: state.stardust + EMERGENCE_STARDUST_REWARD,
    seeds: state.seeds + EMERGENCE_SEED_REWARD,
    profile:
      state.profile && !state.profile.activeCompanionId
        ? { ...state.profile, activeCompanionId: creatureId }
        : state.profile,
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
 *   Completing a goal the companion is grown alongside gives the same day
 *   by the same rule (careFromGoal), and a day given both ways counts once.
 * - Bond accumulates forever; each bond level grants Stardust and Nectar.
 * - The companion's diary counts the action (lib/companionDiary). Nothing
 *   above reads that count, so it can never change what care earns.
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

  const previousLevel = bondLevel(creature.bond)
  const bond = creature.bond + action.bond
  const bondLevelsGained = bondLevel(bond) - previousLevel

  const day = careDay(creature, localDate, now)
  const advancedTo = day.advancedTo
  const updated: CreatureInstance = {
    ...day.creature,
    actionLog: { ...creature.actionLog, [actionId]: localDate },
    bond,
    careCounts: countCare(creature.careCounts, actionId),
  }

  let nectar = inputState.nectar
  let stardust = inputState.stardust
  if (bondLevelsGained > 0) {
    stardust += bondLevelsGained * BOND_LEVEL_STARDUST
    nectar += bondLevelsGained * BOND_LEVEL_NECTAR
  }

  const creatures = inputState.creatures.map((item) =>
    item.id === creatureId ? updated : item,
  )
  const cared = reachedStage(
    { ...inputState, creatures, inventory, nectar, stardust },
    updated.id,
    advancedTo,
  )

  return {
    state: { ...cared, profile: diaryBegun(cared.profile, now) },
    performed: true,
    advancedTo,
    bondLevelsGained,
  }
}

/**
 * A day of care from a goal (plan c.3). Completing the goal a companion is
 * grown alongside counts as a day of care for its current stage, exactly as
 * an act of care from the menu would: the day joins the stage's care days,
 * and the last one the stage needs moves it on, with what the new stage
 * brings and the same celebration, since lib/gardenEvents finds a change of
 * stage whatever made it.
 *
 * - It gives no bond. Bond is earned with the companion itself, an act of
 *   care at a time, and every bond level pays Stardust and Nectar, so a goal
 *   that gave bond would pay twice for one walk outside, which has earned
 *   its Sunlight already. What a stage brings comes with the stage however
 *   it was reached; each companion reaches each stage once, so nothing can
 *   be earned that could not be before. It may only come sooner.
 * - Once a day. A day already cared for from the menu is not counted again,
 *   since care days are distinct dates, and the diary notes each day a goal
 *   counted (`grownAlongside`), so completing the goal again that day after
 *   an Undo counts nothing more, even once the day has moved the companion
 *   on to its next stage.
 * - Never for a butterfly, which has no stage left to grow, and never for an
 *   archived goal, which has let its companions go.
 *
 * The same garden when no growing companion is grown alongside the goal.
 */
export function careFromGoal(state: AppState, goalId: string, now = new Date()): AppState {
  const goal = state.goals.find((item) => item.id === goalId)
  if (!goal || goal.archived) return state
  const localDate = toLocalDate(now)
  let cared = state
  for (const creature of state.creatures) {
    if (
      creature.adoptedGoalId !== goalId ||
      creature.stage === 'butterfly' ||
      goalDayNoted(creature.grownAlongside, localDate)
    ) {
      continue
    }
    const day = careDay(creature, localDate, now)
    const updated: CreatureInstance = {
      ...day.creature,
      grownAlongside: noteGoalDay(creature.grownAlongside, goal, localDate),
    }
    const moved = reachedStage(
      {
        ...cared,
        creatures: cared.creatures.map((item) => (item.id === creature.id ? updated : item)),
      },
      updated.id,
      day.advancedTo,
    )
    cared = { ...moved, profile: diaryBegun(moved.profile, now) }
  }
  return cared
}

/**
 * Grow a companion alongside one of the gardener's goals, or alongside none
 * again (undefined). Only while it grows, and only with a goal that is still
 * in use: an archived one has been set aside. The same garden when nothing
 * changes.
 */
export function adoptGoal(
  state: AppState,
  creatureId: string,
  goalId: string | undefined,
): AppState {
  const index = state.creatures.findIndex((creature) => creature.id === creatureId)
  const creature = index === -1 ? undefined : state.creatures[index]
  if (!creature || creature.adoptedGoalId === goalId) return state
  if (
    goalId !== undefined &&
    (creature.stage === 'butterfly' ||
      !state.goals.some((goal) => goal.id === goalId && !goal.archived))
  ) {
    return state
  }
  const adopted = { ...creature }
  if (goalId === undefined) delete adopted.adoptedGoalId
  else adopted.adoptedGoalId = goalId
  const creatures = [...state.creatures]
  creatures[index] = adopted
  return { ...state, creatures }
}

/**
 * Let go of every companion grown alongside this goal, as archiving or
 * deleting the goal does. Nothing is lost: each goes back to the care menu
 * alone, and the days the goal gave stay in its care days and its diary.
 * The same garden when no companion was grown alongside it.
 */
export function releaseGoal(state: AppState, goalId: string): AppState {
  if (!state.creatures.some((creature) => creature.adoptedGoalId === goalId)) return state
  return {
    ...state,
    creatures: state.creatures.map((creature) => {
      if (creature.adoptedGoalId !== goalId) return creature
      const released = { ...creature }
      delete released.adoptedGoalId
      return released
    }),
  }
}
