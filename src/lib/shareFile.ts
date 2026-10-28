/**
 * Handing a file to another app through the system share sheet (Web Share
 * Level 2): on a phone, "Save to Files", a cloud drive or a message to
 * oneself is often an easier place to keep a backup than the downloads
 * folder. The gardener chooses where it goes; the app sends nothing itself.
 *
 * Browser only. The Android app has its own "Save to…" screen (lib/native),
 * and the inline platform checks let the bundler drop this from that build.
 */

/**
 * Whether this browser can share a file with this name and type. Asked with
 * an empty stand-in, since browsers decide by name and type, so the whole
 * garden need not be serialised just to find out whether to offer the button.
 */
export function canShareFile(fileName: string, mimeType: string): boolean {
  if (import.meta.env.VITE_PLATFORM === 'android') return false
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function')
    return false
  try {
    return navigator.canShare({ files: [new File([], fileName, { type: mimeType })] })
  } catch {
    return false
  }
}

/**
 * What became of a share.
 *
 * - `shared`    the gardener chose an app and the browser handed it the file.
 * - `cancelled` they closed the share sheet; nothing went anywhere, and that
 *               is a choice, not a failure.
 */
export type ShareOutcome = 'shared' | 'cancelled'

/** By name: a DOMException is not an Error in every engine. */
function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/**
 * Share text as a file. Throws when the browser refuses (a type it will not
 * share after all, or no user gesture), so callers can say so.
 */
export function shareTextFile(
  fileName: string,
  mimeType: string,
  text: string,
  title: string,
): Promise<ShareOutcome> {
  return shareFile(fileName, mimeType, text, title)
}

/**
 * Share text or bytes (a postcard's image) as a file, the same way. Throws
 * when the browser refuses, so callers can say so.
 */
export async function shareFile(
  fileName: string,
  mimeType: string,
  contents: BlobPart,
  title: string,
): Promise<ShareOutcome> {
  if (import.meta.env.VITE_PLATFORM === 'android')
    throw new Error('Sharing a file is only offered in the browser.')
  const file = new File([contents], fileName, { type: mimeType })
  if (!navigator.canShare({ files: [file] }))
    throw new Error('This browser will not share that file.')
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    if (isAbort(error)) return 'cancelled'
    throw error
  }
}
