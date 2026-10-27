import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatBytes,
  isAppleMobileBrowser,
  isInstalledApp,
  requestPersistentStorage,
  storageStatus,
} from './storage'

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { ...navigator, storage })
}

describe('asking the browser to keep the garden', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not ask again once storage is protected', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    stubStorage({ persisted: () => Promise.resolve(true), persist })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('asks, and reports the answer', async () => {
    stubStorage({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false) })
    expect(await requestPersistentStorage()).toBe(false)
    stubStorage({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(true) })
    expect(await requestPersistentStorage()).toBe(true)
  })

  it('treats a refusal or a missing API as an answer, never an error', async () => {
    stubStorage({ persist: () => Promise.reject(new Error('denied')) })
    expect(await requestPersistentStorage()).toBe(false)
    stubStorage(undefined)
    expect(await requestPersistentStorage()).toBe(false)
  })
})

describe('reporting storage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('says whether the garden is protected and how much it uses', async () => {
    stubStorage({
      persisted: () => Promise.resolve(true),
      estimate: () => Promise.resolve({ usage: 2048, quota: 10_000_000 }),
    })
    expect(await storageStatus()).toEqual({ protection: 'protected', usage: 2048, quota: 10_000_000 })
    stubStorage({ persisted: () => Promise.resolve(false) })
    expect(await storageStatus()).toEqual({ protection: 'best-effort' })
  })

  it('stays calm when the browser will not say', async () => {
    stubStorage({
      persisted: () => Promise.reject(new Error('no')),
      estimate: () => Promise.reject(new Error('no')),
    })
    expect(await storageStatus()).toEqual({ protection: 'unknown' })
    stubStorage(undefined)
    expect(await storageStatus()).toEqual({ protection: 'unknown' })
  })

  it('writes sizes for people', () => {
    expect(formatBytes(512)).toBe('512 bytes')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB')
    expect(formatBytes(3 * 1024 ** 4)).toBe('3072 GB')
  })
})

describe('where the app is running', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('recognises an iPhone, and an iPad that says it is a Mac', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })
    expect(isAppleMobileBrowser()).toBe(true)
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      maxTouchPoints: 5,
    })
    expect(isAppleMobileBrowser()).toBe(true)
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', maxTouchPoints: 0 })
    expect(isAppleMobileBrowser()).toBe(false)
  })

  it('knows an installed app from a browser tab', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('standalone') }))
    expect(isInstalledApp()).toBe(true)
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(isInstalledApp()).toBe(false)
    vi.stubGlobal('navigator', { ...navigator, standalone: true })
    expect(isInstalledApp()).toBe(true)
  })
})
