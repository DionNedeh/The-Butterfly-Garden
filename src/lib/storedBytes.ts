/**
 * Bytes in a copy of what is stored, written as base64 rather than as JSON's
 * list of numbers: `{ "base64": "…" }`. A locked garden is stored as sealed
 * bytes (repository/sealedStores), and both copies of what is stored -- safe
 * mode's (lib/storedCopy) and the set-aside copy (lib/sightingPhotos) -- write
 * them through this one replacer, so they hold the same bytes in the same
 * shape, a few times smaller than numbers would be, and a sealed copy can be
 * opened again (lib/lockedCopy).
 *
 * A JSON.stringify replacer. Small, and loaded with safe mode, which must be
 * able to write a copy even when nothing else will load.
 */
export function bytesAsBase64(_key: string, value: unknown): unknown {
  if (!ArrayBuffer.isView(value)) return value
  const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  let binary = ''
  for (let start = 0; start < view.length; start += 0x8000) {
    binary += String.fromCharCode(...view.subarray(start, start + 0x8000))
  }
  return { base64: btoa(binary) }
}
