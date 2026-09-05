/**
 * Identifiers for locally stored records.
 *
 * `crypto.randomUUID` only exists in a secure context, so it is missing when
 * the app is opened over plain http — for example a phone pointed at a dev
 * server on the local network. These ids never leave the device and carry no
 * security weight, so a getRandomValues (or, failing that, Math.random)
 * fallback keeps the garden usable instead of throwing during onboarding.
 */
export function createId(): string {
  const cryptoApi: Crypto | undefined = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  // Version 4, variant 1, per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}
