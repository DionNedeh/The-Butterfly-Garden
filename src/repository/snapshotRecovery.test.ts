import { openDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLock } from '../lib/gardenLock'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { createGardenRepository, GardenConflictError } from './gardenRepository'

afterEach(() => vi.useRealTimers())

describe('kept pre-restore copies', () => {
  it('keeps two distinct restores and finds the newest even when the clock repeats or goes backwards', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-28T12:00:00Z') })
    const repository = createGardenRepository(`repeated-clock-${crypto.randomUUID()}`)
    const garden = createInitialState('Robin', 'Garden')
    await repository.save(garden)
    await repository.replace({ ...garden, seeds: 20 }, { snapshot: true })
    await repository.replace({ ...garden, seeds: 30 }, { snapshot: true })
    let snapshots = await repository.snapshots()
    expect(snapshots).toHaveLength(2)
    expect(new Set(snapshots.map((copy) => copy.id)).size).toBe(2)
    expect((await repository.snapshot(snapshots[0].id))?.seeds).toBe(20)
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'))
    await repository.replace({ ...garden, seeds: 40 }, { snapshot: true })
    snapshots = await repository.snapshots()
    expect(snapshots).toHaveLength(2)
    expect((await repository.snapshot(snapshots[0].id))?.seeds).toBe(30)
    repository.forget()
  })
  it('can be listed and restored by a fresh instance after reload, with their original photos', async () => {
    const name = `reload-copy-${crypto.randomUUID()}`
    const repository = createGardenRepository(name)
    const before = createInitialState('Robin', 'Before restore')
    await repository.save(before)
    await repository.replace({ ...before, seeds: 42 }, { snapshot: true })
    const fresh = createGardenRepository(name)
    await fresh.load()
    const copy = (await fresh.earlierCopies()).copies.find((copy) => copy.reason === 'restore')!
    expect(copy.gardenName).toBe('Before restore')
    expect(copy.held).toBeDefined()
    const previous = await fresh.dailyCopy(copy.id, undefined)
    expect(previous?.seeds).toBe(before.seeds)
    await fresh.replace(previous!, { snapshot: true })
    const [undo] = await fresh.snapshots()
    expect((await fresh.snapshot(undo.id))?.seeds).toBe(42)
    await fresh.discardSnapshot(copy.id)
    expect(await fresh.rawSnapshot(copy.id)).toBeUndefined()
    repository.forget(); fresh.forget()
  })

  it('names a damaged sealed snapshot, preserves it, and changes the lock after an explicit discard', async () => {
    const name = `broken-copy-${crypto.randomUUID()}`
    const repository = createGardenRepository(name)
    const garden = createInitialState('Robin', 'Private garden')
    await repository.save(garden)
    const first = await createLock('kingfisher at dawn', newRecoveryCode(), 1_000)
    await repository.relock(first)
    await repository.replace({ ...garden, seeds: 42 }, { snapshot: true })
    const [copy] = await repository.snapshots()
    const db = await openDB(name)
    const raw = await db.get('snapshots', copy.id)
    raw.garden.data[0] ^= 1
    await db.put('snapshots', raw, copy.id)
    db.close()
    const next = await createLock('kingfisher at dusk', newRecoveryCode(), 1_000)
    await expect(repository.relock(next)).rejects.toMatchObject({ name: 'SnapshotSealedError', message: expect.stringContaining(copy.id) })
    expect((await repository.readLock())?.id).toBe(first.record.id)
    expect(await repository.rawSnapshot(copy.id)).toEqual(raw)
    const download = await repository.snapshotForDownload(copy.id)
    expect(download.snapshot).toEqual(raw)
    expect(download.lock?.id).toBe(first.record.id)
    await repository.discardSnapshot(copy.id)
    await repository.relock(next)
    expect((await repository.readLock())?.id).toBe(next.record.id)
    expect((await repository.load()).state.seeds).toBe(42)
    repository.forget()
  })

  it('refuses a stale tab discarding a copy after another tab changes the lock', async () => {
    const name = `stale-copy-${crypto.randomUUID()}`
    const first = createGardenRepository(name)
    const garden = createInitialState('Robin', 'Garden')
    await first.save(garden)
    await first.replace({ ...garden, seeds: 42 }, { snapshot: true })
    const [copy] = await first.snapshots()
    const stale = createGardenRepository(name)
    await stale.load()
    await first.relock(await createLock('kingfisher at dawn', newRecoveryCode(), 1_000))
    await expect(stale.discardSnapshot(copy.id)).rejects.toBeInstanceOf(GardenConflictError)
    expect(await first.rawSnapshot(copy.id)).toBeDefined()
    first.forget(); stale.forget()
  })
})
