import { describe, expect, it } from 'vitest'
import { routeFromHash } from './lib/routes'
import { pwaManifest } from './pwaManifest'

const BASE = '/The-Butterfly-Garden/'
const manifest = pwaManifest(BASE)

/**
 * Every file in public/, by the path the manifest would name it with. Listed
 * by the bundler, which reads nothing until asked, so this costs nothing.
 */
const publicFiles = new Set(
  Object.keys(import.meta.glob('/public/**/*')).map((path) =>
    path.replace(/^\/public\//, ''),
  ),
)

/** The PNGs, as data URLs, so their real size can be compared with the claim. */
const pngs = import.meta.glob<string>('/public/**/*.png', {
  query: '?inline',
  import: 'default',
  eager: true,
})

/** Width × height from a PNG's header (IHDR follows the 8-byte signature). */
function pngSize(src: string): string {
  const dataUrl = pngs[`/public/${src}`]
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  return `${view.getUint32(16)}x${view.getUint32(20)}`
}

const { icons, shortcuts, screenshots } = manifest

describe('the web app manifest', () => {
  it('names only files that are in public/', () => {
    const named = [
      ...icons.map((icon) => icon.src),
      ...shortcuts.flatMap((shortcut) => shortcut.icons.map((icon) => icon.src)),
      ...screenshots.map((screenshot) => screenshot.src),
    ]
    expect(named.length).toBeGreaterThan(0)
    for (const src of named) {
      // Relative, so each resolves beside the manifest at the base path.
      expect(src).not.toMatch(/^\//)
      expect(publicFiles, src).toContain(src)
    }
  })

  it('keeps one identity, at the address browsers already knew it by', () => {
    expect(manifest.id).toBe(BASE)
    expect(manifest.start_url).toBe(BASE)
    expect(manifest.scope).toBe(BASE)
    expect(manifest.categories).toEqual(['health', 'lifestyle'])
  })

  it('gives the uncropped icon and the maskable one an entry each', () => {
    for (const icon of icons) {
      // A combined "any maskable" crops the artwork wherever it is shown as "any".
      expect(icon.purpose === 'any' || icon.purpose === 'maskable', icon.src).toBe(true)
    }
    const maskable = icons.filter((icon) => icon.purpose === 'maskable')
    expect(maskable.map((icon) => icon.src)).toEqual(['icons/icon-maskable-512.webp'])
    expect(icons.some((icon) => icon.purpose === 'any' && icon.sizes === '512x512')).toBe(true)
  })

  it('opens each shortcut on a page the app knows, inside its scope', () => {
    const opened = shortcuts.map((shortcut) => {
      expect(shortcut.url.startsWith(BASE), shortcut.url).toBe(true)
      expect(shortcut.icons.length, shortcut.name).toBeGreaterThan(0)
      return [shortcut.name, routeFromHash(new URL(shortcut.url, 'https://example.test').hash)]
    })
    expect(opened).toEqual([
      ['Check in', { view: 'today', checkIn: true }],
      ['Today', { view: 'today' }],
      ['Journal', { view: 'journal' }],
    ])
  })

  it('shows the install sheet a phone screenshot and a wide one, each described', () => {
    const forms = new Set(screenshots.map((screenshot) => screenshot.form_factor))
    expect(forms).toEqual(new Set(['narrow', 'wide']))
    for (const screenshot of screenshots) {
      expect(screenshot.label, screenshot.src).toBeTruthy()
      expect(screenshot.type).toBe('image/png')
      const [width, height] = screenshot.sizes.split('x').map(Number)
      if (screenshot.form_factor === 'wide') expect(width).toBeGreaterThan(height)
      else expect(height).toBeGreaterThan(width)
      // Chrome skips screenshots more than 2.3 times as long as they are wide.
      expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(2.3)
    }
  })

  it('states the real size of every PNG it names', () => {
    const sized = [
      ...shortcuts.flatMap((shortcut) => shortcut.icons),
      ...screenshots,
      ...icons.filter((icon) => icon.type === 'image/png'),
    ]
    for (const image of sized) expect(pngSize(image.src), image.src).toBe(image.sizes)
  })
})
