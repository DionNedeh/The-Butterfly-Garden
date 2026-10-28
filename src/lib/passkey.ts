import { randomBytes } from './sealing'

/**
 * Passkeys that can open the garden lock: WebAuthn with its PRF extension,
 * which asks the passkey for a secret only it can give, after the person
 * proves who they are (a fingerprint, a face, the device's own PIN).
 *
 * Nothing goes to a server. The "challenge" WebAuthn wants is just random
 * bytes made here; the garden does not check a signature, it only uses the
 * PRF's answer as a key (lib/gardenLock). A passkey without PRF can give
 * nothing the garden could use, so it is not offered as a way in.
 *
 * Never in the Android app: its WebView has no WebAuthn to ask.
 */

const PRF_SALT_BYTES = 32

/** The PRF extension's answer, as browsers give it. */
interface PrfResults {
  enabled?: boolean
  results?: { first?: BufferSource }
}

interface PasskeyCapabilities {
  getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
}

/**
 * Whether to offer a passkey at all. Where the browser can say whether it
 * supports PRF, its answer decides. Where it cannot, a passkey is offered if
 * the device can make one, and adding it then shows whether PRF came back:
 * if not, nothing is stored and the gardener is told.
 */
export async function passkeysOffered(): Promise<boolean> {
  if (import.meta.env.VITE_PLATFORM === 'android') return false
  if (typeof PublicKeyCredential === 'undefined' || !navigator.credentials) return false
  const credential = PublicKeyCredential as unknown as PasskeyCapabilities
  try {
    const capabilities = await credential.getClientCapabilities?.()
    if (capabilities) return capabilities['extension:prf'] === true
    return (await credential.isUserVerifyingPlatformAuthenticatorAvailable?.()) === true
  } catch {
    return false
  }
}

function bytesOf(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice()
    : new Uint8Array(source).slice()
}

function prfOf(credential: PublicKeyCredential): PrfResults | undefined {
  return (credential.getClientExtensionResults() as { prf?: PrfResults }).prf
}

/** The person closed the prompt, or it timed out: nothing to report. */
function wasDismissed(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')
}

export type PasskeyAnswer =
  | { ok: true; prfOutput: Uint8Array }
  | { ok: false; reason: 'dismissed' | 'no-prf' }

/** Ask the garden's passkey for its answer to `prfSalt`. */
export async function askPasskey(
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<PasskeyAnswer> {
  let credential: PublicKeyCredential | null
  try {
    credential = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32) as Uint8Array<ArrayBuffer>,
        allowCredentials: [{ type: 'public-key', id: credentialId as Uint8Array<ArrayBuffer> }],
        userVerification: 'required',
        timeout: 120_000,
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    } as CredentialRequestOptions)) as PublicKeyCredential | null
  } catch (error) {
    if (wasDismissed(error)) return { ok: false, reason: 'dismissed' }
    throw error
  }
  if (!credential) return { ok: false, reason: 'dismissed' }
  const first = prfOf(credential)?.results?.first
  return first ? { ok: true, prfOutput: bytesOf(first) } : { ok: false, reason: 'no-prf' }
}

export type NewPasskey =
  | { ok: true; credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array }
  | { ok: false; reason: 'dismissed' | 'no-prf' }

/**
 * Make a passkey for the garden, and its first answer. Some authenticators
 * answer while the passkey is made; the others are asked once more.
 */
export async function makePasskey(): Promise<NewPasskey> {
  const prfSalt = randomBytes(PRF_SALT_BYTES)
  let credential: PublicKeyCredential | null
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'The Butterfly Garden' },
        user: {
          id: randomBytes(16) as Uint8Array<ArrayBuffer>,
          name: 'My garden',
          displayName: 'My garden',
        },
        challenge: randomBytes(32) as Uint8Array<ArrayBuffer>,
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        timeout: 120_000,
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    } as CredentialCreationOptions)) as PublicKeyCredential | null
  } catch (error) {
    if (wasDismissed(error)) return { ok: false, reason: 'dismissed' }
    throw error
  }
  if (!credential) return { ok: false, reason: 'dismissed' }
  const prf = prfOf(credential)
  if (!prf?.enabled && !prf?.results?.first) return { ok: false, reason: 'no-prf' }
  const credentialId = new Uint8Array(credential.rawId)
  const first = prf.results?.first
  if (first) return { ok: true, credentialId, prfSalt, prfOutput: bytesOf(first) }
  const answer = await askPasskey(credentialId, prfSalt)
  return answer.ok ? { ok: true, credentialId, prfSalt, prfOutput: answer.prfOutput } : answer
}
