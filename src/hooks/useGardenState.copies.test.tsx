import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isQuietWrite } from '../lib/quietWrites'
import { gardenRepository } from '../repository/gardenRepository'
import { useGardenState } from './useGardenState'

/*
 * The earlier copies and the backup file kept up to date, through the hook
 * the views use: a day's copy put back as a restore, with its undo, and a
 * write of the file recorded as a backup kept, quietly.
 */

beforeEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 20, 9) })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function openGarden() {
  const hook = renderHook(() => useGardenState())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  act(() => hook.result.current.onboard('Tester', 'Kept Garden'))
  await waitFor(() => expect(hook.result.current.state?.profile?.gardenName).toBe('Kept Garden'))
  // Let the first write land: it makes the garden, with nothing before it to keep.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
  return hook
}

describe('earlier copies through the garden’s hook', () => {
  it('puts a day’s copy back as a restore, and the restore can be undone', async () => {
    const { result } = await openGarden()
    vi.setSystemTime(new Date(2026, 9, 21, 9))
    act(() => result.current.addGoal('Water the ferns', 'daily'))
    await waitFor(async () => expect((await result.current.earlierCopies()).copies).toHaveLength(1))

    const [copy] = (await result.current.earlierCopies()).copies
    expect(copy).toMatchObject({ day: '2026-10-21', held: { goals: 0 } })
    expect((await result.current.readCopy(copy.id))?.goals).toEqual([])

    let answer: { ok: boolean; message: string } | undefined
    await act(async () => {
      answer = await result.current.putBackCopy(copy.id)
    })
    expect(answer?.ok).toBe(true)
    expect(result.current.state?.goals).toEqual([])
    const undo = result.current.persistence.lastRestoreSnapshotId
    expect(undo).toBeDefined()

    await act(async () => {
      await result.current.undoRestore(undo!)
    })
    expect(result.current.state?.goals.map((goal) => goal.title)).toEqual(['Water the ferns'])
  })

  it('says so when a copy cannot be read, or cannot be put back', async () => {
    const { result } = await openGarden()
    let answer: { ok: boolean; message: string } | undefined
    await act(async () => {
      answer = await result.current.putBackCopy('daily-1999-01-01')
    })
    expect(answer).toEqual({ ok: false, message: 'That copy could not be read.' })

    vi.spyOn(gardenRepository, 'dailyCopy').mockResolvedValue(result.current.state)
    vi.spyOn(gardenRepository, 'replace').mockRejectedValue(new Error('The disk is full.'))
    await act(async () => {
      answer = await result.current.putBackCopy('daily-2026-10-20')
    })
    expect(answer).toEqual({ ok: false, message: 'The disk is full.' })
  })
})

describe('the backup file through the garden’s hook', () => {
  it('records a write of the file as a backup kept, made quietly', async () => {
    const { result } = await openGarden()
    const madeAt = new Date(2026, 9, 20, 10)
    act(() => result.current.recordAutomaticBackup(madeAt))
    expect(result.current.state?.profile?.lastBackupAt).toBe(madeAt.toISOString())
    expect(isQuietWrite(result.current.state!)).toBe(true)
    // The same time again changes nothing.
    const before = result.current.state
    act(() => result.current.recordAutomaticBackup(madeAt))
    expect(result.current.state).toBe(before)
  })
})
