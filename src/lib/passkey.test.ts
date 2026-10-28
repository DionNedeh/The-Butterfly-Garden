import { afterEach, describe, expect, it, vi } from 'vitest'
import { askPasskey, makePasskey, passkeysOffered } from './passkey'

/*
 * WebAuthn, played by hand: jsdom has none. What matters here is what the
 * garden asks for (user verification, the PRF extension with its salt) and
 * what it makes of each answer, the missing PRF and the closed prompt above all.
 */

function credential(prf: unknown, rawId = new Uint8Array([7, 7, 7]).buffer) {
  return { rawId, getClientExtensionResults: () => (prf === undefined ? {} : { prf }) }
}

function stubWebAuthn({
  capabilities,
  platform = true,
  create,
  get,
}: {
  capabilities?: Record<string, boolean>
  platform?: boolean
  create?: (options: CredentialCreationOptions) => Promise<unknown>
  get?: (options: CredentialRequestOptions) => Promise<unknown>
}) {
  vi.stubGlobal(
    'PublicKeyCredential',
    Object.assign(function PublicKeyCredential() {}, {
      ...(capabilities ? { getClientCapabilities: () => Promise.resolve(capabilities) } : {}),
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(platform),
    }),
  )
  const credentials = {
    create: vi.fn(create ?? (() => Promise.resolve(null))),
    get: vi.fn(get ?? (() => Promise.resolve(null))),
  }
  vi.stubGlobal('navigator', { ...navigator, credentials })
  return credentials
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('whether a passkey is offered', () => {
  it('is not, where there is no WebAuthn', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined)
    expect(await passkeysOffered()).toBe(false)
  })

  it('follows the browser’s own word on PRF where it gives one', async () => {
    stubWebAuthn({ capabilities: { 'extension:prf': true } })
    expect(await passkeysOffered()).toBe(true)
    stubWebAuthn({ capabilities: { 'extension:prf': false }, platform: true })
    expect(await passkeysOffered()).toBe(false)
  })

  it('otherwise asks whether the device can make one at all', async () => {
    stubWebAuthn({ platform: true })
    expect(await passkeysOffered()).toBe(true)
    stubWebAuthn({ platform: false })
    expect(await passkeysOffered()).toBe(false)
  })

  it('is never offered in the Android app', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    stubWebAuthn({ capabilities: { 'extension:prf': true } })
    expect(await passkeysOffered()).toBe(false)
  })
})

describe('making the garden’s passkey', () => {
  it('asks for user verification and PRF, and keeps the answer given as it is made', async () => {
    const answer = new Uint8Array(32).fill(9)
    const credentials = stubWebAuthn({
      create: () => Promise.resolve(credential({ enabled: true, results: { first: answer.buffer } })),
    })
    const made = await makePasskey()
    expect(made).toMatchObject({ ok: true })
    if (!made.ok) return
    expect([...made.prfOutput]).toEqual([...answer])
    expect([...made.credentialId]).toEqual([7, 7, 7])
    expect(made.prfSalt).toHaveLength(32)
    const options = credentials.create.mock.calls[0][0].publicKey!
    expect(options.authenticatorSelection?.userVerification).toBe('required')
    expect(options.extensions).toMatchObject({ prf: { eval: { first: made.prfSalt } } })
    expect(credentials.get).not.toHaveBeenCalled()
  })

  it('asks once more where the passkey answers only when used', async () => {
    const answer = new Uint8Array(32).fill(4)
    const credentials = stubWebAuthn({
      create: () => Promise.resolve(credential({ enabled: true })),
      get: () => Promise.resolve(credential({ results: { first: answer } })),
    })
    const made = await makePasskey()
    expect(made.ok && [...made.prfOutput]).toEqual([...answer])
    const request = credentials.get.mock.calls[0][0].publicKey!
    expect(request.userVerification).toBe('required')
    expect(request.allowCredentials?.[0].type).toBe('public-key')
  })

  it('says so when the passkey has no PRF, so nothing is stored', async () => {
    stubWebAuthn({ create: () => Promise.resolve(credential(undefined)) })
    expect(await makePasskey()).toEqual({ ok: false, reason: 'no-prf' })
    stubWebAuthn({ create: () => Promise.resolve(credential({ enabled: false })) })
    expect(await makePasskey()).toEqual({ ok: false, reason: 'no-prf' })
  })

  it('treats a closed prompt as nothing to report, and lets other failures through', async () => {
    stubWebAuthn({ create: () => Promise.reject(new DOMException('No', 'NotAllowedError')) })
    expect(await makePasskey()).toEqual({ ok: false, reason: 'dismissed' })
    stubWebAuthn({ create: () => Promise.resolve(null) })
    expect(await makePasskey()).toEqual({ ok: false, reason: 'dismissed' })
    stubWebAuthn({ create: () => Promise.reject(new DOMException('Bad', 'SecurityError')) })
    await expect(makePasskey()).rejects.toThrow('Bad')
  })
})

describe('asking the passkey to open the garden', () => {
  it('gives back its answer to the stored salt', async () => {
    const answer = new Uint8Array(32).fill(2)
    const credentials = stubWebAuthn({
      get: () => Promise.resolve(credential({ results: { first: new DataView(answer.buffer) } })),
    })
    const salt = new Uint8Array(32).fill(5)
    const result = await askPasskey(new Uint8Array([1, 2]), salt)
    expect(result.ok && [...result.prfOutput]).toEqual([...answer])
    expect(credentials.get.mock.calls[0][0].publicKey!.extensions).toMatchObject({
      prf: { eval: { first: salt } },
    })
  })

  it('says when there is no answer, or the prompt was closed', async () => {
    stubWebAuthn({ get: () => Promise.resolve(credential({})) })
    expect(await askPasskey(new Uint8Array([1]), new Uint8Array(32))).toEqual({ ok: false, reason: 'no-prf' })
    stubWebAuthn({ get: () => Promise.reject(new DOMException('Gone', 'AbortError')) })
    expect(await askPasskey(new Uint8Array([1]), new Uint8Array(32))).toEqual({
      ok: false,
      reason: 'dismissed',
    })
  })
})
