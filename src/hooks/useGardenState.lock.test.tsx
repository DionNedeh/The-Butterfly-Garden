import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDrafts } from '../lib/drafts'
import { createLock, openLock } from '../lib/gardenLock'
import { turnLockOn } from '../lib/gardenLockActions'
import { createEmptyState, createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import {
  createGardenRepository,
  gardenRepository,
  isSealed,
} from '../repository/gardenRepository'
import { FakeBroadcastChannel } from '../test/fakeBroadcastChannel'
import { useGardenState } from './useGardenState'

/*
 * Another tab turning the lock on or off. The switch stores every part of the
 * garden again, under a new revision; a tab that can still read the garden
 * afterwards must read it again, or its next change is refused as a conflict
 * and lost (Invariant 2 keeps it from being written over the switch).
 */

vi.mock('../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

const PASSCODE = 'wrens in the hawthorn'
const WORDS = 'Rain on the window, and the kettle on'

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(async () => {
  cleanup()
  resetDrafts()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await gardenRepository.clear().catch(() => undefined)
})

/** This tab's garden, read and on screen. */
async function renderLoaded() {
  const hook = renderHook(() => useGardenState())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.state?.profile?.name).toBe('Robin')
  return hook
}

/** The other tab saying, as gardenLockActions does, that the lock changed. */
function announceLockChange() {
  const channel = new FakeBroadcastChannel('butterfly-garden-sync')
  channel.postMessage({ type: 'garden-lock' })
  channel.close()
}

/** The garden as stored now, read by a tab of its own. */
async function stored() {
  return (await createGardenRepository().load()).state
}

async function metaIsSealed(): Promise<boolean> {
  const db = await openDB('butterfly-garden')
  try {
    return isSealed(await db.get('meta', 'current'))
  } finally {
    db.close()
  }
}

describe('another tab switching the lock', { timeout: 30_000 }, () => {
  it('reads the garden again once the lock is turned off there, so the next change here is kept', async () => {
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    await turnLockOn(PASSCODE, newRecoveryCode())
    const { result } = await renderLoaded()
    const before = result.current.state

    // The other tab opens the garden with the passcode and turns the lock off.
    const other = createGardenRepository()
    const record = (await other.readLock())!
    other.unlock(await openLock(record, { slot: 'passcode', passcode: PASSCODE }), record.id)
    await other.load()
    await other.relock(undefined)
    act(() => announceLockChange())
    await waitFor(() => expect(result.current.state).not.toBe(before))
    expect(gardenRepository.lockState()).toBe('none')
    expect(result.current.persistence.readOnly).toBe(false)

    act(() => result.current.saveReflection('notice', WORDS))
    await waitFor(async () =>
      expect((await stored()).reflections.map((reflection) => reflection.body)).toEqual([WORDS]),
    )
    await gardenRepository.settled()
    expect(result.current.persistence.notice).toBeUndefined()
    expect(result.current.state?.reflections.map((reflection) => reflection.body)).toEqual([WORDS])
    // Written as the lock now is: in the clear.
    expect(await metaIsSealed()).toBe(false)
  })

  it('takes the garden off this screen, writing nothing over it, once the lock is turned on there', async () => {
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    const { result } = await renderLoaded()

    const other = createGardenRepository()
    await other.load()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), 1_000)
    await other.relock({ record, key })
    const save = vi.spyOn(gardenRepository, 'save')
    act(() => announceLockChange())
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
    await waitFor(() => expect(result.current.persistence.readOnly).toBe(true))

    // LockGate shows the lock screen now; nothing this tab still holds is
    // written over the sealed garden, whatever happens to it meanwhile.
    act(() => result.current.saveReflection('notice', WORDS))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(save).not.toHaveBeenCalled()
    expect(await metaIsSealed()).toBe(true)
  })

  it('reads the garden again from a database made afresh, opening it anew', async () => {
    // However the switch stores the garden again -- in a new database, the
    // old one deleted -- the tab follows it rather than taking the old
    // database's going for the garden's.
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    const { result } = await renderLoaded()
    act(() => result.current.saveMood(4, 'Fine'))
    await waitFor(async () => expect((await stored()).moods).toHaveLength(1))
    await gardenRepository.settled()
    const before = result.current.state

    const other = createGardenRepository()
    const garden = (await other.load()).state
    await other.clear()
    await other.replace(garden)
    act(() => announceLockChange())
    await waitFor(() => expect(result.current.state).not.toBe(before))
    expect(result.current.persistence.readOnly).toBe(false)

    act(() => result.current.saveReflection('notice', WORDS))
    await waitFor(async () =>
      expect((await stored()).reflections.map((reflection) => reflection.body)).toEqual([WORDS]),
    )
    await gardenRepository.settled()
    expect(result.current.persistence.notice).toBeUndefined()
    expect(result.current.state?.moods).toHaveLength(1)
    expect((await stored()).moods).toHaveLength(1)
  })

  it('only follows the lock in a tab that is not saving, reading nothing back', async () => {
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    const load = vi.spyOn(gardenRepository, 'load').mockResolvedValueOnce({
      status: 'withheld',
      state: createEmptyState(),
      reason: 'incompatible',
    })
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.persistence.readOnly).toBe(true))
    load.mockClear()
    const adopt = vi.spyOn(gardenRepository, 'adopt')

    const other = createGardenRepository()
    await other.load()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), 1_000)
    await other.relock({ record, key })
    act(() => announceLockChange())
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
    expect(adopt).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
  })
})
