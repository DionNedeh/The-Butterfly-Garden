import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import { completeGoal, setGoalArchived } from '../lib/gardenActions'
import { adoptGoal } from '../lib/lifecycle'
import { createInitialState } from '../lib/progression'
import type { AppState, Goal } from '../types'
import { createGardenRepository, storedBaseline } from './gardenRepository'

/**
 * A companion grown alongside a goal that an older build archived. That build
 * keeps the link (it rebuilds companions whole) and does not let go of it;
 * reading the garden here lets go. The release must reach storage, or
 * restoring the goal brings the link back on the next launch.
 */
let counter = 0
const names: string[] = []
function freshName() {
  counter += 1
  const name = `adoption-${counter}`
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

const walk: Goal = {
  id: 'walk',
  title: 'Walk outside',
  schedule: 'daily',
  weekdays: [],
  createdDate: '2026-10-01',
  archived: false,
}

function adoptedEgg(): AppState {
  const seed = createInitialState('Tester', 'Adoption')
  const garden = {
    ...seed,
    goals: [walk],
    creatures: [{ ...seed.creatures[0], stage: 'egg' as const }],
  }
  return adoptGoal(garden, garden.creatures[0].id, 'walk')
}

/** What an older build writes when it archives the goal: goals and meta only. */
async function archiveAsAnOlderBuild(name: string) {
  const db = await openDB(name)
  const tx = db.transaction(['meta', 'goals'], 'readwrite')
  const meta = await tx.objectStore('meta').get('current')
  await tx.objectStore('meta').put({ ...meta, revision: (meta.revision ?? 0) + 1 }, 'current')
  await tx.objectStore('goals').put([{ ...walk, archived: true }], 'current')
  await tx.done
  db.close()
}

describe('a companion let go of an archived goal', () => {
  it('stays let go once the goal is restored, through a relaunch', async () => {
    const name = freshName()
    const garden = adoptedEgg()
    expect(garden.creatures[0].adoptedGoalId).toBe('walk')
    const first = createGardenRepository(name)
    await first.load()
    await first.save(garden)
    await archiveAsAnOlderBuild(name)

    const relaunched = createGardenRepository(name)
    const loaded = await relaunched.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.creatures[0].adoptedGoalId).toBeUndefined()
    const written = await relaunched.save(setGoalArchived(loaded.state, 'walk', false))
    expect(written).toContain('creatures')

    const again = await createGardenRepository(name).load()
    expect(again.state.goals[0].archived).toBe(false)
    expect(again.state.creatures[0].adoptedGoalId).toBeUndefined()
    const done = completeGoal(again.state, 'walk', new Date(2026, 9, 27, 10))
    expect(done.creatures[0].grownAlongside).toBeUndefined()
  })

  it('is taken in the same way from another tab', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.load()
    await tab.save(adoptedEgg())
    await archiveAsAnOlderBuild(name)

    const synced = await tab.adopt(['meta', 'goals'])
    expect(synced.state.creatures[0].adoptedGoalId).toBeUndefined()
    const written = await tab.save(setGoalArchived(synced.state, 'walk', false))
    expect(written).toContain('creatures')
    const again = await createGardenRepository(name).load()
    expect(again.state.creatures[0].adoptedGoalId).toBeUndefined()
  })

  it('writes nothing more when reading let nothing go', () => {
    const garden = adoptedEgg()
    expect(storedBaseline(garden, garden)).toBe(garden)
    expect(storedBaseline(undefined, garden)).toBe(garden)
    const released = storedBaseline(garden, {
      ...garden,
      creatures: garden.creatures.map((creature) => {
        const released = { ...creature }
        delete released.adoptedGoalId
        return released
      }),
    })
    expect(released.creatures[0]).not.toBe(garden.creatures[0])
    expect(released.creatures[0].adoptedGoalId).toBeUndefined()
  })
})
