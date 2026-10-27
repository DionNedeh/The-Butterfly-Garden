import type { CustomBackdropCrop } from '../types'
import { coverGeometry } from './customBackdrops'
import { listed } from './plural'
import { withArticle } from './summaries'

/**
 * The year's postcard (plan c.4): the garden scene with the gardener's
 * butterflies, the garden's name and the year, drawn on this device when the
 * gardener asks for it.
 *
 * Only what the app already holds goes in: the scene's own image (or the
 * gardener's picture, as the garden shows it by day), each butterfly's
 * sprite serialised from the page's own SVG, and two short lines of text.
 * Nothing from the journal is ever handed in, so nothing from it can be
 * drawn. Every picture is same-origin, a `data:` URL, or the sprite's own
 * markup; the CSP's `img-src 'self' data: blob:` allows each, and none of
 * them makes a request anywhere else.
 *
 * A picture that cannot be loaded or drawn is left out rather than losing
 * the card: a postcard of the name and the year is still a postcard.
 */

/** The card's size in pixels: landscape, three by two, like a postcard. */
export const POSTCARD_WIDTH = 1500
export const POSTCARD_HEIGHT = 1000

/** A photograph of a garden stays small enough to send as a JPEG. */
export const POSTCARD_TYPE = 'image/jpeg'

/** High enough that the name's edges stay clean. */
const POSTCARD_QUALITY = 0.92

/** The card's paper edge, around the picture. */
const EDGE = 36

/** How long one picture may take to arrive before the card goes without it. */
const PICTURE_TIMEOUT_MS = 8000

/** How long the bundled fonts may take before the card is drawn in a fallback. */
const FONT_TIMEOUT_MS = 3000

/** The size a sprite is rasterised at, so drawing it is never an enlargement. */
export const SPRITE_PIXELS = 480

const TITLE_FAMILY = 'Fraunces, Georgia, serif'
const YEAR_FONT = '700 46px "Nunito Sans", system-ui, sans-serif'
const TITLE_LARGEST = 96
const TITLE_SMALLEST = 44

/** The scene behind the butterflies. */
export interface PostcardBackdrop {
  /** A scene of the app's own (same origin), or the gardener's image as a `data:` URL. */
  src: string
  /** The gardener's image is framed and lit as the garden shows it. */
  crop?: CustomBackdropCrop
  brightness?: number
}

/** Everything a postcard is drawn from. Nothing else reaches it. */
export interface PostcardPlan {
  gardenName: string
  /** The year, as the gardener's locale writes it. */
  year: string
  backdrop?: PostcardBackdrop
  /** Each butterfly as a standalone SVG document (spriteSvg). */
  butterflies: readonly string[]
}

/** A postcard, and which of its pictures made it onto the card. */
export interface Postcard {
  blob: Blob
  backdrop: boolean
  /** The indexes, in the plan's order, of the butterflies drawn. */
  butterflies: number[]
}

/** A picture ready to draw, with the size it was made at. */
export interface Picture {
  source: CanvasImageSource
  width: number
  height: number
}

/** The parts of a 2D context the postcard draws with. */
export type PostcardContext = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'fillRect'
  | 'drawImage'
  | 'createLinearGradient'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'fillText'
  | 'measureText'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
  | 'filter'
  | 'shadowColor'
  | 'shadowBlur'
  | 'shadowOffsetY'
  | 'beginPath'
  | 'rect'
  | 'clip'
>

/** A canvas to draw on, and a way to read the drawing back as a file. */
export interface PostcardSurface {
  context: PostcardContext
  /** The drawing as an image file; throws, or gives nothing, when it cannot be read back. */
  toBlob(type: string, quality: number): Promise<Blob | null>
}

/** What drawing needs from the device. Tests hand in their own. */
export interface PostcardDevice {
  /** A canvas of this size, or nothing when the device cannot draw. */
  surface(width: number, height: number): PostcardSurface | undefined
  /** A picture from an address, or nothing when it cannot be loaded. */
  picture(src: string): Promise<Picture | undefined>
  /** The bundled fonts, loaded, or given up on after a moment. */
  fonts(): Promise<void>
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * One sprite (SpriteFrame: a stack of `<svg>` layers sharing a viewBox) as a
 * single standalone SVG document, so it can be drawn as an image. Its layers
 * become groups in their order, which keeps the references between them
 * (the right wing uses the left wing's drawing) inside the one document.
 * Undefined for anything that is not a sprite.
 */
export function spriteSvg(frame: Element, width = SPRITE_PIXELS): string | undefined {
  const layers = Array.from(frame.querySelectorAll('svg.sprite-layer'))
  const viewBox = layers[0]?.getAttribute('viewBox')
  const [, , boxWidth, boxHeight] = (viewBox ?? '').split(/[\s,]+/).map(Number)
  if (!viewBox || !(boxWidth > 0) || !(boxHeight > 0)) return undefined
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', viewBox)
  // A size of its own: an SVG image without one cannot be drawn everywhere.
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(Math.round((width * boxHeight) / boxWidth)))
  for (const layer of layers) {
    const group = document.createElementNS(SVG_NS, 'g')
    for (const child of Array.from(layer.childNodes)) group.append(child.cloneNode(true))
    svg.append(group)
  }
  return new XMLSerializer().serializeToString(svg)
}

/** An SVG document as an address an image can load: no request is made for it. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** "butterfly-garden-postcard-2026.jpg". */
export function postcardFileName(year: number): string {
  return `butterfly-garden-postcard-${year}.jpg`
}

/**
 * What a postcard shows, in words, for the preview's text alternative:
 * "A postcard of Quiet Corner for 2026: a Monarch and a Red Admiral, over
 * the Sunlit Meadow." Only what was drawn is named.
 */
export function describePostcard(
  gardenName: string,
  year: string,
  drawn: { scene?: string; species: readonly string[] },
): string {
  const butterflies = drawn.species.map(withArticle)
  const parts = [
    butterflies.length > 0 ? listed(butterflies) : undefined,
    drawn.scene ? `${butterflies.length > 0 ? 'over ' : ''}${drawn.scene}` : undefined,
  ].filter(Boolean)
  return `A postcard of ${gardenName} for ${year}${parts.length > 0 ? `: ${parts.join(', ')}` : ''}.`
}

/**
 * Where each butterfly sits, as fractions of the picture: a loose arc above
 * the name, never over it, so every one of a handful can be seen.
 */
const PLACES: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [],
  [[0.5, 0.36, -6]],
  [
    [0.32, 0.36, -8],
    [0.68, 0.28, 7],
  ],
  [
    [0.22, 0.38, -9],
    [0.5, 0.24, 4],
    [0.78, 0.36, 9],
  ],
  [
    [0.17, 0.4, -10],
    [0.39, 0.24, 6],
    [0.61, 0.38, -5],
    [0.83, 0.24, 9],
  ],
  [
    [0.13, 0.38, -10],
    [0.31, 0.22, 7],
    [0.5, 0.4, -4],
    [0.69, 0.22, 8],
    [0.87, 0.38, -9],
  ],
]

/** The sprite's width on the card: smaller as more share the sky. */
function butterflyWidth(count: number): number {
  return count <= 1 ? 340 : Math.max(200, 300 - (count - 2) * 30)
}

function titleFont(size: number): string {
  return `600 ${size}px ${TITLE_FAMILY}`
}

/**
 * The garden's name at the largest size that fits across the card, or, for
 * a name too long even at the smallest, shortened with an ellipsis.
 */
function fitTitle(context: PostcardContext, text: string, maxWidth: number): string {
  for (let size = TITLE_LARGEST; size >= TITLE_SMALLEST; size -= 4) {
    context.font = titleFont(size)
    if (context.measureText(text).width <= maxWidth) return text
  }
  const letters = Array.from(text)
  while (letters.length > 1 && context.measureText(`${letters.join('')}…`).width > maxWidth)
    letters.pop()
  return `${letters.join('').trimEnd()}…`
}

/** Draw one picture, saying whether it could be drawn. */
function drawn(draw: () => void): boolean {
  try {
    draw()
    return true
  } catch {
    // A picture the canvas will not take (a broken image, say) is left out.
    return false
  }
}

interface Sources {
  backdrop?: Picture
  butterflies: ReadonlyArray<{ index: number; picture: Picture }>
}

/** Paint the card, and say which pictures went on. */
function paint(
  context: PostcardContext,
  plan: PostcardPlan,
  sources: Sources,
): Omit<Postcard, 'blob'> {
  const inner = {
    x: EDGE,
    y: EDGE,
    width: POSTCARD_WIDTH - EDGE * 2,
    height: POSTCARD_HEIGHT - EDGE * 2,
  }
  // The paper, then a sky over a meadow for a card with no scene.
  context.fillStyle = '#fbf6ea'
  context.fillRect(0, 0, POSTCARD_WIDTH, POSTCARD_HEIGHT)
  const sky = context.createLinearGradient(0, inner.y, 0, inner.y + inner.height)
  sky.addColorStop(0, '#cfe6ee')
  sky.addColorStop(0.6, '#e8f0d8')
  sky.addColorStop(1, '#9fc387')
  context.fillStyle = sky
  context.fillRect(inner.x, inner.y, inner.width, inner.height)

  const backdrop = sources.backdrop
  const backdropDrawn =
    backdrop !== undefined &&
    drawn(() => {
      const fit = coverGeometry(backdrop, inner, plan.backdrop?.crop)
      context.save()
      try {
        context.beginPath()
        context.rect(inner.x, inner.y, inner.width, inner.height)
        context.clip()
        // The gardener's brightness, as the garden applies it to the picture alone.
        if (plan.backdrop?.brightness)
          context.filter = `brightness(${(100 + plan.backdrop.brightness) / 100})`
        context.drawImage(
          backdrop.source,
          inner.x + fit.left,
          inner.y + fit.top,
          fit.width,
          fit.height,
        )
      } finally {
        context.restore()
      }
    })

  // A shade under the words, so the name reads on any scene.
  const shadeTop = inner.y + inner.height * 0.5
  const shade = context.createLinearGradient(0, shadeTop, 0, inner.y + inner.height)
  shade.addColorStop(0, 'rgba(20, 36, 28, 0)')
  shade.addColorStop(1, 'rgba(20, 36, 28, 0.62)')
  context.fillStyle = shade
  context.fillRect(inner.x, shadeTop, inner.width, inner.height * 0.5)

  const places = PLACES[sources.butterflies.length] ?? []
  const width = butterflyWidth(sources.butterflies.length)
  const butterfliesDrawn: number[] = []
  sources.butterflies.forEach(({ index, picture }, at) => {
    const [x, y, degrees] = places[at] ?? [0.5, 0.36, 0]
    const height = (width * picture.height) / picture.width
    const ok = drawn(() => {
      context.save()
      try {
        context.translate(inner.x + inner.width * x, inner.y + inner.height * y)
        context.rotate((degrees * Math.PI) / 180)
        context.shadowColor = 'rgba(20, 36, 28, 0.28)'
        context.shadowBlur = 18
        context.shadowOffsetY = 8
        context.drawImage(picture.source, -width / 2, -height / 2, width, height)
      } finally {
        context.restore()
      }
    })
    if (ok) butterfliesDrawn.push(index)
  })

  // The name and the year, and nothing else in words.
  context.save()
  context.fillStyle = '#fffdf6'
  context.shadowColor = 'rgba(0, 0, 0, 0.5)'
  context.shadowBlur = 16
  context.textAlign = 'center'
  context.textBaseline = 'alphabetic'
  const title = fitTitle(context, plan.gardenName, inner.width - 160)
  context.fillText(title, POSTCARD_WIDTH / 2, inner.y + inner.height - 118)
  context.font = YEAR_FONT
  context.fillText(plan.year, POSTCARD_WIDTH / 2, inner.y + inner.height - 52)
  context.restore()

  return { backdrop: backdropDrawn, butterflies: butterfliesDrawn }
}

/**
 * Draw the postcard and read it back as a file. Each picture that will not
 * load is left out; should the finished card then not read back (a browser
 * that will not let a drawn SVG leave the canvas), it is drawn again without
 * the butterflies, and then without the scene. Undefined only when this
 * device cannot draw at all.
 */
export async function drawPostcard(
  plan: PostcardPlan,
  device: PostcardDevice = browserDevice,
): Promise<Postcard | undefined> {
  const [backdrop, ...pictures] = await Promise.all([
    plan.backdrop ? device.picture(plan.backdrop.src) : Promise.resolve(undefined),
    ...plan.butterflies.map((svg) => device.picture(svgDataUrl(svg))),
  ])
  await device.fonts()
  const butterflies = pictures.flatMap((picture, index) => (picture ? [{ index, picture }] : []))
  const attempts: Sources[] = [{ backdrop, butterflies }]
  if (butterflies.length > 0) attempts.push({ backdrop, butterflies: [] })
  if (backdrop) attempts.push({ butterflies: [] })
  for (const sources of attempts) {
    const surface = device.surface(POSTCARD_WIDTH, POSTCARD_HEIGHT)
    if (!surface) return undefined
    const result = paint(surface.context, plan, sources)
    try {
      const blob = await surface.toBlob(POSTCARD_TYPE, POSTCARD_QUALITY)
      if (blob) return { blob, ...result }
    } catch {
      // Not readable with these pictures on it: try again with fewer.
    }
  }
  return undefined
}

/** Load a picture from an address, giving up on one that fails or stalls. */
function loadPicture(src: string): Promise<Picture | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (picture?: Picture) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(picture)
    }
    const timer = window.setTimeout(() => finish(), PICTURE_TIMEOUT_MS)
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image
      finish(width > 0 && height > 0 ? { source: image, width, height } : undefined)
    }
    image.onerror = () => finish()
    image.decoding = 'async'
    image.src = src
  })
}

/**
 * The bundled faces the card's words are set in, asked for by name: a canvas
 * only uses a font that has already loaded. A device that cannot load them
 * draws the words in its own serif and sans-serif.
 */
async function loadFonts(): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts
  if (!fonts || typeof fonts.load !== 'function') return
  await Promise.race([
    Promise.all([fonts.load(titleFont(TITLE_LARGEST)), fonts.load(YEAR_FONT)]).catch(
      () => undefined,
    ),
    new Promise((resolve) => window.setTimeout(resolve, FONT_TIMEOUT_MS)),
  ])
}

/** A canvas of the device's own: off screen where the browser has one. */
function browserSurface(width: number, height: number): PostcardSurface | undefined {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (context)
      return { context, toBlob: (type, quality) => canvas.convertToBlob({ type, quality }) }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return undefined
  return {
    context,
    toBlob: (type, quality) =>
      new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality)),
  }
}

/** This device's canvas, images and fonts. */
export const browserDevice: PostcardDevice = {
  surface: browserSurface,
  picture: loadPicture,
  fonts: loadFonts,
}
