import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import {
  createGardenRepository,
  CURRENT_STATE_VERSION,
  GardenConflictError,
  GardenDeletedElsewhereError,
  GardenWithheldError,
  inspectImportedState,
  RAW_EXPORT_FORMAT,
  readImportedState,
} from './gardenRepository'

/**
 * Two repositories on one database are two open tabs. These tests pin the
 * behaviour the audit found missing: neither tab may overwrite what the other
 * wrote, and a deletion in one must never be undone by the other.
 */
let counter = 0
const names: string[] = []
function freshName() {
  counter += 1
  const name = `two-tabs-${counter}`
  names.push(name)
  return name
}

afterEach(async () => {
  for (const name of names.splice(0)) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
})

function garden(seeds = 2) {
  return { ...createInitialState('Tester', 'Two Tabs'), seeds }
}

describe('two tabs on one garden', () => {
  it('refuses a stale save instead of overwriting the other tab', async () => {
    const name = freshName()
    const first = createGardenRepository(name)
    const second = createGardenRepository(name)

    const original = garden(2)
    await first.save(original)
    const loaded = await second.load()
    expect(loaded.status).toBe('loaded')

    await second.save({ ...loaded.state, seeds: 50 })

    await expect(first.save({ ...original, seeds: 3 })).rejects.toBeInstanceOf(
      GardenConflictError,
    )
    const after = await createGardenRepository(name).load()
    expect(after.state.seeds).toBe(50)
  })

  it('never writes over a garden a newer build stored', async () => {
    // The reproduction from the audit: a newer build's data arrives, adopt
    // falls back to a withheld load, and the next edit used to write every
    // part of this tab's stale garden over it.
    const name = freshName()
    const tab = createGardenRepository(name)
    const mine = garden(2)
    await tab.save(mine)

    const db = await openDB(name)
    const meta = (await db.get('meta', 'current')) as Record<string, unknown>
    await db.put('meta', { ...meta, version: CURRENT_STATE_VERSION + 1 }, 'current')
    db.close()

    const adopted = await tab.adopt(['meta'])
    expect(adopted).toMatchObject({ status: 'withheld', reason: 'incompatible' })
    await expect(tab.save({ ...mine, nectar: 99 })).rejects.toBeInstanceOf(
      GardenWithheldError,
    )

    const check = await openDB(name)
    expect(await check.get('meta', 'current')).toMatchObject({ version: CURRENT_STATE_VERSION + 1 })
    check.close()
  })

  it('lets one tab save several times in a row without tripping over itself', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    const base = garden(1)
    // Not awaited one by one: the save effect can fire like this.
    await Promise.all([
      tab.save(base),
      tab.save({ ...base, seeds: 2 }),
      tab.save({ ...base, seeds: 3 }),
    ])
    const after = await createGardenRepository(name).load()
    expect(after.state.seeds).toBe(3)
  })

  it('never lets a tab write a deleted garden back', async () => {
    const name = freshName()
    const deleter = createGardenRepository(name)
    const other = createGardenRepository(name)
    const stored = garden(4)
    await deleter.save(stored)
    const loaded = await other.load()

    await deleter.clear()

    await expect(
      other.save({ ...loaded.state, seeds: 9 }),
    ).rejects.toBeInstanceOf(GardenDeletedElsewhereError)

    // Once told, the other tab starts a new garden from nothing.
    other.forget()
    const fresh = await other.load()
    expect(fresh.status).toBe('empty')
  })
})

describe('saved looks in two tabs', () => {
  it('does not write back looks a restore in the other tab replaced', async () => {
    const name = freshName()
    const restorer = createGardenRepository(name)
    const dresser = createGardenRepository(name)
    const seed = garden(2)
    const looks = [{ id: 'look-1', name: 'Sunday best', outfit: { headwear: 'sprout-cap' } }]
    await dresser.save({ ...seed, profile: { ...seed.profile!, outfitPresets: looks } })

    // The other tab restores a garden that never saved a look: every part is
    // written, and the dresser's tab is told so.
    const parts = await restorer.replace(garden(7))
    const adopted = await dresser.adopt(parts)
    expect(adopted.status).toBe('loaded')
    // The restored profile is taken whole, so the looks it lacks are gone
    // here too, rather than kept from the garden it replaced.
    expect(adopted.state.profile).not.toHaveProperty('outfitPresets')

    // The dresser's next edit is made on the garden it adopted.
    await dresser.save({ ...adopted.state, nectar: 3 })
    const after = await createGardenRepository(name).load()
    expect(after.state).toMatchObject({ seeds: 7, nectar: 3 })
    expect(after.state.profile).not.toHaveProperty('outfitPresets')
  })
})

describe('keeping what could not be read', () => {
  it('sets an unreadable garden aside once, however often it is opened', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(garden())
    const db = await openDB(name)
    await db.put('moods', 'not a collection', 'current')
    db.close()

    for (let launch = 0; launch < 4; launch += 1) {
      expect((await tab.load()).status).toBe('withheld')
    }
    expect(await tab.quarantined()).toHaveLength(1)
  })

  it('keeps at most three distinct set-aside copies', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(garden())
    for (let version = 0; version < 5; version += 1) {
      const db = await openDB(name)
      await db.put('moods', `damaged ${version}`, 'current')
      db.close()
      await tab.load()
      await new Promise((resolve) => setTimeout(resolve, 2))
    }
    expect(await tab.quarantined()).toHaveLength(3)
  })
})

describe('undoing a restore', () => {
  it('keeps the garden a restore replaced, and can put it back', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(garden(5))

    await tab.replace(garden(42), { snapshot: true })
    const [snapshot] = await tab.snapshots()
    expect(snapshot).toBeDefined()

    const previous = await tab.snapshot(snapshot.id)
    expect(previous?.seeds).toBe(5)
    await tab.replace(previous!)
    expect((await createGardenRepository(name).load()).state.seeds).toBe(5)
  })

  it('keeps only the two newest snapshots', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(garden(1))
    for (let seeds = 2; seeds < 6; seeds += 1) {
      await tab.replace(garden(seeds), { snapshot: true })
      await new Promise((resolve) => setTimeout(resolve, 2))
    }
    expect(await tab.snapshots()).toHaveLength(2)
  })
})

describe('drafts and safe mode', () => {
  it('keeps drafts apart from the garden', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(garden())
    await tab.writeDrafts({ 'reflection:2026-10-26': 'Half a thought' })
    expect(await tab.readDrafts()).toEqual({
      'reflection:2026-10-26': 'Half a thought',
    })
    const loaded = await tab.load()
    expect(JSON.stringify(loaded.state)).not.toContain('Half a thought')
  })

  it('downloads everything stored in a form that restores', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(garden(17))
    const raw = await tab.readRaw()
    expect(raw.format).toBe(RAW_EXPORT_FORMAT)
    const restored = readImportedState(JSON.parse(JSON.stringify(raw)))
    expect(restored?.seeds).toBe(17)
  })

  it('reports a newer database as out of date rather than unavailable', async () => {
    const name = freshName()
    const db = await openDB(name, 99)
    db.close()
    const result = await createGardenRepository(name).load()
    expect(result).toMatchObject({ status: 'withheld', reason: 'incompatible' })
  })
})

describe('moving to a new address', () => {
  it('restores a backup made at the old address whole at the new one', async () => {
    // Two origins are two databases: nothing carries over but the file.
    const old = createGardenRepository(freshName())
    const fresh = createGardenRepository(freshName())
    const grown = {
      ...garden(7),
      nectar: 12,
      moods: [
        {
          id: 'm1',
          localDate: '2026-10-25',
          level: 4 as const,
          note: 'A long walk by the river.',
          createdAt: '2026-10-25T09:00:00.000Z',
          updatedAt: '2026-10-25T09:00:00.000Z',
        },
      ],
    }
    await old.save(grown)
    const before = (await old.load()).state

    // The file exactly as Settings and the move banner write it.
    const file = JSON.stringify({
      format: 'the-butterfly-garden',
      exportedAt: '2026-10-26T12:00:00.000Z',
      appVersion: '3.0.0',
      garden: before,
    })
    const inspection = inspectImportedState(JSON.parse(file))
    expect(inspection.refused).toBeUndefined()
    expect(inspection.repaired).toBe(0)
    await fresh.replace(inspection.state!)

    const after = await createGardenRepository(names[names.length - 1]).load()
    expect(after.status).toBe('loaded')
    expect(after.state).toEqual(before)
  })
})
