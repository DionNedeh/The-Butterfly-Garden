import { afterEach, describe, expect, it, vi } from 'vitest'
import { arrivalUrl, isArrival, isFramed, movedTo } from './hosting'

describe('the old address and the new one', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('stays dormant in every ordinary build', () => {
    vi.stubEnv('VITE_MOVED_TO', '')
    expect(movedTo()).toBeUndefined()
  })

  it('names the new address only when it is a real https one', () => {
    vi.stubEnv('VITE_MOVED_TO', 'https://garden.example.org/')
    expect(movedTo()?.host).toBe('garden.example.org')
    vi.stubEnv('VITE_MOVED_TO', 'http://garden.example.org/')
    expect(movedTo()).toBeUndefined()
    vi.stubEnv('VITE_MOVED_TO', 'not a url')
    expect(movedTo()).toBeUndefined()
  })

  it('never shows the move in the Android app, which has no address', () => {
    vi.stubEnv('VITE_MOVED_TO', 'https://garden.example.org/')
    vi.stubEnv('VITE_PLATFORM', 'android')
    expect(movedTo()).toBeUndefined()
  })

  it('opens the new address ready to take a backup', () => {
    const url = arrivalUrl(new URL('https://garden.example.org/app/?x=1#/old'))
    expect(url).toBe('https://garden.example.org/app/?x=1#/arrive')
    expect(isArrival({ hash: '#/arrive' })).toBe(true)
    expect(isArrival({ hash: '' })).toBe(false)
  })
})

describe('inside another page', () => {
  it('knows when it is framed, and treats a refused look as framed', () => {
    const self = {}
    expect(isFramed({ self, top: self })).toBe(false)
    expect(isFramed({ self, top: {} })).toBe(true)
    const hostile = {
      self,
      get top(): unknown {
        throw new Error('cross-origin')
      },
    }
    expect(isFramed(hostile)).toBe(true)
  })

  it('is not framed in an ordinary page', () => {
    expect(isFramed()).toBe(false)
  })
})
