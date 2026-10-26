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
  gardenRepository,
} from '../repository/gardenRepository'
import { onAnnouncement } from '../lib/announcer'
import { createEmptyState, createInitialState } from '../lib/progression'
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
