import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A stand-in for the browser's image loader: jsdom never loads images. */
class FakeImage {
  static created: FakeImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  decoded = false
  src = ''
  constructor() {
    FakeImage.created.push(this)
  }
  decode() {
    this.decoded = true
    return Promise.resolve()
  }
}

async function freshModule() {
  vi.resetModules()
  return import('./backdropAssets')
}

describe('loading a garden scene', () => {
  beforeEach(() => {
    FakeImage.created = []
    vi.stubGlobal('Image', FakeImage)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('decodes a scene once, and shares one download between callers', async () => {
    const { isBackdropReady, loadBackdrop } = await freshModule()
    const first = loadBackdrop('cottage-bloom')
    const second = loadBackdrop('cottage-bloom')
    expect(FakeImage.created).toHaveLength(1)
    expect(isBackdropReady('cottage-bloom')).toBe(false)

    FakeImage.created[0].onload?.()
    await Promise.all([first, second])
    expect(FakeImage.created[0].decoded).toBe(true)
    expect(isBackdropReady('cottage-bloom')).toBe(true)

    // Ready scenes need nothing more: no new request at all.
    await loadBackdrop('cottage-bloom')
    expect(FakeImage.created).toHaveLength(1)
  })

  it('gives up on a stalled scene instead of waiting for ever', async () => {
    vi.useFakeTimers()
    const { BACKDROP_TIMEOUT_MS, isBackdropReady, loadBackdrop } = await freshModule()
    const load = loadBackdrop('twilight-orchard')
    const outcome = expect(load).rejects.toThrow(/taking too long/)
    vi.advanceTimersByTime(BACKDROP_TIMEOUT_MS)
    await outcome
    expect(isBackdropReady('twilight-orchard')).toBe(false)

    // A later attempt starts afresh rather than reusing the failure.
    void loadBackdrop('twilight-orchard').catch(() => undefined)
    expect(FakeImage.created).toHaveLength(2)
  })

  it('reports a scene that could not be fetched', async () => {
    const { loadBackdrop } = await freshModule()
    const load = loadBackdrop('cloud-garden')
    FakeImage.created[0].onerror?.()
    await expect(load).rejects.toThrow(/offline/)
  })
})
