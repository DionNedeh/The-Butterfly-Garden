import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GARDEN_COLLECTIONS,
  gardenRepository,
} from '../repository/gardenRepository'
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
      <span data-testid="write-error">{garden.persistence.writeError ?? ''}</span>
      <span data-testid="seeds">{garden.state?.seeds ?? ''}</span>
      <button onClick={() => garden.onboard('Tester', 'Test Garden')}>Onboard</button>
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
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

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
      .mockRejectedValue(new Error('The garden could not be saved to this device.'))

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

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
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
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
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

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

    const announcement = posted.find((message) => message.type === 'garden-saved')
    expect(announcement).toBeDefined()
    expect(announcement?.parts).toEqual(['meta', ...GARDEN_COLLECTIONS])
  })
})

