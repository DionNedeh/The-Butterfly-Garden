import { afterEach, describe, expect, it, vi } from 'vitest'

// A stand-in for Capacitor. What matters here is what the app asks of it.
const saveBinaryDocument = vi.hoisted(() => vi.fn())
const registerPlugin = vi.hoisted(() => vi.fn(() => ({ saveBinaryDocument })))
vi.mock('@capacitor/core', () => ({ registerPlugin }))

/** A fresh copy of the modules, so a plugin registered in one test is not reused. */
async function loadSaveImage() {
  vi.resetModules()
  return import('./saveImage')
}

const IMAGE = new Blob([new Uint8Array([255, 216, 255, 0, 1, 2])], { type: 'image/jpeg' })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('an image as base64', () => {
  it('is the bytes, however many slices it takes', async () => {
    const { base64Of } = await loadSaveImage()
    expect(await base64Of(IMAGE)).toBe(btoa(String.fromCharCode(255, 216, 255, 0, 1, 2)))
    const large = new Uint8Array(100_000).map((_, index) => index % 251)
    const decoded = atob(await base64Of(new Blob([large])))
    expect(Uint8Array.from(decoded, (letter) => letter.charCodeAt(0))).toEqual(large)
  })
})

describe('saving an image in a browser', () => {
  it('starts a download of the image under its name, and keeps it alive while it is read', async () => {
    vi.useFakeTimers()
    const { saveImageFile } = await loadSaveImage()
    const created = vi.fn(() => 'blob:postcard')
    const revoked = vi.fn()
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked })
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this)
    })
    await expect(saveImageFile('postcard.jpg', IMAGE)).resolves.toBe('started')
    expect(created).toHaveBeenCalledWith(IMAGE)
    expect(clicked[0]?.download).toBe('postcard.jpg')
    expect(clicked[0]?.getAttribute('href')).toBe('blob:postcard')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoked).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revoked).toHaveBeenCalledWith('blob:postcard')
    expect(registerPlugin).not.toHaveBeenCalled()
  })
})

describe('saving an image in the Android app', () => {
  it('hands the bytes to the app’s save screen, and says whether they were written', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { saveImageFile } = await loadSaveImage()
    saveBinaryDocument.mockResolvedValueOnce({ saved: true })
    saveBinaryDocument.mockResolvedValueOnce({ saved: false })
    await expect(saveImageFile('postcard.jpg', IMAGE)).resolves.toBe('saved')
    await expect(saveImageFile('postcard.jpg', IMAGE)).resolves.toBe('cancelled')
    expect(registerPlugin).toHaveBeenCalledWith('GardenFiles')
    expect(saveBinaryDocument).toHaveBeenCalledWith({
      fileName: 'postcard.jpg',
      mimeType: 'image/jpeg',
      base64: btoa(String.fromCharCode(255, 216, 255, 0, 1, 2)),
    })
  })

  it('passes on a failure to write, so the page can say so', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { saveImageFile } = await loadSaveImage()
    saveBinaryDocument.mockRejectedValueOnce(new Error('The file could not be written.'))
    await expect(saveImageFile('postcard.jpg', IMAGE)).rejects.toThrow('could not be written')
  })
})
