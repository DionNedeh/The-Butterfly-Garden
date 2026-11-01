// @vitest-environment-options { "url": "http://127.0.0.1:4173/The-Butterfly-Garden/" }
import { afterEach, describe, expect, it, vi } from 'vitest'
import { passkeysOffered } from './passkey'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('3.3 a passkey on a garden served from an IP address', () => {
  it('is not offered, though the browser says it has PRF: WebAuthn refuses such a site', async () => {
    expect(location.hostname).toBe('127.0.0.1')
    vi.stubGlobal(
      'PublicKeyCredential',
      Object.assign(function PublicKeyCredential() {}, {
        getClientCapabilities: () => Promise.resolve({ 'extension:prf': true }),
        isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
      }),
    )
    vi.stubGlobal('navigator', { ...navigator, credentials: { create: vi.fn(), get: vi.fn() } })
    expect(await passkeysOffered()).toBe(false)
  })
})
