import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GARDEN_COLLECTIONS,
  GardenConflictError,
  GardenDeletedElsewhereError,
  GardenDeletionPendingError,
  gardenRepository,
} from '../repository/gardenRepository'
import { onAnnouncement } from '../lib/announcer'
import { toLocalDate } from '../lib/date'
import { createEmptyState, createInitialState } from '../lib/progression'
import type { PurchaseOutcome } from '../lib/purchase'
import { useGardenState } from './useGardenState'

/** A minimal harness that exposes the hook's state through the DOM. */
function Harness() {
  const garden = useGardenState()
  return (
    <div>
      <span data-testid="loading">{String(garden.loading)}</span>
      <span data-testid="read-only">{String(garden.persistence.readOnly)}</span>
      <span data-testid="reason">{garden.persistence.reason ?? ''}</span>
      <span data-testid="write-error">
        {garden.persistence.writeError ?? ''}
      </span>
      <span data-testid="seeds">{garden.state?.seeds ?? ''}</span>
      <button onClick={() => garden.onboard('Tester', 'Test Garden')}>
        Onboard
      </button>
      <button onClick={() => garden.plant('aster')}>Plant</button>
      <button
        onClick={() => {
          void garden.importGarden(
            JSON.stringify({
              format: 'the-butterfly-garden',
              garden: {
                ...createInitialState('Restored', 'Restored Garden'),
                seeds: 42,
              },
            }),
          )
        }}
      >
        Restore
      </button>
    </div>
  )
}

beforeEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useGardenState persistence', () => {
  it('stops writing, and says why, when the stored garden cannot be read', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'withheld',
      state: createEmptyState(),
      reason: 'incompatible',
    })
    const save = vi.spyOn(gardenRepository, 'save')

    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )

    expect(screen.getByTestId('read-only')).toHaveTextContent('true')
    expect(screen.getByTestId('reason')).toHaveTextContent('incompatible')
    // The whole point: nothing may be written over data we could not read.
    expect(save).not.toHaveBeenCalled()
  })

  it('reports a failed write once, without retrying in a loop', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: createInitialState('Tester', 'Test Garden'),
    })
    const save = vi
      .spyOn(gardenRepository, 'save')
      .mockRejectedValue(
        new Error('The garden could not be saved to this device.'),
      )

    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )

    act(() => {
      screen.getByRole('button', { name: 'Plant' }).click()
    })
    await waitFor(() =>
      expect(screen.getByTestId('write-error')).toHaveTextContent(
        /could not be saved/i,
      ),
    )

    // A failing write must not re-arm itself off the error it just set.
    const attempts = save.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(save.mock.calls.length).toBe(attempts)
    expect(attempts).toBeLessThanOrEqual(2)
  })

  it('does not re-save a garden it just loaded unchanged', async () => {
    const stored = createInitialState('Tester', 'Test Garden')
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: stored,
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])

    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(save).not.toHaveBeenCalled()
  })

  it('writes once per change, and clears the error when a write succeeds', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: createInitialState('Tester', 'Test Garden'),
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])

    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )

    act(() => {
      screen.getByRole('button', { name: 'Plant' }).click()
    })

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('write-error')).toHaveTextContent('')
  })
})

describe('restoring a backup', () => {
  it('replaces the whole garden and tells the other tabs', async () => {
    // A restore swaps the document rather than amending it. Writing only the
    // difference can leave a collection's record behind, and staying quiet
    // leaves every other tab holding the garden that was just replaced --
    // free to write part of it back over the restored one.
    const replace = vi.spyOn(gardenRepository, 'replace')
    // A save that touched nothing never announces, so the only announcement
    // this test can see is the one the restore itself makes. Without that the
    // ordinary write following the restore would post its own message and mask
    // a restore that stayed silent.
    vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const posted: Array<{ type?: string; parts?: unknown }> = []
    vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation(
      (message) => {
        posted.push(message as { type?: string; parts?: unknown })
      },
    )

    render(<Harness />)
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    )
    act(() => {
      screen.getByText('Onboard').click()
    })
    await waitFor(() =>
      expect(screen.getByTestId('seeds')).not.toHaveTextContent(''),
    )
    // Anything the onboarding write announced is not what this test is about.
    posted.length = 0

    act(() => {
      screen.getByText('Restore').click()
    })

    await waitFor(() =>
      expect(screen.getByTestId('seeds')).toHaveTextContent('42'),
    )
    expect(replace).toHaveBeenCalled()

    const announcement = posted.find(
      (message) => message.type === 'garden-saved',
    )
    expect(announcement).toBeDefined()
    expect(announcement?.parts).toEqual(['meta', ...GARDEN_COLLECTIONS])
  })
})

describe('durable custom-image save feedback', () => {
  const image = {
    id: 'scene',
    name: 'My image',
    createdAt: '2026-09-08T00:00:00Z',
    updatedAt: '2026-09-08T00:00:00Z',
    mimeType: 'image/png' as const,
    width: 1,
    height: 1,
    byteLength: 3,
    imageData: 'YWJj',
    crop: { x: 0.5, y: 0.5, zoom: 1 },
  }
  it('does not confirm success until the repository write completes', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: createInitialState('Tester', 'Garden'),
    })
    let finish!: (parts: []) => void
    vi.spyOn(gardenRepository, 'save').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let saved: Promise<{ ok: boolean }> | undefined
    act(() => {
      saved = result.current.saveCustomBackdrop(image)
    })
    let completed = false
    void saved!.then(() => {
      completed = true
    })
    await waitFor(() => expect(finish).toBeDefined())
    expect(completed).toBe(false)
    await act(async () => {
      finish([])
      await saved
    })
    expect(await saved).toEqual({ ok: true })
  })
  it('returns a quota error so the editor can retain its draft', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: createInitialState('Tester', 'Garden'),
    })
    vi.spyOn(gardenRepository, 'save').mockRejectedValue(
      new Error('Storage is full'),
    )
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let saved: Promise<{ ok: boolean; message?: string }> | undefined
    act(() => {
      saved = result.current.saveCustomBackdrop(image)
    })
    await waitFor(() =>
      expect(result.current.persistence.writeError).toBe('Storage is full'),
    )
    expect(await saved).toEqual({ ok: false, message: 'Storage is full' })
    expect(result.current.state?.customBackdrops).toHaveLength(0)
    expect(result.current.state?.profile?.selectedCustomBackdropId).toBeUndefined()
  })
})

describe('another tab', () => {
  async function renderLoaded(seeds = 2) {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: { ...createInitialState('Tester', 'Test Garden'), seeds },
    })
    const view = renderHook(() => useGardenState())
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    return view
  }

  it('stops saving but keeps the garden on screen when it cannot adopt a change', async () => {
    // The audit's D1: a withheld adopt used to be ignored, and the next edit
    // wrote this tab's stale garden over everything the other tab stored.
    const { result } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'adopt').mockResolvedValue({
      status: 'withheld',
      state: createEmptyState(),
      reason: 'incompatible',
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])

    const other = new BroadcastChannel('butterfly-garden-sync')
    other.postMessage({ type: 'garden-saved', parts: ['meta'] })
    await waitFor(() => expect(result.current.persistence.readOnly).toBe(true))
    other.close()

    expect(result.current.persistence.reason).toBe('incompatible')
    expect(result.current.state?.seeds).toBe(2)
    act(() => result.current.plant('aster'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(save).not.toHaveBeenCalled()
  })

  it('reads the garden back, and says so, when another tab saved first', async () => {
    const { result } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'save').mockRejectedValue(
      new GardenConflictError(),
    )
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: { ...createInitialState('Tester', 'Test Garden'), seeds: 77 },
    })

    act(() => result.current.plant('aster'))

    await waitFor(() => expect(result.current.state?.seeds).toBe(77))
    expect(result.current.persistence.notice).toMatch(/another tab/i)
    expect(result.current.persistence.writeError).toBeUndefined()
  })

  it('starts again from nothing when another tab deletes the garden', async () => {
    const { result } = await renderLoaded(2)
    const save = vi.spyOn(gardenRepository, 'save')

    const other = new BroadcastChannel('butterfly-garden-sync')
    other.postMessage({ type: 'garden-cleared' })
    await waitFor(() => expect(result.current.state).toBeUndefined())
    other.close()

    expect(result.current.persistence.notice).toMatch(/deleted in another tab/i)
    expect(save).not.toHaveBeenCalled()
  })

  it('warns other tabs before deleting, and tells them when it is done', async () => {
    const { result } = await renderLoaded(2)
    const posted: string[] = []
    vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation(
      (message) => {
        posted.push((message as { type: string }).type)
      },
    )
    vi.spyOn(gardenRepository, 'clear').mockResolvedValue()

    await act(async () => {
      await result.current.deleteAll()
    })

    expect(posted).toEqual(['garden-clearing', 'garden-cleared'])
    expect(result.current.state).toBeUndefined()
  })
})

describe('backups the garden cannot trust', () => {
  it('refuses a damaged backup with a reason instead of crashing later', async () => {
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const replace = vi.spyOn(gardenRepository, 'replace')

    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(
        JSON.stringify({
          format: 'the-butterfly-garden',
          garden: {
            ...createInitialState('Tester', 'Test Garden'),
            moods: [{ id: 'm', localDate: 'soon', level: 2, note: 'Words' }],
          },
        }),
      )
    })

    expect(outcome?.ok).toBe(false)
    expect(outcome?.message).toMatch(/check-in without a valid date/)
    expect(replace).not.toHaveBeenCalled()
  })

  it('will not export a stand-in for a garden it could not read', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'withheld',
      state: createEmptyState(),
      reason: 'malformed',
    })
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.exportGarden()).toBeUndefined()
  })

  it('begins a garden with the starter goals chosen, as daily goals', async () => {
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() =>
      result.current.onboard('Tester', 'With goals', [
        { title: 'Drink a glass of water', tinyTitle: 'Take three sips' },
        { title: 'Take three slow breaths' },
      ]),
    )
    const goals = result.current.state!.goals
    expect(goals).toHaveLength(2)
    expect(goals[0]).toMatchObject({
      title: 'Drink a glass of water',
      tinyTitle: 'Take three sips',
      schedule: 'daily',
      weekdays: [],
      archived: false,
    })
    expect(goals[1]).toMatchObject({ title: 'Take three slow breaths', schedule: 'daily' })
    expect(goals[1]).not.toHaveProperty('tinyTitle')
    expect(goals[0].id).not.toBe(goals[1].id)
    // Nothing chosen is a garden with no goals, as it always was.
    act(() => result.current.onboard('Tester', 'Without'))
    expect(result.current.state!.goals).toEqual([])
  })

  it('makes a restore undoable', async () => {
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.onboard('Tester', 'Before'))
    await waitFor(() =>
      expect(result.current.state?.profile?.gardenName).toBe('Before'),
    )
    // Let the onboarding write land before replacing it.
    await new Promise((resolve) => setTimeout(resolve, 50))

    await act(async () => {
      await result.current.importGarden(
        JSON.stringify({
          format: 'the-butterfly-garden',
          garden: createInitialState('Tester', 'After'),
        }),
      )
    })
    expect(result.current.state?.profile?.gardenName).toBe('After')
    const snapshotId = result.current.persistence.lastRestoreSnapshotId
    expect(snapshotId).toBeDefined()

    await act(async () => {
      await result.current.undoRestore(snapshotId!)
    })
    expect(result.current.state?.profile?.gardenName).toBe('Before')
  })

  it('counts a restore as a copy kept now, whatever time the file carries', async () => {
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = Date.now()
    const garden = createInitialState('Tester', 'Moved')
    await act(async () => {
      await result.current.importGarden(
        JSON.stringify({
          format: 'the-butterfly-garden',
          exportedAt: '2026-03-14T09:30:00.000Z',
          // From the copy before this one, or edited by hand: neither says
          // anything about the copies this device has.
          garden: { ...garden, profile: { ...garden.profile, lastBackupAt: '2099-01-01T00:00:00.000Z' } },
        }),
      )
    })
    const restoredAt = Date.parse(result.current.state!.profile!.lastBackupAt!)
    expect(restoredAt).toBeGreaterThanOrEqual(before)
    expect(restoredAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('an image save that never hears back', () => {
  it('gives up after a while instead of blocking every later image', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.spyOn(gardenRepository, 'load').mockResolvedValue({
        status: 'loaded',
        state: createInitialState('Tester', 'Garden'),
      })
      vi.spyOn(gardenRepository, 'save').mockImplementation(
        () => new Promise(() => undefined),
      )
      const { result } = renderHook(() => useGardenState())
      await waitFor(() => expect(result.current.loading).toBe(false))

      let saved: Promise<{ ok: boolean; message?: string }> | undefined
      act(() => {
        saved = result.current.saveCustomBackdrop({
          id: 'scene',
          name: 'My image',
          createdAt: '2026-09-08T00:00:00Z',
          updatedAt: '2026-09-08T00:00:00Z',
          mimeType: 'image/png',
          width: 1,
          height: 1,
          byteLength: 3,
          imageData: 'YWJj',
          crop: { x: 0.5, y: 0.5, zoom: 1 },
        })
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000)
      })
      expect(await saved).toEqual({
        ok: false,
        message: 'Saving the image took too long. Please try again.',
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('marking what the gardener brought about', () => {
  const nearlyGrown = () => ({
    ...createInitialState('Tester', 'Test Garden'),
    plants: [
      { id: 'p1', plantId: 'aster', growth: 2, plantedAt: '2026-01-01T00:00:00.000Z' },
    ],
  })

  it('announces a bloom the gardener caused', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: nearlyGrown(),
    })
    vi.spyOn(gardenRepository, 'save').mockResolvedValue(['plants'])
    const heard: string[] = []
    const stop = onAnnouncement((events) => heard.push(...events.map((event) => event.kind)))
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(heard).toEqual([])

    // A check-in earns Sunlight, and Sunlight grows the plant into bloom.
    act(() => result.current.saveMood(4, ''))
    await waitFor(() => expect(heard).toContain('plant-bloomed'))
    stop()
  })

  it('stays quiet about what another tab did', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: nearlyGrown(),
    })
    const grownElsewhere = {
      ...nearlyGrown(),
      plants: [{ ...nearlyGrown().plants[0], growth: 3 }],
    }
    vi.spyOn(gardenRepository, 'adopt').mockResolvedValue({
      status: 'loaded',
      state: grownElsewhere,
    })
    const heard: string[] = []
    const stop = onAnnouncement((events) => heard.push(...events.map((event) => event.kind)))
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const other = new BroadcastChannel('butterfly-garden-sync')
    other.postMessage({ type: 'garden-saved', parts: ['plants'] })
    await waitFor(() => expect(result.current.state?.plants[0].growth).toBe(3))
    other.close()
    expect(heard).toEqual([])
    stop()
  })
})

describe('every action, through the hook', () => {
  async function renderReady() {
    const seed = createInitialState('Tester', 'Test Garden')
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: {
        ...seed,
        nectar: 500,
        stardust: 500,
        seeds: 5,
        goals: [
          {
            id: 'g1',
            title: 'Walk',
            schedule: 'daily',
            weekdays: [],
            createdDate: '2026-01-01',
            archived: false,
          },
        ],
      },
    })
    vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const view = renderHook(() => useGardenState())
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    return view
  }

  it('edits goals: add, plan, skip, snooze, wake, complete, archive, delete', async () => {
    const { result } = await renderReady()
    const garden = () => result.current.state!
    act(() => result.current.addGoal('Stretch', 'weekdays', [1, 2]))
    expect(garden().goals.at(-1)?.title).toBe('Stretch')
    expect(garden().goals.at(-1)).not.toHaveProperty('tinyTitle')
    act(() => result.current.addGoal('Walk', 'daily', [], 'Walk to the door'))
    expect(garden().goals.at(-1)?.tinyTitle).toBe('Walk to the door')
    act(() => result.current.planGoal('  ', '2026-12-01'))
    act(() => result.current.planGoal('Post the letter', '2026-12-01'))
    expect(garden().goals.at(-1)).toMatchObject({ schedule: 'once', scheduledDate: '2026-12-01' })
    act(() => result.current.skipGoal('g1'))
    expect(garden().goals[0].skippedDates).toHaveLength(1)
    act(() => result.current.snoozeGoal('g1', 2))
    expect(garden().goals[0].snoozedUntil).toBeDefined()
    act(() => result.current.wakeGoal('g1'))
    expect(garden().goals[0].snoozedUntil).toBeUndefined()
    act(() => result.current.completeGoal('g1'))
    expect(garden().completions).toHaveLength(1)
    act(() => result.current.updateGoal({ ...garden().goals[0], title: 'Long walk' }))
    act(() => result.current.setGoalArchived('g1', true))
    expect(garden().goals[0]).toMatchObject({ title: 'Long walk', archived: true })
    act(() => result.current.deleteGoal('g1'))
    expect(garden().goals.find((goal) => goal.id === 'g1')).toBeUndefined()
    expect(garden().completions).toEqual([])
  })

  it('writes, edits and deletes the journal and the recap', async () => {
    const { result } = await renderReady()
    const garden = () => result.current.state!
    act(() => result.current.saveMood(4, 'Fine'))
    act(() => result.current.updateMood({ ...garden().moods[0], note: 'Better' }))
    expect(garden().moods[0].note).toBe('Better')
    act(() => result.current.deleteMood(garden().moods[0].id))
    expect(garden().moods).toEqual([])

    act(() => result.current.saveReflection('notice', 'Rain on the window'))
    act(() => result.current.updateReflection({ ...garden().reflections[0], body: 'Sun' }))
    expect(garden().reflections[0].body).toBe('Sun')
    act(() => result.current.deleteReflection(garden().reflections[0].id))
    expect(garden().reflections).toEqual([])

    act(() => result.current.collectMoonlight('2026-10-25', { wentWell: 'Tea' }))
    expect(garden().recaps).toHaveLength(1)
    act(() => result.current.updateRecap({ ...garden().recaps[0], wentWell: 'Coffee' }))
    expect(garden().recaps[0].wentWell).toBe('Coffee')
    act(() => result.current.deleteRecap(garden().recaps[0].id))
    expect(garden().recaps).toEqual([])
  })

  it('writes for an earlier day, earning nothing and announcing nothing', async () => {
    const planted = createInitialState('Tester', 'Test Garden', new Date(Date.now() - 20 * 86_400_000))
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: planted })
    vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const heard: string[] = []
    const stop = onAnnouncement((events) => heard.push(...events.map((event) => event.kind)))
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const garden = () => result.current.state!
    const day = toLocalDate(new Date(Date.now() - 3 * 86_400_000))

    act(() => result.current.addEarlierMood(day, 2, 'Caught up'))
    act(() => result.current.addEarlierReflection(day, 'Remembered'))
    expect(garden().moods[0]).toMatchObject({ localDate: day, writtenLater: true })
    expect(garden().reflections[0]).toMatchObject({ localDate: day, writtenLater: true })
    expect(garden().sunlight).toEqual([])
    expect(garden().plants).toBe(planted.plants)
    // Today is never written for here, whatever is asked.
    act(() => result.current.addEarlierMood(toLocalDate(), 4, ''))
    expect(garden().moods).toHaveLength(1)
    expect(heard).toEqual([])
    stop()
  })

  it('tends the garden: plants, care, shop, flight, jars and companions', async () => {
    const { result } = await renderReady()
    const garden = () => result.current.state!
    const plants = garden().plants.length
    act(() => result.current.plant('aster'))
    expect(garden().plants).toHaveLength(plants + 1)
    const planted = garden().plants.at(-1)!.id
    act(() => result.current.removePlant(planted))
    expect(garden().plants).toHaveLength(plants)

    const sol = garden().creatures[0]
    act(() => result.current.careForCreature(sol.id, 'feed'))
    let outcome: PurchaseOutcome | undefined
    act(() => {
      outcome = result.current.purchaseItem('flower-crown')
    })
    expect(garden().ownedItemIds).toContain('flower-crown')
    expect(outcome).toMatchObject({ kind: 'bought', quantity: 1 })
    // Asked again, the hook says what the reducer refused, and why.
    act(() => {
      outcome = result.current.purchaseItem('flower-crown')
    })
    expect(outcome).toEqual({ kind: 'owned' })
    act(() => {
      outcome = result.current.purchaseItem('leaf-bundle', 5)
    })
    expect(garden().inventory['leaf-bundle']).toBe(
      (createInitialState('Tester', 'Test Garden').inventory['leaf-bundle'] ?? 0) + 5,
    )
    expect(outcome).toMatchObject({ kind: 'bought', quantity: 5 })
    act(() => result.current.equipItem(sol.id, 'flower-crown'))
    act(() => result.current.unequipSlot(sol.id, 'headwear'))
    expect(garden().creatures[0].outfit.headwear).toBeUndefined()

    act(() => {
      outcome = result.current.purchaseFlightPattern('petal-hop')
    })
    expect(outcome).toMatchObject({ kind: 'bought', spent: 9, currency: 'nectar' })
    act(() => result.current.selectFlightPattern('petal-hop'))
    expect(garden().selectedFlightPatternId).toBe('petal-hop')

    act(() => {
      outcome = result.current.purchaseJar('A', 'blue')
    })
    expect(outcome).toMatchObject({ kind: 'bought', spent: 6 })
    const jar = garden().jars[0]
    act(() => result.current.placeJar(jar.id, garden().plants[0].id))
    expect(garden().jarPlacements).toHaveLength(1)
    act(() => result.current.removeJarPlacement(garden().plants[0].id))
    expect(garden().jarPlacements).toEqual([])

    act(() => result.current.renameCreature(sol.id, 'Pip'))
    act(() => result.current.selectCompanion(sol.id))
    expect(garden().creatures[0].name).toBe('Pip')
    expect(garden().profile?.activeCompanionId).toBe(sol.id)
  })

  it('saves, wears, renames, deletes and puts back a look', async () => {
    const { result } = await renderReady()
    const garden = () => result.current.state!
    const sol = garden().creatures[0]
    act(() => {
      result.current.purchaseItem('flower-crown')
      result.current.purchaseItem('silk-bow')
    })
    act(() => result.current.equipItem(sol.id, 'flower-crown'))
    expect(garden().creatures[0].outfitsWorn).toEqual(['flower-crown'])
    act(() => result.current.savePreset(sol.id, 'Crowned'))
    const [look] = garden().outfitPresets!
    expect(look).toMatchObject({ name: 'Crowned', outfit: { headwear: 'flower-crown' } })

    act(() => result.current.unequipSlot(sol.id, 'headwear'))
    act(() => result.current.equipItem(sol.id, 'silk-bow'))
    let worn: ReturnType<typeof result.current.wearPreset> | undefined
    act(() => {
      worn = result.current.wearPreset(sol.id, look.id)
    })
    expect(worn).toEqual({ worn: ['flower-crown'], skipped: [] })
    // The look is the whole outfit: the bow it does not hold comes off.
    expect(garden().creatures[0].outfit).toEqual({ headwear: 'flower-crown' })

    act(() => result.current.renamePreset(look.id, 'Sunday crown'))
    expect(garden().outfitPresets?.[0].name).toBe('Sunday crown')
    const renamed = garden().outfitPresets![0]
    act(() => result.current.deletePreset(look.id))
    expect(garden().outfitPresets).toEqual([])
    act(() => result.current.restorePreset(renamed, 0))
    expect(garden().outfitPresets).toEqual([renamed])
  })

  it('wears nothing before the garden has loaded', () => {
    vi.spyOn(gardenRepository, 'load').mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useGardenState())
    expect(result.current.wearPreset('sol', 'look')).toEqual({ worn: [], skipped: [] })
  })

  it('refuses a purchase, and says so, when the balance cannot cover it', async () => {
    const { result } = await renderReady()
    const before = result.current.state
    let outcome: PurchaseOutcome | undefined
    act(() => {
      // 300 Leaf Bundles at 2 Nectar are 600, and the garden holds 500: the
      // whole lot is refused, not as many as the balance would stretch to.
      outcome = result.current.purchaseItem('leaf-bundle', 300)
    })
    expect(outcome).toEqual({ kind: 'short', currency: 'nectar', needed: 100 })
    expect(result.current.state).toBe(before)
  })

  it('tells a second purchase in the same moment about the first', async () => {
    const { result } = await renderReady()
    const outcomes: PurchaseOutcome[] = []
    act(() => {
      outcomes.push(result.current.purchaseItem('silk-bow'))
      outcomes.push(result.current.purchaseItem('silk-bow'))
    })
    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['bought', 'owned'])
    expect(result.current.state?.ownedItemIds.filter((id) => id === 'silk-bow')).toHaveLength(1)
  })

  it('buys nothing before the garden has loaded', () => {
    vi.spyOn(gardenRepository, 'load').mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useGardenState())
    expect(result.current.purchaseItem('leaf-bundle')).toEqual({
      kind: 'unavailable',
      reason: 'unknown',
    })
  })

  it('changes the gardener’s settings and scenes', async () => {
    const { result } = await renderReady()
    const profile = () => result.current.state!.profile!
    act(() => result.current.toggleTheme())
    act(() => result.current.toggleAmbientSound())
    act(() => result.current.selectAmbientTrack('piano-music'))
    act(() => result.current.updateProfile('Robin', 'Glade', 'calm'))
    act(() => result.current.markReleaseSeen('release-x'))
    act(() => result.current.selectBackdrop('cottage-bloom'))
    expect(profile()).toMatchObject({
      theme: 'night',
      ambientSound: true,
      ambientTrack: 'piano-music',
      name: 'Robin',
      gardenName: 'Glade',
      calmMotion: true,
      lastSeenReleaseId: 'release-x',
      selectedBackdropId: 'cottage-bloom',
    })
    act(() => result.current.selectCustomBackdrop(undefined))
    act(() => result.current.deleteCustomBackdrop('none'))
    expect(result.current.state!.customBackdrops).toEqual([])
  })

  it('exports the garden it holds as a backup file', async () => {
    const { result } = await renderReady()
    const file = JSON.parse(result.current.exportGarden()!) as { format: string; garden: { seeds: number } }
    expect(file.format).toBe('the-butterfly-garden')
    expect(file.garden.seeds).toBe(5)
  })

  it('remembers when a backup was kept, as of its export', async () => {
    const { result } = await renderReady()
    const madeAt = new Date('2026-10-27T08:00:00.000Z')
    act(() => result.current.recordBackup(madeAt))
    expect(result.current.state?.profile?.lastBackupAt).toBe(madeAt.toISOString())
    // The time is in the garden, so the next backup file carries it along.
    const file = JSON.parse(result.current.exportGarden()!) as {
      garden: { profile: { lastBackupAt?: string } }
    }
    expect(file.garden.profile.lastBackupAt).toBe(madeAt.toISOString())
  })

  it('refuses an image save it cannot make, saying why', async () => {
    const { result } = await renderReady()
    const answer = await result.current.saveCustomBackdrop({ id: 'x' } as never)
    expect(answer.ok).toBe(false)
    expect(answer.message).toBeTruthy()
  })
})

describe('the way back from a garden that could not be read', () => {
  async function renderWithheld() {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'withheld',
      state: createEmptyState(),
      reason: 'malformed',
    })
    const view = renderHook(() => useGardenState())
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    return view
  }

  const setAside = {
    id: 'q1',
    reason: 'malformed' as const,
    storedAt: '2026-10-01T10:00:00.000Z',
    raw: { profile: { name: 'Robin' } },
  }

  it('offers the newest set-aside copy as a file, and counts and discards them', async () => {
    const { result } = await renderWithheld()
    const quarantined = vi.spyOn(gardenRepository, 'quarantined').mockResolvedValue([])
    expect(await result.current.quarantinedCopy()).toBeUndefined()
    expect(await result.current.countQuarantined()).toBe(0)

    quarantined.mockResolvedValue([setAside])
    const copy = JSON.parse((await result.current.quarantinedCopy())!) as Record<string, unknown>
    expect(copy).toMatchObject({
      format: 'the-butterfly-garden-set-aside',
      reason: 'malformed',
      storedAt: setAside.storedAt,
      garden: setAside.raw,
    })
    expect(await result.current.countQuarantined()).toBe(1)

    const clear = vi.spyOn(gardenRepository, 'clearQuarantine').mockResolvedValue()
    await result.current.discardQuarantine()
    expect(clear).toHaveBeenCalledOnce()
  })

  it('starts a new garden only once the old one is set aside', async () => {
    const { result } = await renderWithheld()
    const quarantined = vi.spyOn(gardenRepository, 'quarantined').mockResolvedValue([])
    const prepare = vi.spyOn(gardenRepository, 'prepareFreshStart').mockResolvedValue()

    let outcome: { ok: boolean; message?: string } | undefined
    await act(async () => {
      outcome = await result.current.startFresh()
    })
    expect(outcome).toMatchObject({ ok: false, message: expect.stringMatching(/no set-aside copy/) })
    expect(prepare).not.toHaveBeenCalled()

    quarantined.mockResolvedValue([setAside])
    await act(async () => {
      outcome = await result.current.startFresh()
    })
    expect(outcome).toEqual({ ok: true })
    expect(result.current.persistence.readOnly).toBe(false)
    expect(result.current.state).toBeUndefined()
  })

  it('says why a new garden could not be started, rather than failing silently', async () => {
    const { result } = await renderWithheld()
    vi.spyOn(gardenRepository, 'quarantined').mockRejectedValueOnce(new Error('Storage is locked.'))
    let outcome: { ok: boolean; message?: string } | undefined
    await act(async () => {
      outcome = await result.current.startFresh()
    })
    expect(outcome).toEqual({ ok: false, message: 'Storage is locked.' })
    expect(result.current.persistence.readOnly).toBe(true)

    vi.spyOn(gardenRepository, 'quarantined').mockResolvedValue([setAside])
    vi.spyOn(gardenRepository, 'prepareFreshStart').mockRejectedValueOnce('no reason')
    await act(async () => {
      outcome = await result.current.startFresh()
    })
    expect(outcome).toEqual({ ok: false, message: 'Your garden could not be saved to this device.' })
  })

  it('still restores when the copy that would undo it cannot be found', async () => {
    const { result } = await renderWithheld()
    vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    vi.spyOn(gardenRepository, 'snapshots').mockRejectedValue(new Error('blocked'))
    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(
        JSON.stringify({ format: 'the-butterfly-garden', garden: createInitialState('Robin', 'Back Again') }),
      )
    })
    expect(outcome?.ok).toBe(true)
    expect(result.current.state?.profile?.gardenName).toBe('Back Again')
    expect(result.current.persistence).toMatchObject({ readOnly: false, lastRestoreSnapshotId: undefined })
  })

  it('refuses a file that is not JSON, and an undo it cannot make', async () => {
    const { result } = await renderWithheld()
    expect(await result.current.importGarden('not json')).toEqual({
      ok: false,
      message: 'That file is not a garden backup.',
    })

    vi.spyOn(gardenRepository, 'snapshot').mockResolvedValueOnce(undefined)
    expect(await result.current.undoRestore('missing')).toEqual({
      ok: false,
      message: 'The garden from before the restore could not be read.',
    })
    vi.spyOn(gardenRepository, 'snapshot').mockRejectedValueOnce(new Error('Gone.'))
    expect(await result.current.undoRestore('broken')).toEqual({ ok: false, message: 'Gone.' })
  })
})

describe('the edges of persistence', () => {
  const loaded = (seeds: number) => ({
    status: 'loaded' as const,
    state: { ...createInitialState('Tester', 'Test Garden'), seeds },
  })
  const withheld = (reason: 'unavailable' | 'malformed') => ({
    status: 'withheld' as const,
    state: createEmptyState(),
    reason,
  })

  async function renderLoaded(seeds = 2) {
    const load = vi.spyOn(gardenRepository, 'load').mockResolvedValue(loaded(seeds))
    const view = renderHook(() => useGardenState())
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    return { ...view, load }
  }

  /** Say something on the sync channel, as another tab would. */
  async function fromAnotherTab(message: unknown) {
    const other = new BroadcastChannel('butterfly-garden-sync')
    other.postMessage(message)
    other.close()
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
  }

  it('keeps trying storage that would not open, backing off, until it answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const load = vi
        .spyOn(gardenRepository, 'load')
        .mockResolvedValueOnce(withheld('unavailable'))
        .mockResolvedValueOnce(withheld('unavailable'))
        .mockResolvedValueOnce(loaded(9))
      const { result } = renderHook(() => useGardenState())
      await waitFor(() => expect(result.current.persistence.reason).toBe('unavailable'))

      await act(() => vi.advanceTimersByTimeAsync(1_000))
      expect(load).toHaveBeenCalledTimes(2)
      // The second wait is longer than the first.
      await act(() => vi.advanceTimersByTimeAsync(1_000))
      expect(load).toHaveBeenCalledTimes(2)
      await act(() => vi.advanceTimersByTimeAsync(1_000))
      expect(load).toHaveBeenCalledTimes(3)
      expect(result.current.state?.seeds).toBe(9)
      expect(result.current.persistence.readOnly).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops retrying, and says why, when storage answers with a garden it cannot read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.spyOn(gardenRepository, 'load')
        .mockResolvedValueOnce(withheld('unavailable'))
        .mockResolvedValueOnce(withheld('malformed'))
      const { result } = renderHook(() => useGardenState())
      await waitFor(() => expect(result.current.persistence.reason).toBe('unavailable'))
      await act(() => vi.advanceTimersByTimeAsync(1_000))
      expect(result.current.persistence).toMatchObject({ readOnly: true, reason: 'malformed' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops writing while another tab deletes, and resumes if that fails', async () => {
    const { result, load } = await renderLoaded(2)
    await fromAnotherTab({ type: 'garden-clearing' })
    expect(result.current.persistence).toMatchObject({ readOnly: true, reason: 'deleting' })

    load.mockResolvedValue(loaded(4))
    await fromAnotherTab({ type: 'garden-clear-failed' })
    await waitFor(() => expect(result.current.persistence.readOnly).toBe(false))
    expect(result.current.state?.seeds).toBe(4)
  })

  it('ignores news from other tabs while it cannot write, and messages it does not know', async () => {
    const { result } = await renderLoaded(2)
    const adopt = vi.spyOn(gardenRepository, 'adopt')
    await fromAnotherTab({ type: 'something-new' })
    await fromAnotherTab(undefined)
    expect(adopt).not.toHaveBeenCalled()

    await fromAnotherTab({ type: 'garden-clearing' })
    await fromAnotherTab({ type: 'garden-saved', parts: ['meta'] })
    expect(adopt).not.toHaveBeenCalled()
    expect(result.current.state?.seeds).toBe(2)
  })

  it('takes in what another tab saved', async () => {
    const { result } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'adopt').mockResolvedValue(loaded(6))
    await fromAnotherTab({ type: 'garden-saved', parts: ['meta'] })
    await waitFor(() => expect(result.current.state?.seeds).toBe(6))
  })

  it('pauses and retries when storage stops answering mid-sync', async () => {
    const { result, load } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'adopt').mockResolvedValue(withheld('unavailable'))
    load.mockResolvedValue(loaded(8))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await fromAnotherTab({ type: 'garden-saved', parts: ['meta'] })
      await waitFor(() => expect(result.current.persistence.reason).toBe('unavailable'))
      await act(() => vi.advanceTimersByTimeAsync(1_000))
      await waitFor(() => expect(result.current.state?.seeds).toBe(8))
      expect(result.current.persistence.readOnly).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('tells other tabs only about writes that changed something', async () => {
    const { result } = await renderLoaded(2)
    const posted: unknown[] = []
    vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation((message) => {
      posted.push(message)
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValueOnce([])
    act(() => result.current.toggleTheme())
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(posted).toEqual([])

    save.mockResolvedValueOnce(['meta'])
    act(() => result.current.toggleTheme())
    await waitFor(() => expect(posted).toEqual([{ type: 'garden-saved', parts: ['meta'] }]))
  })

  it('starts again from nothing when a write finds the garden deleted elsewhere', async () => {
    const { result } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'save').mockRejectedValue(new GardenDeletedElsewhereError())
    act(() => result.current.toggleTheme())
    await waitFor(() => expect(result.current.state).toBeUndefined())
    expect(result.current.persistence.notice).toMatch(/deleted in another tab/)
  })

  it('pauses when another tab wrote first and its garden cannot be read back', async () => {
    const { result, load } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'save').mockRejectedValue(new GardenConflictError())
    load.mockResolvedValue(withheld('malformed'))
    act(() => result.current.toggleTheme())
    await waitFor(() => expect(result.current.persistence.readOnly).toBe(true))
    expect(result.current.persistence.reason).toBe('malformed')
    expect(result.current.persistence.notice).toMatch(/another tab/i)
  })

  it('moves the garden on when the gardener comes back to it', async () => {
    const { result } = await renderLoaded(2)
    const before = result.current.state
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Nothing was due, so the garden is the same garden.
    expect(result.current.state).toEqual(before)
  })

  it('names what a refused backup lacks, and counts what it repaired', async () => {
    const { result } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    const refused = await result.current.importGarden(JSON.stringify({ garden: { version: 99 } }))
    expect(refused).toMatchObject({ ok: false, message: expect.stringMatching(/^That backup could not be restored\./) })

    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(
        JSON.stringify({
          format: 'the-butterfly-garden',
          garden: { ...createInitialState('Robin', 'Mended'), goals: [null] },
        }),
      )
    })
    expect(outcome?.message).toMatch(/1 damaged entry was repaired/)
  })

  it('checks a backup’s images before replacing anything', async () => {
    const { result } = await renderLoaded(2)
    const replace = vi.spyOn(gardenRepository, 'replace')
    const outcome = await result.current.importGarden(
      JSON.stringify({
        format: 'the-butterfly-garden',
        garden: {
          ...createInitialState('Robin', 'Pictured'),
          customBackdrops: [
            {
              id: 'scene',
              name: 'Not a picture',
              createdAt: '2026-09-08T00:00:00Z',
              updatedAt: '2026-09-08T00:00:00Z',
              mimeType: 'image/png',
              width: 1,
              height: 1,
              byteLength: 3,
              imageData: 'YWJj',
              crop: { x: 0.5, y: 0.5, zoom: 1 },
            },
          ],
        },
      }),
    )
    expect(outcome).toEqual({ ok: false, message: 'This file is not a readable JPEG, PNG or WebP image.' })
    expect(replace).not.toHaveBeenCalled()
  })

  it('says why a deletion did not happen, and lets other tabs carry on', async () => {
    const { result } = await renderLoaded(2)
    const posted: string[] = []
    vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation((message) => {
      posted.push((message as { type: string }).type)
    })
    vi.spyOn(gardenRepository, 'clear').mockRejectedValueOnce(new Error('Storage is locked.'))
    let outcome: { ok: boolean; message?: string } | undefined
    await act(async () => {
      outcome = await result.current.deleteAll()
    })
    expect(outcome).toEqual({ ok: false, message: 'Storage is locked.' })
    expect(posted).toEqual(['garden-clearing', 'garden-clear-failed'])
    expect(result.current.state?.seeds).toBe(2)
  })

  it('treats a deletion waiting on another tab as done here', async () => {
    const { result } = await renderLoaded(2)
    vi.spyOn(gardenRepository, 'clear').mockRejectedValueOnce(new GardenDeletionPendingError())
    let outcome: { ok: boolean; message?: string } | undefined
    await act(async () => {
      outcome = await result.current.deleteAll()
    })
    expect(outcome?.ok).toBe(false)
    expect(result.current.state).toBeUndefined()
    expect(result.current.persistence.notice).toBe(outcome?.message)
  })
})

describe('saving one of the gardener’s images', () => {
  const image = (id = 'scene') => ({
    id,
    name: 'My image',
    createdAt: '2026-09-08T00:00:00Z',
    updatedAt: '2026-09-08T00:00:00Z',
    mimeType: 'image/png' as const,
    width: 1,
    height: 1,
    byteLength: 3,
    imageData: 'YWJj',
    crop: { x: 0.5, y: 0.5, zoom: 1 },
  })

  async function renderWith(overrides: Partial<ReturnType<typeof createInitialState>> = {}) {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: { ...createInitialState('Tester', 'Garden'), ...overrides },
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const view = renderHook(() => useGardenState())
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    return { ...view, save }
  }

  it('refuses a fourth image, but replaces one it already holds', async () => {
    const { result } = await renderWith({ customBackdrops: [image('a'), image('b'), image('c')] })
    expect(await result.current.saveCustomBackdrop(image('d'))).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Remove one to add another/),
    })
    let saved: Promise<{ ok: boolean }> | undefined
    act(() => {
      saved = result.current.saveCustomBackdrop({ ...image('b'), name: 'Renamed' })
    })
    expect(await saved).toEqual({ ok: true })
    expect(result.current.state?.customBackdrops.find((entry) => entry.id === 'b')?.name).toBe('Renamed')
  })

  it('waits for one image before taking another', async () => {
    const { result, save } = await renderWith()
    save.mockImplementation(() => new Promise(() => undefined))
    act(() => {
      void result.current.saveCustomBackdrop(image('first'))
    })
    expect(await result.current.saveCustomBackdrop(image('second'))).toEqual({
      ok: false,
      message: 'Another image is still saving. Please wait a moment.',
    })
  })

  it('refuses while the garden is read-only', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue(
      { status: 'withheld', state: createEmptyState(), reason: 'malformed' },
    )
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect((await result.current.saveCustomBackdrop(image())).message).toMatch(/read-only/)
  })

  it('refuses when there is no garden any more', async () => {
    const { result } = await renderWith()
    const other = new BroadcastChannel('butterfly-garden-sync')
    other.postMessage({ type: 'garden-cleared' })
    other.close()
    await waitFor(() => expect(result.current.state).toBeUndefined())
    expect(await result.current.saveCustomBackdrop(image())).toEqual({
      ok: false,
      message: 'Open your garden first.',
    })
    // Actions that change a garden do nothing without one.
    act(() => result.current.toggleTheme())
    expect(result.current.state).toBeUndefined()
  })

  it('chooses an image to show, and goes back to the scene', async () => {
    const { result } = await renderWith({ customBackdrops: [image('a')] })
    act(() => result.current.selectCustomBackdrop('a'))
    expect(result.current.state?.profile?.selectedCustomBackdropId).toBe('a')
    act(() => result.current.selectCustomBackdrop(undefined))
    expect(result.current.state?.profile?.selectedCustomBackdropId).toBeUndefined()
  })

  it('clears a notice when a new garden begins', async () => {
    const { result } = await renderWith()
    const other = new BroadcastChannel('butterfly-garden-sync')
    other.postMessage({ type: 'garden-cleared' })
    other.close()
    await waitFor(() => expect(result.current.persistence.notice).toBeDefined())
    act(() => result.current.onboard('Robin', 'Second Garden'))
    expect(result.current.persistence.notice).toBeUndefined()
    expect(result.current.state?.profile?.gardenName).toBe('Second Garden')
  })
})

describe('the day the garden was opened', () => {
  function lastVisited(daysAgo: number) {
    const seed = createInitialState('Tester', 'Test Garden')
    const lastVisitOn = toLocalDate(new Date(Date.now() - daysAgo * 86_400_000))
    return { ...seed, profile: { ...seed.profile!, lastVisitOn } }
  }

  it('is noted once, in one write, with a welcome after a few days away', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: lastVisited(4),
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])
    const heard: string[] = []
    const stop = onAnnouncement((events) => heard.push(...events.map((event) => event.kind)))
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.state?.profile?.lastVisitOn).toBe(toLocalDate()))
    expect(result.current.state?.profile?.welcomeBackOn).toBe(toLocalDate())
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))

    // Coming back into view the same day writes nothing more, and never loops.
    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(save).toHaveBeenCalledTimes(1)
    // A visit is not a moment to celebrate.
    expect(heard).toEqual([])
    stop()

    act(() => result.current.putAwayWelcomeBack())
    expect(result.current.state?.profile).not.toHaveProperty('welcomeBackOn')
    expect(result.current.state?.profile?.lastVisitOn).toBe(toLocalDate())
  })

  it('writes nothing for a garden already visited today', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: lastVisited(0),
    })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue(['meta'])
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(save).not.toHaveBeenCalled()
    expect(result.current.state?.profile).not.toHaveProperty('welcomeBackOn')
  })

  it('is noted when an app left open comes back into view on a later day', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    try {
      vi.setSystemTime(new Date(2026, 9, 20, 9))
      vi.spyOn(gardenRepository, 'load').mockResolvedValue({
        status: 'loaded',
        state: createInitialState('Tester', 'Test Garden'),
      })
      vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
      const { result } = renderHook(() => useGardenState())
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.state?.profile?.lastVisitOn).toBe('2026-10-20')

      // Days later, in the background: nobody is looking, so nothing is noted.
      vi.setSystemTime(new Date(2026, 9, 24, 8))
      const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(result.current.state?.profile?.lastVisitOn).toBe('2026-10-20')

      visibility.mockReturnValue('visible')
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(result.current.state?.profile).toMatchObject({
        lastVisitOn: '2026-10-24',
        welcomeBackOn: '2026-10-24',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('chooses the garden pace', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: lastVisited(0),
    })
    vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setGardenPace('keep-giving'))
    expect(result.current.state?.profile?.gardenPace).toBe('keep-giving')
    act(() => result.current.setGardenPace(undefined))
    expect(result.current.state?.profile).not.toHaveProperty('gardenPace')
  })
})
