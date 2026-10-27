import { toLocalDate } from './date'
import { saveTextDocument } from './native'

/** How long a download's blob URL is kept alive so the browser can read it. */
const DOWNLOAD_URL_LIFETIME_MS = 60_000

/**
 * What became of a request to save a file.
 *
 * - `saved`     Android's own "Save to…" screen reported the file written.
 * - `started`   a browser download began; the browser owns it from here and
 *               will not say whether it finished, so nothing claims it did.
 * - `cancelled` the gardener backed out of Android's save screen.
 */
export type SaveOutcome = 'saved' | 'started' | 'cancelled'

/**
 * Save text as a file the gardener keeps, the right way for each build.
 *
 * Android's WebView ignores a download link, so the app goes through its own
 * save screen there. In a browser it is an ordinary download. Throws when the
 * save fails outright, so callers can say so.
 */
export async function saveTextFile(
  fileName: string,
  mimeType: string,
  text: string,
): Promise<SaveOutcome> {
  if (import.meta.env.VITE_PLATFORM === 'android') {
    return (await saveTextDocument(fileName, mimeType, text))
      ? 'saved'
      : 'cancelled'
  }
  return downloadBlob(new Blob([text], { type: mimeType }), fileName)
}

/**
 * A browser download of a blob: `started`, since the browser will not say
 * whether it finished. A postcard's image is saved this way too
 * (lib/saveImage), which keeps its Android path out of the first load.
 */
export function downloadBlob(blob: Blob, fileName: string): SaveOutcome {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  // In the document while it is clicked: a detached anchor works in current
  // browsers, but this is the gardener's only copy of everything they have
  // written and it is not worth the assumption.
  document.body.append(link)
  link.click()
  link.remove()
  // The download reads the blob asynchronously, so revoking on the next line
  // can cancel it before it starts -- silently, since the click itself never
  // reports failure. Hold the URL until the read is well past.
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS)
  return 'started'
}

/**
 * `butterfly-garden-<what>-2026-10-26.json`, dated by the gardener's own
 * calendar day, the date written inside a journal copy too. A UTC date
 * would name an evening's copy in the Americas after tomorrow.
 */
export function datedFileName(what: string, extension = 'json', now = new Date()): string {
  const day = toLocalDate(now)
  return `butterfly-garden-${what ? `${what}-` : ''}${day}.${extension}`
}
