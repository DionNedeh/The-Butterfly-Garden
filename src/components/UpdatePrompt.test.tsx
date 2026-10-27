import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reloadForUpdate, reloadOtherTabs } from '../lib/appUpdate'
import { UpdatePrompt } from './UpdatePrompt'

interface RegisterOptions {
  onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void
  onNeedReload?: () => void
}

/** The service worker as the plugin reports it, steered by each test. */
const sw = vi.hoisted(() => ({
  waiting: false,
  options: undefined as RegisterOptions | undefined,
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}))

vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react')
  return {
    useRegisterSW: (options: RegisterOptions) => {
      sw.options = options
      const [needRefresh, setNeedRefresh] = useState(sw.waiting)
      return {
        needRefresh: [needRefresh, setNeedRefresh],
        offlineReady: [false, () => undefined],
        updateServiceWorker: sw.updateServiceWorker,
      }
    },
  }
})

vi.mock('../lib/appUpdate', async (original) => ({
  ...(await original<typeof import('../lib/appUpdate')>()),
  reloadForUpdate: vi.fn(() => Promise.resolve()),
  reloadOtherTabs: vi.fn(),
}))

afterEach(() => {
  sw.waiting = false
  sw.options = undefined
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('the offer of a new version', () => {
  it('shows nothing until a new version is waiting', () => {
    render(<UpdatePrompt />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says every open tab reloads together when the gardener updates', () => {
    sw.waiting = true
    render(<UpdatePrompt />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'A fresh garden update is ready.Updating reloads every open garden tab together.',
    )
  })

  it('applies the update, then reloads this tab and every other with it', async () => {
    sw.waiting = true
    const user = userEvent.setup()
    render(<UpdatePrompt />)
    await user.click(screen.getByRole('button', { name: 'Update now' }))
    expect(sw.updateServiceWorker).toHaveBeenCalledOnce()
    expect(reloadForUpdate).not.toHaveBeenCalled()
    // The new version has taken over this tab.
    act(() => sw.options?.onNeedReload?.())
    expect(reloadOtherTabs).toHaveBeenCalledOnce()
    expect(reloadForUpdate).toHaveBeenCalledOnce()
  })

  it('reloads a tab the new version took over without telling the others', () => {
    render(<UpdatePrompt />)
    act(() => sw.options?.onNeedReload?.())
    expect(reloadForUpdate).toHaveBeenCalledOnce()
    expect(reloadOtherTabs).not.toHaveBeenCalled()
  })

  it('reloads every tab anyway if the new version never says it took over', async () => {
    vi.useFakeTimers()
    sw.waiting = true
    render(<UpdatePrompt />)
    act(() => screen.getByRole('button', { name: 'Update now' }).click())
    await vi.advanceTimersByTimeAsync(3_999)
    expect(reloadForUpdate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(reloadOtherTabs).toHaveBeenCalledOnce()
    expect(reloadForUpdate).toHaveBeenCalledOnce()
  })

  it('waits for Later, handing focus to the page’s heading as it goes', async () => {
    sw.waiting = true
    const user = userEvent.setup()
    const main = document.createElement('main')
    main.id = 'main-content'
    main.innerHTML = '<h1>Today</h1>'
    document.body.append(main)
    render(<UpdatePrompt />)
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Today' })).toHaveFocus()
    expect(sw.updateServiceWorker).not.toHaveBeenCalled()
    main.remove()
  })

  it('looks for a new version every hour once the service worker is registered', () => {
    vi.useFakeTimers()
    const update = vi.fn(() => Promise.resolve())
    render(<UpdatePrompt />)
    act(() =>
      sw.options?.onRegisteredSW?.('sw.js', { installing: null, update } as unknown as ServiceWorkerRegistration),
    )
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(update).toHaveBeenCalledOnce()
  })
})
