import { describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { createEmptyState } from './progression'
import {
  JAR_ACCENTED,
  JAR_CAPACITY,
  JAR_LETTERS,
  JAR_MARK_NAMES,
  JAR_MARKS,
  JAR_NUMBERS,
  JAR_PRICE,
} from '../data/jars'
import {
  availableJars,
  buyJar,
  JAR_RECYCLE_NECTAR,
  jarName,
  jarSpokenName,
  normalizeJarCharacter,
  placeJar,
  purchaseJar,
  recycleJar,
  removeJarPlacement,
  restoreRecycledJar,
} from './jars'

function jarGarden(): AppState {
  return {
    ...createEmptyState(),
    plants: [
      {
        id: 'plant-1',
        plantId: 'milkweed',
        growth: 3,
        plantedAt: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'plant-2',
        plantId: 'aster',
        growth: 3,
        plantedAt: '2026-06-01T12:00:00.000Z',
      },
    ],
    jars: [
      {
        id: 'jar-a',
        character: 'A',
        colorId: 'blue',
        purchasedAt: '2026-06-02T12:00:00.000Z',
      },
      {
        id: 'jar-s',
        character: 'S',
        colorId: 'yellow',
        purchasedAt: '2026-06-02T12:00:00.000Z',
      },
    ],
  }
}

describe('jar shop and placement', () => {
  it('buys reusable jar copies for exactly 6 Nectar', () => {
    const now = new Date('2026-06-03T12:00:00.000Z')
    const state = { ...createEmptyState(), nectar: 12 }
    const first = purchaseJar(state, 's', 'blue', now)
    const second = purchaseJar(first, 'S', 'blue', now)

    expect(first.nectar).toBe(6)
    expect(first.jars).toMatchObject([
      { character: 'S', colorId: 'blue', purchasedAt: now.toISOString() },
    ])
    expect(second.nectar).toBe(0)
    expect(second.jars).toHaveLength(2)
    expect(second.jars[0].id).not.toBe(second.jars[1].id)
  })

  it('rejects insufficient funds, invalid characters, and invalid colors', () => {
    const empty = createEmptyState()
    expect(purchaseJar(empty, 'A', 'blue')).toBe(empty)

    const funded = { ...empty, nectar: 12 }
    expect(purchaseJar(funded, '~', 'blue')).toBe(funded)
    expect(purchaseJar(funded, 'A', 'made-up-color' as 'blue')).toBe(funded)
  })

  it('places, moves, replaces, and removes jars without deleting ownership', () => {
    const state = jarGarden()
    const placed = placeJar(state, 'jar-a', 'plant-1')
    const moved = placeJar(placed, 'jar-a', 'plant-2')
    const replaced = placeJar(moved, 'jar-s', 'plant-2')
    const removed = removeJarPlacement(replaced, 'plant-2')

    expect(placed.jarPlacements).toEqual([
      { jarId: 'jar-a', plantId: 'plant-1' },
    ])
    expect(moved.jarPlacements).toEqual([
      { jarId: 'jar-a', plantId: 'plant-2' },
    ])
    expect(replaced.jarPlacements).toEqual([
      { jarId: 'jar-s', plantId: 'plant-2' },
    ])
    expect(availableJars(replaced).map((jar) => jar.id)).toEqual(['jar-a'])
    expect(removed.jarPlacements).toEqual([])
    expect(removed.jars).toHaveLength(2)
  })

  it('ignores unknown jars and plants', () => {
    const state = jarGarden()
    expect(placeJar(state, 'missing-jar', 'plant-1')).toBe(state)
    expect(placeJar(state, 'jar-a', 'missing-plant')).toBe(state)
    expect(removeJarPlacement(state, 'missing-plant')).toBe(state)
  })
})

describe('naming a jar', () => {
  it('shows a jar by its colour and its character', () => {
    expect(jarName('yellow', 'Ñ')).toBe('Yellow Ñ jar')
    expect(jarName('blue', '!')).toBe('Blue ! jar')
    expect(jarName('tartan', 'A')).toBe('Custom A jar')
  })

  it('says a mark by its name, so no two marks sound alike', () => {
    expect(jarSpokenName('blue', '!')).toBe('Blue exclamation mark jar')
    expect(jarSpokenName('blue', '?')).toBe('Blue question mark jar')
    expect(jarSpokenName('green', '.')).toBe('Green dot jar')
    const said = [...JAR_MARKS].map((mark) => jarSpokenName('blue', mark))
    expect(new Set(said).size).toBe(JAR_MARKS.length)
    // Nothing a screen reader might pass over is left in what it says.
    for (const words of said) expect(words).not.toMatch(/[!?&+.*]/)
    expect(Object.keys(JAR_MARK_NAMES).sort()).toEqual([...JAR_MARKS].sort())
  })

  it('says letters, numbers and accented capitals as they are shown', () => {
    for (const character of [...JAR_LETTERS, ...JAR_NUMBERS, ...JAR_ACCENTED])
      expect(jarSpokenName('pink', character)).toBe(jarName('pink', character))
  })
})

describe('the characters a jar can carry', () => {
  it('sells accented capitals and a few marks, from either case', () => {
    expect(normalizeJarCharacter('é')).toBe('É')
    expect(normalizeJarCharacter(' ñ ')).toBe('Ñ')
    expect(normalizeJarCharacter('ø')).toBe('Ø')
    expect(normalizeJarCharacter('œ')).toBe('Œ')
    for (const mark of '!?&+.*') expect(normalizeJarCharacter(mark)).toBe(mark)
    const bought = buyJar({ ...createEmptyState(), nectar: JAR_PRICE }, 'ç', 'green')
    expect(bought.outcome.kind).toBe('bought')
    expect(bought.state.jars[0].character).toBe('Ç')
  })

  it('still refuses anything else', () => {
    for (const other of ['~', '#', '♥', '★', 'ß', 'Ł', 'AB', '', 'a\u0301'])
      expect(normalizeJarCharacter(other)).toBeUndefined()
  })
})

describe('recycling a jar', () => {
  it('gives back half its price, rounded down', () => {
    expect(JAR_RECYCLE_NECTAR).toBe(Math.floor(JAR_PRICE / 2))
    expect(JAR_RECYCLE_NECTAR).toBe(3)
  })

  it('takes a jar on no plant off the shelf for its Nectar, without touching the old garden', () => {
    const state = { ...jarGarden(), nectar: 4 }
    const before = structuredClone(state)
    const { state: after, outcome } = recycleJar(state, 'jar-a')

    expect(outcome).toEqual({
      kind: 'recycled',
      recycled: { jar: state.jars[0], index: 0, nectar: JAR_RECYCLE_NECTAR },
    })
    expect(after.nectar).toBe(4 + JAR_RECYCLE_NECTAR)
    expect(after.jars.map((jar) => jar.id)).toEqual(['jar-s'])
    expect(state).toEqual(before)
    // Only what changed is new, so the repository writes only that.
    expect(after.plants).toBe(state.plants)
    expect(after.jarPlacements).toBe(state.jarPlacements)
  })

  it('refuses a jar on a plant, and one no longer there, with the very same garden', () => {
    const placed = placeJar(jarGarden(), 'jar-a', 'plant-1')
    expect(recycleJar(placed, 'jar-a')).toEqual({ state: placed, outcome: { kind: 'placed' } })
    const state = jarGarden()
    expect(recycleJar(state, 'jar-gone')).toEqual({ state, outcome: { kind: 'missing' } })
  })

  it('never makes Nectar: buying and recycling leaves less than before', () => {
    const start = { ...createEmptyState(), nectar: JAR_PRICE }
    const bought = buyJar(start, 'A', 'blue').state
    const recycled = recycleJar(bought, bought.jars[0].id).state
    expect(recycled.nectar).toBeLessThan(start.nectar)
    expect(recycled.jars).toEqual([])
  })
})

describe('undoing a recycle', () => {
  function recycled() {
    const state = { ...jarGarden(), nectar: 0 }
    const result = recycleJar(state, 'jar-s')
    if (result.outcome.kind !== 'recycled') throw new Error('Expected a recycle')
    return { before: state, after: result.state, recycled: result.outcome.recycled }
  }

  it('puts the jar back where it stood and takes its Nectar back', () => {
    const { before, after, recycled: jar } = recycled()
    const { state, outcome } = restoreRecycledJar(after, jar)
    expect(outcome).toEqual({ kind: 'restored' })
    expect(state.jars).toEqual(before.jars)
    expect(state.nectar).toBe(before.nectar)
  })

  it('is refused once the Nectar it brought has been spent', () => {
    const { after, recycled: jar } = recycled()
    const spent = { ...after, nectar: 1 }
    expect(restoreRecycledJar(spent, jar)).toEqual({
      state: spent,
      outcome: { kind: 'spent', needed: JAR_RECYCLE_NECTAR - 1 },
    })
  })

  it('is refused when the shelf has filled again', () => {
    const { after, recycled: jar } = recycled()
    const full = {
      ...after,
      nectar: 50,
      jars: Array.from({ length: JAR_CAPACITY }, (_, index) => ({
        ...after.jars[0],
        id: `full-${index}`,
      })),
    }
    expect(restoreRecycledJar(full, jar)).toEqual({ state: full, outcome: { kind: 'full' } })
  })

  it('does nothing the second time, or once another tab put it back', () => {
    const { after, recycled: jar } = recycled()
    const back = restoreRecycledJar(after, jar).state
    expect(restoreRecycledJar(back, jar)).toEqual({ state: back, outcome: { kind: 'back' } })
  })

  it('puts it at the end of a shelf that has shrunk since', () => {
    const state = { ...jarGarden(), nectar: 0 }
    const first = recycleJar(state, 'jar-s')
    if (first.outcome.kind !== 'recycled') throw new Error('Expected a recycle')
    const shrunk = recycleJar(first.state, 'jar-a').state
    const { state: restored } = restoreRecycledJar(shrunk, first.outcome.recycled)
    expect(restored.jars.map((jar) => jar.id)).toEqual(['jar-s'])
    expect(restored.nectar).toBe(JAR_RECYCLE_NECTAR)
  })
})
