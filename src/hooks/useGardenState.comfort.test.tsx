import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addComfortItem, removeComfortItem } from '../lib/comfortPlanEdits'
import { toLocalDate } from '../lib/date'
import { createInitialState } from '../lib/progression'
import { gardenRepository } from '../repository/gardenRepository'
import type { AppState, ComfortPlan } from '../types'
import { useGardenState } from './useGardenState'

/** Visited today, so nothing is noted on loading: the only writes are a test's own. */
function visitedToday(comfortPlan?: ComfortPlan): AppState {
  const seed = createInitialState('Tester', 'Test Garden')
  return {
    ...seed,
    profile: {
      ...seed.profile!,
      lastVisitOn: toLocalDate(),
      ...(comfortPlan ? { comfortPlan } : {}),
    },
  }
}

const sam = { id: 'sam', text: 'Sam', phone: '+44 7700 900123' }

beforeEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the comfort plan, through the hook', () => {
  it('changes the plan in the profile and writes it, and earns nothing', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: visitedToday() })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = result.current.state!

    act(() =>
      result.current.changeComfortPlan((plan) =>
        addComfortItem(plan, 'people', { text: 'Sam', phone: '+44 7700 900123' }, 'sam'),
      ),
    )
    expect(result.current.state?.profile?.comfortPlan).toEqual({ people: [sam] })
    // No Sunlight, Nectar or Stardust for writing it.
    expect(result.current.state?.sunlight).toBe(before.sunlight)
    expect(result.current.state?.nectar).toBe(before.nectar)
    expect(result.current.state?.stardust).toBe(before.stardust)
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({ comfortPlan: { people: [sam] } }),
        }),
      ),
    )

    act(() => result.current.changeComfortPlan((plan) => removeComfortItem(plan, 'people', 'sam')))
    expect(result.current.state?.profile).not.toHaveProperty('comfortPlan')
  })

  it('writes nothing for a change that changes nothing', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: visitedToday({ people: [sam] }),
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = result.current.state
    act(() => result.current.changeComfortPlan((plan) => removeComfortItem(plan, 'people', 'gone')))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(result.current.state).toBe(before)
    expect(save).not.toHaveBeenCalled()
  })

  it('travels in a backup inside the profile, and comes back with a restore', async () => {
    const plan: ComfortPlan = { people: [sam], kindWords: [{ id: 'kind', text: 'Go gently.' }] }
    await gardenRepository.save(visitedToday(plan))
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state?.profile?.comfortPlan).toEqual(plan)

    const file = (await result.current.exportGarden())!
    const { garden } = JSON.parse(file) as { garden: Record<string, unknown> & { profile: object } }
    // Inside the profile, which an older build restoring this file carries
    // through whole, and not beside it, where that build would drop it.
    expect(garden.profile).toMatchObject({ comfortPlan: plan })
    expect(garden).not.toHaveProperty('comfortPlan')

    act(() => result.current.changeComfortPlan(() => ({})))
    expect(result.current.state?.profile).not.toHaveProperty('comfortPlan')
    // Let that write land before replacing it.
    await new Promise((resolve) => setTimeout(resolve, 50))
    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(file)
    })
    expect(outcome?.ok).toBe(true)
    expect(result.current.state?.profile?.comfortPlan).toEqual(plan)
    const stored = await gardenRepository.load()
    expect(stored.state?.profile?.comfortPlan).toEqual(plan)
  })
})
