import { describe, expect, it } from 'vitest'
import { createLock } from '../lib/gardenLock'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { createGardenRepository } from './gardenRepository'

/*
 * 6.2: writeDrafts says when the drafts reached storage, so the "Draft kept"
 * hint never claims one that a lock or a failure kept out. It still never
 * rejects: a draft is a convenience.
 */
let count = 0
const freshName = () => `drafts-kept-${(count += 1)}-${Date.now()}`

describe('6.2 drafts written, or not', () => {
  it('resolves true once the drafts are stored', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(createInitialState('Robin', 'Quiet Corner'))
    await expect(tab.writeDrafts({ 'reflection:2026-10-26': 'kept' })).resolves.toBe(true)
    expect(await createGardenRepository(name).readDrafts()).toEqual({
      'reflection:2026-10-26': 'kept',
    })
  })

  it('resolves, but not true, for a tab the lock turned on elsewhere keeps out', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(createInitialState('Robin', 'Quiet Corner'))
    const other = createGardenRepository(name)
    await other.load()
    const { record, key } = await createLock('heron by the weir', newRecoveryCode(), 1_000)
    await repository.relock({ record, key })
    await expect(other.writeDrafts({ 'mood:2026-10-22': 'not now' })).resolves.not.toBe(true)
    expect(await other.readDrafts()).toEqual({})
  })
})
