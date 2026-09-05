import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from './id'

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createId', () => {
  it('uses the platform generator when it is available', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID })
    expect(createId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('still produces ids outside a secure context', () => {
    // randomUUID is only defined over https or on localhost; a phone pointed
    // at a dev server on the LAN has getRandomValues but not randomUUID.
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    })
    const id = createId()
    expect(id).toMatch(UUID_SHAPE)
  })

  it('falls back again when no crypto object exists at all', () => {
    vi.stubGlobal('crypto', undefined)
    const ids = new Set(Array.from({ length: 500 }, () => createId()))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id).toMatch(UUID_SHAPE)
  })
})
