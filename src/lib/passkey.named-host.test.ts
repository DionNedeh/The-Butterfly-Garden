// @vitest-environment-options { "url": "https://garden-2.example.org/The-Butterfly-Garden/" }
import { afterEach, describe, expect, it, vi } from 'vitest'
import { passkeysOffered } from './passkey'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('3.3 a passkey on a garden served by name', () => {
  it('is offered, digits, dots and all, where the browser has PRF', async () => {
    expect(location.hostname).toBe('garden-2.example.org')
    vi.stubGlobal(
      'PublicKeyCredential',
      Object.assign(function PublicKeyCredential() {}, {
        getClientCapabilities: () => Promise.resolve({ 'extension:prf': true }),
      }),
    )
    vi.stubGlobal('navigator', { ...navigator, credentials: { create: vi.fn(), get: vi.fn() } })
    expect(await passkeysOffered()).toBe(true)
  })
})
