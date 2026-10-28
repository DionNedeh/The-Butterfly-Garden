import { afterEach, describe, expect, it, vi } from 'vitest'
import { canShareFile, shareFile, shareTextFile } from './shareFile'

/** Give jsdom, which has no share sheet, the one a phone browser would have. */
function stubShareSheet(
  canShare: (data?: ShareData) => boolean,
  share: (data?: ShareData) => Promise<void> = () => Promise.resolve(),
) {
  const sheet = { canShare: vi.fn(canShare), share: vi.fn(share) }
  Object.defineProperty(navigator, 'canShare', { value: sheet.canShare, configurable: true })
  Object.defineProperty(navigator, 'share', { value: sheet.share, configurable: true })
  return sheet
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
  vi.unstubAllEnvs()
})

describe('whether a file can be shared', () => {
  it('is no where the browser has no share sheet for files', () => {
    expect(canShareFile('garden.json', 'application/json')).toBe(false)
  })

  it('asks the browser about a file of that name and type', () => {
    const sheet = stubShareSheet((data) => data?.files?.[0]?.type === 'application/json')
    expect(canShareFile('garden.json', 'application/json')).toBe(true)
    expect(canShareFile('garden.exe', 'application/x-msdownload')).toBe(false)
    const [asked] = sheet.canShare.mock.calls[0]
    expect(asked?.files?.[0]?.name).toBe('garden.json')
  })

  it('is no when the browser throws rather than answering', () => {
    stubShareSheet(() => {
      throw new TypeError('files are not supported')
    })
    expect(canShareFile('garden.json', 'application/json')).toBe(false)
  })

  it('is never offered in the Android app, which has its own save screen', () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    stubShareSheet(() => true)
    expect(canShareFile('garden.json', 'application/json')).toBe(false)
  })
})

describe('sharing a file', () => {
  it('hands the browser the text as a named file', async () => {
    const sheet = stubShareSheet(() => true)
    await expect(
      shareTextFile('garden.json', 'application/json', '{"a":1}', 'A backup'),
    ).resolves.toBe('shared')
    const [shared] = sheet.share.mock.calls[0]
    const file = shared?.files?.[0]
    expect(shared?.title).toBe('A backup')
    expect(file?.name).toBe('garden.json')
    expect(file?.type).toBe('application/json')
    expect(await file?.text()).toBe('{"a":1}')
  })

  it('hands the browser bytes, such as a postcard, as a named file', async () => {
    const sheet = stubShareSheet(() => true)
    const image = new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' })
    await expect(
      shareFile('postcard.jpg', 'image/jpeg', image, 'Quiet Corner, 2026'),
    ).resolves.toBe('shared')
    const [shared] = sheet.share.mock.calls[0]
    const file = shared?.files?.[0]
    expect(shared?.title).toBe('Quiet Corner, 2026')
    expect(file?.name).toBe('postcard.jpg')
    expect(file?.type).toBe('image/jpeg')
    expect([...new Uint8Array((await file?.arrayBuffer()) ?? new ArrayBuffer(0))]).toEqual([
      255, 216, 255,
    ])
  })

  it('treats a closed share sheet as a choice, not a failure', async () => {
    stubShareSheet(
      () => true,
      () => Promise.reject(new DOMException('Share canceled', 'AbortError')),
    )
    await expect(
      shareTextFile('garden.json', 'application/json', '{}', 'A backup'),
    ).resolves.toBe('cancelled')
  })

  it('passes on any other refusal, so the caller can say so', async () => {
    stubShareSheet(
      () => true,
      () => Promise.reject(new DOMException('No gesture', 'NotAllowedError')),
    )
    await expect(
      shareTextFile('garden.json', 'application/json', '{}', 'A backup'),
    ).rejects.toThrow('No gesture')
  })

  it('refuses a file the browser says it will not share, before trying', async () => {
    const sheet = stubShareSheet(() => false)
    await expect(
      shareTextFile('garden.json', 'application/json', '{}', 'A backup'),
    ).rejects.toThrow(/will not share/)
    expect(sheet.share).not.toHaveBeenCalled()
  })

  it('is not used in the Android app', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const sheet = stubShareSheet(() => true)
    await expect(
      shareTextFile('garden.json', 'application/json', '{}', 'A backup'),
    ).rejects.toThrow(/only offered in the browser/)
    expect(sheet.share).not.toHaveBeenCalled()
  })
})
