/**
 * A FileReader that reads through Blob.arrayBuffer, for tests. jsdom's own
 * reads only jsdom's Blobs, and the tests that store a photo use Node's (see
 * node-buffer.d.ts); and a Blob made unreadable, as storage can leave a
 * photo whose file has gone, fails here as it does in a browser.
 */
export class ArrayBufferFileReader {
  result: string | null = null
  error: unknown = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then(
      (buffer) => {
        let binary = ''
        for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
        this.result = `data:${blob.type};base64,${btoa(binary)}`
        this.onload?.()
      },
      (error: unknown) => {
        this.error = error
        this.onerror?.()
      },
    )
  }
}

/**
 * A photo whose bytes can no longer be read, though its record still says
 * what it was: what a browser hands back when the file behind a stored Blob
 * has gone.
 */
export function unreadablePhoto(): Blob {
  const blob = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'image/webp' })
  Object.defineProperty(blob, 'arrayBuffer', {
    value: () => Promise.reject(new DOMException('The file could not be read.', 'NotReadableError')),
  })
  return blob
}
