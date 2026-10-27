import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeBroadcastChannel } from '../test/fakeBroadcastChannel'

vi.mock('./reload', () => ({ reloadApp: vi.fn() }))

/**
 * A fresh copy of the update module and what it leans on: a tab reloads only
 * once, so each test starts as a newly opened tab.
 */
async function freshTab() {
  vi.resetModules()
  const update = await import('./appUpdate')
  const { reloadApp } = await import('./reload')
  const drafts = await import('./drafts')
  const { gardenRepository } = await import('../repository/gardenRepository')
  return { ...update, reloadApp: vi.mocked(reloadApp), drafts, gardenRepository }
}

/** A promise and the means to settle it, to hold a write in flight. */
function held() {
  let settle: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(() => {
  FakeBroadcastChannel.open.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // The mocked reload outlives each fresh copy of the modules.
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('when to look for an update', () => {
  it('looks again only once an hour has passed', async () => {
    const { updateCheckDue, UPDATE_CHECK_INTERVAL_MS } = await freshTab()
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(60 * 60 * 1000)
    expect(updateCheckDue(0, 59 * 60 * 1000)).toBe(false)
    expect(updateCheckDue(0, 60 * 60 * 1000)).toBe(true)
    expect(updateCheckDue(1_000, 3 * 60 * 60 * 1000)).toBe(true)
  })
})

describe('reloading for an update', () => {
  it('waits for an unsaved draft and a write in flight before it reloads', async () => {
    const tab = await freshTab()
    const draftWrite = held()
    const gardenWrite = held()
    const writeDrafts = vi
      .spyOn(tab.gardenRepository, 'writeDrafts')
      .mockReturnValue(draftWrite.promise)
    vi.spyOn(tab.gardenRepository, 'settled').mockReturnValue(gardenWrite.promise)
    tab.drafts.setDraft('reflection:2026-10-27', 'Words not yet written down')

    const reloading = tab.reloadForUpdate()
    await Promise.resolve()
    // The draft is written now, not after typing would have paused.
    expect(writeDrafts).toHaveBeenCalledWith({
      'reflection:2026-10-27': 'Words not yet written down',
    })
    expect(tab.reloadApp).not.toHaveBeenCalled()
    draftWrite.settle()
    await Promise.resolve()
    expect(tab.reloadApp).not.toHaveBeenCalled()
    gardenWrite.settle()
    await reloading
    expect(tab.reloadApp).toHaveBeenCalledOnce()
  })

  it('reloads once, however often it is asked', async () => {
    const tab = await freshTab()
    await Promise.all([tab.reloadForUpdate(), tab.reloadForUpdate()])
    await tab.reloadForUpdate()
    expect(tab.reloadApp).toHaveBeenCalledOnce()
  })

  it('does not wait forever on a write that is stuck', async () => {
    const tab = await freshTab()
    vi.useFakeTimers()
    vi.spyOn(tab.gardenRepository, 'settled').mockReturnValue(new Promise<void>(() => undefined))
    const reloading = tab.reloadForUpdate()
    await vi.advanceTimersByTimeAsync(2_999)
    expect(tab.reloadApp).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await reloading
    expect(tab.reloadApp).toHaveBeenCalledOnce()
  })
})

describe('every tab together', () => {
  it("reloads this tab when another applies an update, and stops listening when asked", async () => {
    const tab = await freshTab()
    const stop = tab.followUpdates()
    // Another tab's message, sent from a channel of its own.
    tab.reloadOtherTabs()
    await vi.waitFor(() => expect(tab.reloadApp).toHaveBeenCalledOnce())
    stop()
    expect(FakeBroadcastChannel.named('butterfly-garden-update')).toHaveLength(0)
  })

  it('flushes the drafts of the tab told to reload', async () => {
    const tab = await freshTab()
    const write = vi.spyOn(tab.gardenRepository, 'writeDrafts').mockResolvedValue()
    tab.drafts.setDraft('recap:2026-10-26:wentWell', 'Half way through the recap')
    tab.followUpdates()
    tab.reloadOtherTabs()
    await vi.waitFor(() => expect(tab.reloadApp).toHaveBeenCalledOnce())
    expect(write).toHaveBeenCalledWith({ 'recap:2026-10-26:wentWell': 'Half way through the recap' })
  })

  it('listens on its own channel, and ignores anything else said there', async () => {
    const tab = await freshTab()
    tab.followUpdates()
    // The garden's sync channel is another channel altogether.
    new FakeBroadcastChannel('butterfly-garden-sync').postMessage({ type: 'reload-for-update' })
    const other = new FakeBroadcastChannel('butterfly-garden-update')
    other.postMessage({ type: 'garden-saved' })
    other.postMessage(undefined)
    await Promise.resolve()
    expect(tab.reloadApp).not.toHaveBeenCalled()
    other.postMessage({ type: 'reload-for-update' })
    await vi.waitFor(() => expect(tab.reloadApp).toHaveBeenCalledOnce())
  })

  it('leaves the sender’s channel closed once it has spoken', async () => {
    const tab = await freshTab()
    tab.reloadOtherTabs()
    expect(FakeBroadcastChannel.named('butterfly-garden-update')).toHaveLength(0)
  })

  it('does nothing, and breaks nothing, where tabs cannot talk', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const tab = await freshTab()
    const stop = tab.followUpdates()
    expect(() => tab.reloadOtherTabs()).not.toThrow()
    stop()
    expect(tab.reloadApp).not.toHaveBeenCalled()
  })
})
