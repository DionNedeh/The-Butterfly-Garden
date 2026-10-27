import { downloadBlob, type SaveOutcome } from './download'
import { inAppPlugin } from './native'

/**
 * Saving an image the gardener made (the year's postcard) where they choose.
 *
 * Apart from lib/download, which loads with the app for the backup, so that
 * none of this is in the first load: it arrives with the page that makes the
 * image. In a browser it is an ordinary download; in the Android app it goes
 * through GardenFiles' "Save to…" screen, which takes bytes as base64, the
 * one way bytes cross Capacitor's bridge, and reports whether they were
 * written.
 */

interface GardenImageFiles {
  saveBinaryDocument(options: {
    fileName: string
    mimeType: string
    base64: string
  }): Promise<{ saved: boolean }>
}

/** A slice of bytes per conversion, so a large image cannot overflow the call stack. */
const BASE64_SLICE = 0x8000

/** Base64 of a blob's bytes. */
export async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let start = 0; start < bytes.length; start += BASE64_SLICE) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_SLICE))
  }
  return btoa(binary)
}

/**
 * Save an image as a file: `saved` or `cancelled` from Android's save
 * screen, `started` for a browser download. Throws when the save fails
 * outright, so the caller can say so.
 */
export async function saveImageFile(fileName: string, blob: Blob): Promise<SaveOutcome> {
  if (import.meta.env.VITE_PLATFORM === 'android') {
    const { plugin } = await inAppPlugin<GardenImageFiles>('GardenFiles')
    const { saved } = await plugin.saveBinaryDocument({
      fileName,
      mimeType: blob.type,
      base64: await base64Of(blob),
    })
    return saved ? 'saved' : 'cancelled'
  }
  return downloadBlob(blob, fileName)
}
