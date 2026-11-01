import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gardenRepository } from '../repository/gardenRepository'
import { useDraftKept } from './draftKept'
import { loadDrafts, resetDrafts, setDraft } from './drafts'

// The drafts' channel opens as lib/drafts loads, so the stand-in goes first.
const { FakeBroadcastChannel } = await vi.hoisted(async () => {
  const fake = await import('../test/fakeBroadcastChannel')
  vi.stubGlobal('BroadcastChannel', fake.FakeBroadcastChannel)
  return fake
})

/*
 * 6.2: every tab writes all of its own drafts over the one stored record, so
 * once another tab has written, this tab's words may no longer be in storage.
 * "Draft kept" must not go on claiming them until this tab writes them again.
 */
const KEY = 'reflection:2026-10-26'
const CHANNEL = 'butterfly-garden-drafts'
const tabs: InstanceType<typeof FakeBroadcastChannel>[] = []

/** Another tab's end of the drafts' channel. */
function otherTab() {
  const tab = new FakeBroadcastChannel(CHANNEL)
  tabs.push(tab)
  return tab
}

/** A write the test settles: true once written, as the repository says it. */
function heldWrites() {
  const writes: Array<(written: true | void) => void> = []
  vi.spyOn(gardenRepository, 'writeDrafts').mockImplementation(
    () =>
      new Promise<true | void>((resolve) => {
        writes.push(resolve)
      }),
  )
  return (index: number, written: true | void) =>
    act(async () => {
      writes[index](written)
      await Promise.resolve()
    })
}

/** Type a draft and let the pause after it pass, so it is written. */
function typeAndPause(value: string) {
  act(() => setDraft(KEY, value))
  act(() => {
    vi.advanceTimersByTime(600)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  for (const tab of tabs.splice(0)) tab.close()
  resetDrafts()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('6.2 a draft kept, with another tab open', () => {
  it('is no longer kept once another tab has written its drafts, until this tab writes again', async () => {
    const settle = heldWrites()
    const { result } = renderHook(() => useDraftKept(KEY))
    typeAndPause('Mine')
    await settle(0, true)
    expect(result.current).toBe(true)

    act(() => otherTab().postMessage(null))
    expect(result.current).toBe(false)

    typeAndPause('Mine, and more')
    await settle(1, true)
    expect(result.current).toBe(true)
  })

  it('is not kept by a write still under way when another tab wrote', async () => {
    const settle = heldWrites()
    const { result } = renderHook(() => useDraftKept(KEY))
    typeAndPause('Racing')
    // The other tab's write may have landed after this one.
    act(() => otherTab().postMessage(null))
    await settle(0, true)
    expect(result.current).toBe(false)
  })

  it('is not kept from a read that another tab wrote during', async () => {
    let read: (drafts: Record<string, string>) => void = () => undefined
    vi.spyOn(gardenRepository, 'readDrafts').mockReturnValue(
      new Promise((resolve) => {
        read = resolve
      }),
    )
    const { result } = renderHook(() => useDraftKept(KEY))
    let loading: Promise<void> = Promise.resolve()
    act(() => {
      loading = loadDrafts()
    })
    act(() => otherTab().postMessage(null))
    await act(async () => {
      read({ [KEY]: 'From before the reload' })
      await loading
    })
    expect(result.current).toBe(false)
  })

  it('tells the other tabs once its drafts are stored, and not when they were kept out', async () => {
    const settle = heldWrites()
    const heard = vi.fn()
    otherTab().onmessage = heard
    typeAndPause('Kept out by the lock')
    await settle(0, undefined)
    expect(heard).not.toHaveBeenCalled()

    typeAndPause('Stored')
    await settle(1, true)
    expect(heard).toHaveBeenCalledTimes(1)
  })
})
