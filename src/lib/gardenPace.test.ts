import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState, CreatureInstance, PlantInstance, Profile } from '../types'
import { addDaysToLocalDate, localDateToNoon } from './date'
import { setGardenPace } from './gardenActions'
import { describeEvent, gardenEvents } from './gardenEvents'
import { careDaysCounted, keepsGiving, REBLOOM_CARE_DAYS } from './gardenPace'
import { performCare } from './lifecycle'
import { plantBloomNote, plantEggNote, removePlant } from './plantManagement'
import {
  awardSunlight,
  createEmptyState,
  MAX_PLANT_GROWTH,
  NECTAR_PER_SUNLIGHT,
  plantSeed,
} from './progression'

/** Ids in the order they are made, so two runs can be compared exactly. */
function countIds() {
  let next = 0
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${(next += 1)}`) })
}

beforeEach(countIds)

const PLANTED = '2026-03-01T12:00:00.000Z'

/**
 * A garden a long-time gardener might have: hosts in bloom and growing, a
 * nectar plant, a companion still growing, room for none.
 */
function longKeptGarden(profile: Partial<Profile> = {}): AppState {
  const plant = (id: string, plantId: string, growth: number) => ({
    id,
    plantId,
    growth,
    plantedAt: PLANTED,
  })
  return {
    ...createEmptyState(),
    profile: {
      id: 'profile',
      name: 'Gardener',
      gardenName: 'Long Kept',
      createdAt: PLANTED,
      reducedMotion: false,
      ...profile,
    },
    plants: [
      plant('milkweed-1', 'milkweed', 3),
      plant('parsley-1', 'parsley', 3),
      plant('milkweed-2', 'milkweed', 2),
      plant('passion-1', 'passionflower', 1),
      plant('thistle-1', 'thistle', 0),
      plant('willow-1', 'willow', 3),
      plant('aster-1', 'aster', 3),
      plant('violet-1', 'violet', 2),
    ],
    creatures: [
      {
        id: 'starter',
        speciesId: 'monarch',
        name: 'Sol',
        stage: 'caterpillar',
        careDates: {},
        actionLog: {},
        bond: 0,
        outfit: {},
        carePoints: 0,
        discoveredAt: PLANTED,
        sourcePlantId: 'milkweed-1',
      },
    ],
    seeds: 1,
    inventory: { 'leaf-bundle': 3 },
  }
}

/** Free care, one action a stage, so a companion moves on every third day. */
const FREE_CARE = {
  egg: 'egg-warm',
  caterpillar: 'cat-play',
  chrysalis: 'chr-sun',
  butterfly: 'but-groom',
} as const

/**
 * Six weeks of an ordinary rhythm: most days a check-in, a reflection and a
 * goal; every companion still growing cared for; a quiet day now and then;
 * one plant moved over and a seed planted in its place.
 */
function sixWeeks(start: AppState): AppState {
  let state = start
  const firstDay = '2026-03-02'
  for (let day = 0; day < 42; day += 1) {
    const date = addDaysToLocalDate(firstDay, day)
    // A rest day every so often, which must cost nothing.
    if (day % 9 === 4) continue
    const noon = localDateToNoon(date)
    for (const source of ['mood', 'reflection', 'goal:walk']) {
      state = awardSunlight(state, `${source}:${date}`, noon)
    }
    for (const creature of state.creatures) {
      if (creature.stage === 'butterfly') continue
      state = performCare(state, creature.id, FREE_CARE[creature.stage], noon).state
    }
    if (day === 20) {
      state = removePlant(state, 'aster-1')
      state = plantSeed(state, 'dogwood', noon)
    }
  }
  return state
}

/** FNV-1a over the text: a short, exact fingerprint of a long garden. */
function fingerprint(value: unknown): string {
  let hash = 2166136261
  for (const char of JSON.stringify(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * What the plant and egg economy decides: every plant, every arrival and
 * how far it has come, and the balances. Other fields a creature carries
 * (care history, bond) belong to the Care page, not to the garden's pace.
 */
function economy(state: AppState) {
  return {
    plants: state.plants,
    creatures: state.creatures.map((creature) => ({
      id: creature.id,
      speciesId: creature.speciesId,
      name: creature.name,
      stage: creature.stage,
      sourcePlantId: creature.sourcePlantId,
      awaitingName: creature.awaitingName,
      discoveredAt: creature.discoveredAt,
    })),
    sunlight: state.sunlight,
    seeds: state.seeds,
    nectar: state.nectar,
    stardust: state.stardust,
  }
}

describe('Classic, the garden pace every garden has always had', () => {
  it('is the same, byte for byte, as before there was a choice', () => {
    const after = sixWeeks(longKeptGarden())
    // Recorded from the build before Garden pace existed. If this changes,
    // Classic changed, which this choice promised it never would.
    expect(fingerprint(economy(after))).toBe('16cfd20d')
    // One egg a host plant, when it first bloomed; the three already in
    // bloom brought nothing more in six weeks.
    expect(after.creatures.map((creature) => creature.speciesId)).toEqual([
      'monarch',
      'queen',
      'gulf-fritillary',
      'painted-lady',
      'great-spangled-fritillary',
      'spring-azure',
    ])
    expect(JSON.stringify(after.plants)).not.toContain('careDaysSinceBloom')
  })

  it('runs the same six weeks differently only once Keep giving is chosen', () => {
    const classic = sixWeeks(longKeptGarden())
    countIds()
    const chosenThenUnchosen = sixWeeks(
      setGardenPace(longKeptGarden({ gardenPace: 'keep-giving' }), undefined),
    )
    expect(chosenThenUnchosen).toEqual(classic)
    countIds()
    const keepGiving = sixWeeks(longKeptGarden({ gardenPace: 'keep-giving' }))
    // Everything Classic brought, and more, never fewer.
    const species = keepGiving.creatures.map((creature) => creature.speciesId)
    for (const arrival of classic.creatures) expect(species).toContain(arrival.speciesId)
    expect(keepGiving.creatures.length).toBeGreaterThan(classic.creatures.length)
    // Sunlight, Nectar and seeds are earned exactly as before.
    expect(keepGiving.sunlight.length).toBe(classic.sunlight.length)
    expect(keepGiving.seeds - classic.seeds).toBe(
      2 * (keepGiving.creatures.filter((c) => c.stage === 'butterfly').length -
        classic.creatures.filter((c) => c.stage === 'butterfly').length),
    )
  })
})

const NOON = (date: string) => localDateToNoon(date)

function host(id: string, plantId = 'milkweed', extra: Partial<PlantInstance> = {}): PlantInstance {
  return { id, plantId, growth: MAX_PLANT_GROWTH, plantedAt: PLANTED, ...extra }
}

function companion(id: string, speciesId: string, stage: CreatureInstance['stage']): CreatureInstance {
  return {
    id,
    speciesId,
    name: id,
    stage,
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: PLANTED,
  }
}

/** A garden keeping giving, with these plants and companions. */
function keeping(plants: PlantInstance[], creatures: CreatureInstance[] = []): AppState {
  return { ...longKeptGarden({ gardenPace: 'keep-giving' }), plants, creatures }
}

/** One Sunlight on each of `days` days from 2026-04-01, two on the first. */
function careFor(state: AppState, days: number, from = '2026-04-01'): AppState {
  let garden = state
  for (let day = 0; day < days; day += 1) {
    const date = addDaysToLocalDate(from, day)
    garden = awardSunlight(garden, `mood:${date}`, NOON(date))
    if (day === 0) garden = awardSunlight(garden, `goal:extra:${date}`, NOON(date))
  }
  return garden
}

describe('Keep giving', () => {
  it('counts days of care, not Sunlight, and blooms again with an egg', () => {
    const butterflies = [companion('Sol', 'monarch', 'butterfly'), companion('Q', 'queen', 'butterfly')]
    const start = keeping([host('m1')], butterflies)
    const sixDays = careFor(start, REBLOOM_CARE_DAYS - 1)
    // Two Sunlight on the first day still made one day of care.
    expect(sixDays.plants[0].careDaysSinceBloom).toBe(REBLOOM_CARE_DAYS - 1)
    expect(sixDays.creatures).toHaveLength(2)

    const seventh = careFor(sixDays, 1, '2026-04-07')
    const egg = seventh.creatures.at(-1)!
    expect(seventh.creatures).toHaveLength(3)
    expect(egg).toMatchObject({
      speciesId: 'monarch',
      stage: 'egg',
      sourcePlantId: 'm1',
      // The same offer to name it as any egg a first bloom brings.
      awaitingName: true,
    })
    expect(['Sol', 'Q']).not.toContain(egg.name)
    // The count starts again, as it began: with nothing stored.
    expect(seventh.plants[0]).not.toHaveProperty('careDaysSinceBloom')
    // Sunlight earns what it always has: a bloom adds nothing to it.
    expect(seventh.nectar - sixDays.nectar).toBe(2 * NECTAR_PER_SUNLIGHT)
  })

  it('celebrates the bloom and the egg, as a first bloom is', () => {
    const before = keeping(
      [host('m1', 'milkweed', { careDaysSinceBloom: REBLOOM_CARE_DAYS - 1 })],
      [companion('Sol', 'monarch', 'butterfly')],
    )
    const after = careFor(before, 1)
    const events = gardenEvents(before, after)
    expect(events.map((event) => event.kind)).toEqual(['plant-bloomed', 'egg-found'])
    expect(events.map(describeEvent)).toEqual([
      'Your milkweed bloomed again.',
      expect.stringMatching(/^A tiny egg appeared on your milkweed: a queen, named /),
    ])
  })

  it('starts counting the day after a plant first blooms', () => {
    const start = keeping([{ ...host('m1'), growth: MAX_PLANT_GROWTH - 1 }], [
      companion('Sol', 'monarch', 'caterpillar'),
    ])
    const bloomed = careFor(start, 1)
    expect(bloomed.plants[0].growth).toBe(MAX_PLANT_GROWTH)
    expect(bloomed.plants[0]).not.toHaveProperty('careDaysSinceBloom')
    expect(bloomed.creatures.map((creature) => creature.speciesId)).toEqual(['monarch', 'queen'])
    expect(careFor(bloomed, 1, '2026-04-02').plants[0].careDaysSinceBloom).toBe(1)
  })

  it('waits, ready, while every butterfly it hosts is growing up here', () => {
    const growing = [companion('Sol', 'monarch', 'chrysalis'), companion('Q', 'queen', 'egg')]
    const ready = careFor(keeping([host('m1')], growing), REBLOOM_CARE_DAYS + 3)
    expect(ready.creatures).toHaveLength(2)
    expect(ready.plants[0].careDaysSinceBloom).toBe(REBLOOM_CARE_DAYS)
    expect(plantBloomNote(ready, ready.plants[0], MAX_PLANT_GROWTH)).toBe(
      'Ready to bloom again once a butterfly it hosts has emerged.',
    )

    // Sol emerges; the very next Sunlight, not only a new day's, opens it.
    const emerged = {
      ...ready,
      creatures: [{ ...ready.creatures[0], stage: 'butterfly' as const }, ready.creatures[1]],
    }
    expect(plantBloomNote(emerged, emerged.plants[0], MAX_PLANT_GROWTH)).toBe(
      'Ready to bloom again with your next Sunlight.',
    )
    const lastDay = addDaysToLocalDate('2026-04-01', REBLOOM_CARE_DAYS + 2)
    const opened = awardSunlight(emerged, `goal:later:${lastDay}`, NOON(lastDay))
    expect(opened.creatures.at(-1)).toMatchObject({ speciesId: 'monarch', stage: 'egg' })
    expect(opened.plants[0]).not.toHaveProperty('careDaysSinceBloom')
  })

  it('gives each plant blooming at once its own butterfly, never one it cannot receive', () => {
    const both = [
      host('m1', 'milkweed', { careDaysSinceBloom: REBLOOM_CARE_DAYS - 1 }),
      host('m2', 'milkweed', { careDaysSinceBloom: REBLOOM_CARE_DAYS - 1 }),
      host('m3', 'milkweed', { careDaysSinceBloom: REBLOOM_CARE_DAYS - 1 }),
    ]
    const after = careFor(
      keeping(both, [companion('Sol', 'monarch', 'butterfly'), companion('Q', 'queen', 'butterfly')]),
      1,
    )
    const arrivals = after.creatures.slice(2)
    expect(arrivals.map((creature) => [creature.sourcePlantId, creature.speciesId])).toEqual([
      ['m1', 'monarch'],
      ['m2', 'queen'],
    ])
    expect(new Set(after.creatures.map((creature) => creature.name)).size).toBe(4)
    // The third has no butterfly left to bring, so it waits.
    expect(after.plants[2].careDaysSinceBloom).toBe(REBLOOM_CARE_DAYS)
  })

  it('tends only host plants in full bloom', () => {
    const plants = [
      host('aster', 'aster'),
      { ...host('late'), growth: MAX_PLANT_GROWTH - 1 },
      host('m1'),
    ]
    const firstDay = careFor(keeping(plants, [companion('Sol', 'monarch', 'butterfly')]), 1)
    // The day's first Sunlight opened the late milkweed's first bloom, and
    // tended the one already in bloom; the aster never blooms again.
    expect(firstDay.plants[0]).toBe(plants[0])
    expect(firstDay.plants[1]).not.toHaveProperty('careDaysSinceBloom')
    expect(firstDay.plants[2].careDaysSinceBloom).toBe(1)
    const secondDay = careFor(firstDay, 1, '2026-04-02')
    expect(secondDay.plants[0]).toBe(plants[0])
    expect(secondDay.plants.slice(1).map(careDaysCounted)).toEqual([1, 2])
  })

  it('hands back the same plants when a Sunlight changes none of them', () => {
    const counted = careFor(keeping([host('m1')], [companion('Sol', 'monarch', 'butterfly')]), 1)
    const again = awardSunlight(counted, 'reflection:2026-04-01', NOON('2026-04-01'))
    expect(again.sunlight).toHaveLength(counted.sunlight.length + 1)
    expect(again.plants).toBe(counted.plants)
    expect(again.creatures).toBe(counted.creatures)
  })

  it('pauses under Classic and loses no day of care coming back', () => {
    const counted = careFor(keeping([host('m1')], [companion('Sol', 'monarch', 'butterfly')]), 3)
    const classic = setGardenPace(counted, undefined)
    expect(classic.profile).not.toHaveProperty('gardenPace')
    const paused = careFor(classic, 10, '2026-04-10')
    expect(paused.plants[0].careDaysSinceBloom).toBe(3)
    expect(paused.creatures).toHaveLength(1)
    const back = setGardenPace(paused, 'keep-giving')
    expect(careDaysCounted(back.plants[0])).toBe(3)
    expect(careFor(back, 1, '2026-04-30').plants[0].careDaysSinceBloom).toBe(4)
  })
})

describe('choosing a pace', () => {
  it('stores Keep giving, and nothing at all for Classic', () => {
    const classic = longKeptGarden()
    expect(keepsGiving(classic.profile)).toBe(false)
    expect(setGardenPace(classic, undefined)).toBe(classic)
    const keeping = setGardenPace(classic, 'keep-giving')
    expect(keeping.profile?.gardenPace).toBe('keep-giving')
    expect(keepsGiving(keeping.profile)).toBe(true)
    expect(setGardenPace(keeping, 'keep-giving')).toBe(keeping)
    expect(setGardenPace(keeping, undefined).profile).toEqual(classic.profile)
    // A garden still being made has no pace to set.
    const empty = createEmptyState()
    expect(setGardenPace(empty, 'keep-giving')).toBe(empty)
  })
})

describe("the plant's panel", () => {
  const sol = companion('Sol', 'monarch', 'butterfly')

  it('says how close the next bloom is, only under Keep giving', () => {
    const plant = host('m1', 'milkweed', { careDaysSinceBloom: 4 })
    expect(plantBloomNote(longKeptGarden(), plant, MAX_PLANT_GROWTH)).toBeUndefined()
    const garden = keeping([plant], [sol])
    expect(plantBloomNote(garden, plant, MAX_PLANT_GROWTH)).toBe(
      'Blooms again in 3 more days of care.',
    )
    expect(
      plantBloomNote(garden, { ...plant, careDaysSinceBloom: 6 }, MAX_PLANT_GROWTH),
    ).toBe('Blooms again in 1 more day of care.')
    expect(plantBloomNote(garden, host('fresh'), MAX_PLANT_GROWTH)).toBe(
      `Blooms again in ${REBLOOM_CARE_DAYS} more days of care.`,
    )
    // Not in bloom yet, or never a host: nothing to say about blooming again.
    expect(plantBloomNote(garden, { ...plant, growth: 2 }, MAX_PLANT_GROWTH)).toBeUndefined()
    expect(plantBloomNote(garden, host('a', 'aster'), MAX_PLANT_GROWTH)).toBeUndefined()
  })

  it('speaks of the latest bloom, and never asks for another plant', () => {
    const plant = host('m1')
    const twice = keeping(
      [plant],
      [sol, { ...companion('Juniper', 'queen', 'butterfly'), sourcePlantId: 'm1' }, {
        ...companion('Clover', 'monarch', 'egg'),
        sourcePlantId: 'm1',
      }],
    )
    expect(plantEggNote(twice, plant, MAX_PLANT_GROWTH)).toBe("Its latest bloom brought Clover's egg.")

    const growing = [companion('Sol', 'monarch', 'caterpillar'), companion('Q', 'queen', 'egg')]
    const noEgg = { ...keeping([plant], growing), creatures: [growing[0], { ...growing[1], sourcePlantId: 'other' }] }
    expect(plantEggNote(noEgg, plant, MAX_PLANT_GROWTH)).toBe(
      'It bloomed while every butterfly it hosts was growing up here, so it brought no egg.',
    )
    expect(plantEggNote({ ...noEgg, profile: longKeptGarden().profile }, plant, MAX_PLANT_GROWTH)).toMatch(
      /Plant another Milkweed/,
    )
  })
})
