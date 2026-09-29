import { afterEach, describe, expect, it, vi } from 'vitest'

// Stand-ins for Capacitor. What matters here is what the app asks of it.
const listeners = vi.hoisted(() => new Map<string, (data: unknown) => void>())
const remove = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const saveDocument = vi.hoisted(() => vi.fn())
const setStyle = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const minimizeApp = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const registerPlugin = vi.hoisted(() => vi.fn(() => ({ saveDocument })))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string, handler: (data: unknown) => void) => {
      listeners.set(event, handler)
      return Promise.resolve({ remove })
    }),
    minimizeApp,
  },
}))
vi.mock('@capacitor/core', () => ({
  registerPlugin,
  SystemBars: { setStyle },
  SystemBarsStyle: { Dark: 'DARK', Light: 'LIGHT' },
}))

/** A fresh copy of the module, so cached plugins do not leak between tests. */
async function loadNative() {
  vi.resetModules()
  return import('./native')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  listeners.clear()
})

describe('native bridge in the PWA', () => {
  it('does nothing and never touches Capacitor', async () => {
    const native = await loadNative()
    const handler = vi.fn()
    const unsubscribe = native.onBackButton(handler)
    native.onAppActiveChange(handler)
    await native.leaveApp()
    await native.setSystemBarsForTheme(true)
    unsubscribe()
    const { App } = await import('@capacitor/app')
    expect(App.addListener).not.toHaveBeenCalled()
    expect(minimizeApp).not.toHaveBeenCalled()
    expect(setStyle).not.toHaveBeenCalled()
    await expect(
      native.saveTextDocument('a.json', 'application/json', '{}'),
    ).rejects.toThrow(/only available in the app/)
  })
})

describe('native bridge in the Android app', () => {
  it('hands the back gesture to the handler until unsubscribed', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const native = await loadNative()
    const handler = vi.fn()
    const unsubscribe = native.onBackButton(handler)
    await vi.waitFor(() => expect(listeners.has('backButton')).toBe(true))
    listeners.get('backButton')?.({ canGoBack: false })
    expect(handler).toHaveBeenCalledOnce()
    unsubscribe()
    expect(remove).toHaveBeenCalledOnce()
  })

  it('still removes a listener whose owner left before it was attached', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const native = await loadNative()
    const unsubscribe = native.onBackButton(vi.fn())
    unsubscribe()
    await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce())
  })

  it('reports whether the app is in the foreground', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const native = await loadNative()
    const handler = vi.fn()
    native.onAppActiveChange(handler)
    await vi.waitFor(() => expect(listeners.has('appStateChange')).toBe(true))
    listeners.get('appStateChange')?.({ isActive: false })
    listeners.get('appStateChange')?.({ isActive: true })
    expect(handler.mock.calls).toEqual([[false], [true]])
  })

  it('attaches every listener even when asked for them at once', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const native = await loadNative()
    native.onBackButton(vi.fn())
    native.onAppActiveChange(vi.fn())
    await vi.waitFor(() => {
      expect(listeners.has('backButton')).toBe(true)
      expect(listeners.has('appStateChange')).toBe(true)
    })
  })

  it('leaves the app by minimising it, and shrugs off a refusal', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const native = await loadNative()
    await native.leaveApp()
    expect(minimizeApp).toHaveBeenCalledOnce()
    minimizeApp.mockRejectedValueOnce(new Error('not now'))
    await expect(native.leaveApp()).resolves.toBeUndefined()
  })

  it('matches the status-bar icons to the garden theme', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const native = await loadNative()
    await native.setSystemBarsForTheme(true)
    await native.setSystemBarsForTheme(false)
    expect(setStyle.mock.calls).toEqual([
      [{ style: 'DARK' }],
      [{ style: 'LIGHT' }],
    ])
  })

  it('saves a document through one GardenFiles plugin and reports the outcome', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const native = await loadNative()
    saveDocument.mockResolvedValueOnce({ saved: true })
    saveDocument.mockResolvedValueOnce({ saved: false })
    await expect(
      native.saveTextDocument('garden.json', 'application/json', '{"a":1}'),
    ).resolves.toBe(true)
    await expect(
      native.saveTextDocument('garden.json', 'application/json', '{"a":1}'),
    ).resolves.toBe(false)
    expect(registerPlugin).toHaveBeenCalledOnce()
    expect(registerPlugin).toHaveBeenCalledWith('GardenFiles')
    expect(saveDocument).toHaveBeenCalledWith({
      fileName: 'garden.json',
      mimeType: 'application/json',
      text: '{"a":1}',
    })
  })
})
