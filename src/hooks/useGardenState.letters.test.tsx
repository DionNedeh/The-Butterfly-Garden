import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toLocalDate } from '../lib/date'
import { createInitialState } from '../lib/progression'
import { GardenConflictError, gardenRepository } from '../repository/gardenRepository'
import type { AppState } from '../types'
import { useGardenState } from './useGardenState'

/**
 * Planted and visited today, so nothing grows or is noted on loading: the
 * only writes are the ones a test makes.
 */
function visitedToday(extra: Partial<AppState> = {}): AppState {
  const seed = createInitialState('Tester', 'Test Garden')
  return {
    ...seed,
    profile: { ...seed.profile!, lastVisitOn: toLocalDate() },
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-21',
        level: 4,
        note: 'The light on the river',
        createdAt: '2026-10-21T18:00:00.000Z',
        updatedAt: '2026-10-21T18:00:00.000Z',
      },
    ],
    ...extra,
  }
}

async function renderLoaded(state = visitedToday()) {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state })
  const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])
  const view = renderHook(() => useGardenState())
  await waitFor(() => expect(view.result.current.loading).toBe(false))
  return { ...view, save }
}

beforeEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('letters, through the hook', () => {
  it('stars a line, chooses never to quote, and notes a letter read', async () => {
    const { result } = await renderLoaded()
    const garden = () => result.current.state!
    act(() => result.current.setStarred('check-in', 'mood-1', true))
    expect(garden().moods[0].starred).toBe(true)
    act(() => result.current.setLetterQuotes('never'))
    expect(garden().profile?.letterQuotes).toBe('never')
    act(() => result.current.readLetter('2026-10-25'))
    expect(garden().profile?.lastLetterRead).toBe('2026-10-25')
  })

  it('writes nothing for an older letter read again', async () => {
    const { result, save } = await renderLoaded()
    act(() => result.current.readLetter('2026-10-25'))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const before = result.current.state
    act(() => result.current.readLetter('2026-10-18'))
    act(() => result.current.readLetter('2026-10-25'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(result.current.state).toBe(before)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('marks a letter read again, quietly, when another tab wrote first', async () => {
    // The other tab has not read it: a conflict must not undo "Put away".
    const other = visitedToday({ seeds: 9 })
    const load = vi
      .spyOn(gardenRepository, 'load')
      .mockResolvedValueOnce({ status: 'loaded', state: visitedToday() })
      .mockResolvedValue({ status: 'loaded', state: other })
    const save = vi
      .spyOn(gardenRepository, 'save')
      .mockRejectedValueOnce(new GardenConflictError())
      .mockResolvedValue(['meta'])
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.readLetter('2026-10-25'))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        seeds: 9,
        profile: expect.objectContaining({ lastLetterRead: '2026-10-25' }),
      }),
    )
    expect(result.current.state?.profile?.lastLetterRead).toBe('2026-10-25')
    expect(result.current.persistence.notice).toBeUndefined()
  })

  it('stops marking it again after a few refusals', async () => {
    const other = visitedToday({ seeds: 9 })
    const load = vi
      .spyOn(gardenRepository, 'load')
      .mockResolvedValueOnce({ status: 'loaded', state: visitedToday() })
      .mockResolvedValue({ status: 'loaded', state: other })
    const save = vi.spyOn(gardenRepository, 'save').mockRejectedValue(new GardenConflictError())
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.readLetter('2026-10-25'))
    // The first write and three tries, each refused and reloaded.
    await waitFor(() => expect(load).toHaveBeenCalledTimes(5))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(save).toHaveBeenCalledTimes(4)
    expect(load).toHaveBeenCalledTimes(5)
    expect(result.current.state).toEqual(other)
    expect(result.current.persistence.notice).toBeUndefined()
  })
})
