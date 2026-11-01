import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Page } from '@playwright/test'

/**
 * The visual regression suite's eyes (e2e/visual.spec.ts): what every element
 * on the page is drawn with, as lines that can be kept as a baseline and
 * compared.
 *
 * Not pixels. Screenshots taken here would not match CI's, which has other
 * fonts, so every value read is one that no font and no layout decides: the
 * computed value (Element.computedStyleMap, which Chromium has), not the
 * resolved one getComputedStyle gives, so `margin: auto` reads `auto` and a
 * percentage stays a percentage. Sizes (width, height, their inline and
 * block forms) and the origins a layout resolves (transform-origin,
 * perspective-origin) are not read at all, and a property an animation or a
 * transition is moving at the time is left out of that element's line.
 * Where a thing is placed (its offsets, transform, translate, rotate and
 * scale) is read as its stylesheet says, `left: 50%` as `50%`, except where
 * its own style attribute sets it: that is script's, which measures the page
 * to place a flying butterfly or a cropped image, so it would move with the
 * fonts.
 *
 * ::before and ::after have no computedStyleMap, so they are read through
 * getComputedStyle, whose padding and margin are the used values: none of
 * the app's pseudo-elements has a percentage or `auto` there, which would tie
 * them to the layout. Where one is placed, which getComputedStyle gives in
 * pixels a layout worked out, is not read for them.
 *
 * Each line is an element's tag and classes, with the properties that say
 * something about it: an inherited one only where it differs from its
 * parent's, any other only where it differs from the default below. Nothing
 * is lost by that (the parent's line, or the default, holds the value), and a
 * change to a rule shows on the lines of the elements it reaches. An element
 * with nothing of its own, holding nothing that has, has no line.
 */

/** Properties children take from their parent, recorded where they differ from it. */
const INHERITED = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-align',
  'text-shadow',
  'white-space-collapse',
  'text-wrap-mode',
  'visibility',
  'list-style-type',
  'fill',
  'stroke',
  'stroke-width',
] as const

/**
 * Properties each element has for itself, recorded where they differ from
 * this default. A group of sides is read as one value, "top right bottom
 * left", written once when they agree.
 */
const OWN: ReadonlyArray<readonly [name: string, longhands: readonly string[], initial: string]> = [
  ['position', ['position'], 'static'],
  ['z-index', ['z-index'], 'auto'],
  ['opacity', ['opacity'], '1'],
  ['background-color', ['background-color'], 'transparent'],
  ['background-image', ['background-image'], 'none'],
  ['background-size', ['background-size'], 'auto'],
  ['background-position', ['background-position-x', 'background-position-y'], '0%'],
  ['background-repeat', ['background-repeat'], 'repeat'],
  ['border-radius', ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'], '0px'],
  ['box-shadow', ['box-shadow'], 'none'],
  ['padding', ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'], '0px'],
  ['margin', ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'], '0px'],
  ['inset', ['top', 'right', 'bottom', 'left'], 'auto'],
  ['transform', ['transform'], 'none'],
  ['translate', ['translate'], 'none'],
  ['rotate', ['rotate'], 'none'],
  ['scale', ['scale'], 'none'],
  ['gap', ['row-gap', 'column-gap'], 'normal'],
  ['flex-direction', ['flex-direction'], 'row'],
  ['flex-wrap', ['flex-wrap'], 'nowrap'],
  ['align-items', ['align-items'], 'normal'],
  ['justify-content', ['justify-content'], 'normal'],
  ['overflow', ['overflow-x', 'overflow-y'], 'visible'],
  ['text-decoration-line', ['text-decoration-line'], 'none'],
  ['filter', ['filter'], 'none'],
  ['backdrop-filter', ['backdrop-filter'], 'none'],
  ['mix-blend-mode', ['mix-blend-mode'], 'normal'],
  ['object-fit', ['object-fit'], 'fill'],
  ['stop-color', ['stop-color'], '#000000'],
  ['stop-opacity', ['stop-opacity'], '1'],
]

/**
 * Where a thing is placed (see the top of this file): read only from a
 * stylesheet, and never for a pseudo-element.
 */
const PLACEMENT = ['inset', 'transform', 'translate', 'rotate', 'scale']

/**
 * A border is read side by side: its style, and its width and colour only
 * where it is drawn (a colour on no border is no change, and the computed
 * width of an undrawn side is still `medium`). An outline likewise.
 */
const SIDES = ['top', 'right', 'bottom', 'left']
const OUTLINE = ['outline-style', 'outline-width', 'outline-color', 'outline-offset']

/** How each element is displayed when nothing but the browser says (any other: block). */
const DISPLAY: Record<string, string> = {
  a: 'inline', span: 'inline', strong: 'inline', em: 'inline', b: 'inline', i: 'inline', small: 'inline',
  label: 'inline', img: 'inline', svg: 'inline', time: 'inline', abbr: 'inline', code: 'inline', kbd: 'inline',
  li: 'list-item', summary: 'list-item', button: 'inline-block', input: 'inline-block',
  select: 'inline-block', textarea: 'inline-block', progress: 'inline-block', meter: 'inline-block',
  table: 'table', tr: 'table-row', td: 'table-cell', th: 'table-cell', thead: 'table-header-group',
  tbody: 'table-row-group', g: 'inline', path: 'inline', circle: 'inline', ellipse: 'inline',
  rect: 'inline', line: 'inline', polygon: 'inline', polyline: 'inline', use: 'inline', defs: 'none',
  symbol: 'none', lineargradient: 'none', radialgradient: 'none', stop: 'inline', clippath: 'none',
  mask: 'none', filter: 'none', text: 'inline', tspan: 'inline',
}

/** Never drawn, or drawn by the browser alone. */
const SKIP = ['script', 'style', 'link', 'meta', 'template', 'noscript', 'title', 'head', 'br', 'wbr']

/**
 * Classes left out of an element's name: set while it is out of view, which
 * depends on how far down the page it is, and so on how its text wrapped.
 */
const UNNAMED = ['flight-paused']

interface Config {
  inherited: readonly string[]
  own: typeof OWN
  placement: string[]
  sides: string[]
  outline: string[]
  display: Record<string, string>
  skip: string[]
  unnamed: string[]
}

/**
 * Runs in the page: a line for each element under <html> that has one,
 * indented two spaces a level, in document order.
 */
function collect(config: Config): string[] {
  const hex = (channel: string) => Math.round(Number(channel)).toString(16).padStart(2, '0')
  const shorten = (value: string) =>
    value
      .replace(/url\("?([^")]*)"?\)/g, (_match, url: string) => {
        // A paint server by its name, without the per-render id React adds.
        if (url.startsWith('#')) return `url(${url.replace(/-[A-Za-z0-9]+$/, '')})`
        if (!url.startsWith('data:')) return `url(${url.split('/').pop() ?? url})`
        // A data URL stands for its content: a short hash of it.
        let hash = 2166136261
        for (let index = 0; index < url.length; index += 1) {
          hash = Math.imul(hash ^ url.charCodeAt(index), 16777619)
        }
        return `url(data:${(hash >>> 0).toString(36)})`
      })
      .replace(/rgba?\(([^)]*)\)/g, (_match, channels: string) => {
        const [red, green, blue, alpha = '1'] = channels.split(/[\s,/]+/).filter(Boolean)
        if (Number(alpha) === 0) return 'transparent'
        const opaque = `#${hex(red)}${hex(green)}${hex(blue)}`
        return Number(alpha) === 1 ? opaque : `${opaque}${hex(String(Number(alpha) * 255))}`
      })
  const sides = (values: string[]) =>
    values.every((value) => value === values[0]) ? values[0] : values.join(' ')

  // What each animation or transition is moving, by element and pseudo-element.
  const moving = new Map<Element, Map<string, Set<string>>>()
  for (const animation of document.getAnimations()) {
    const effect = animation.effect as KeyframeEffect | null
    if (!effect?.target) continue
    const byPseudo = moving.get(effect.target) ?? new Map<string, Set<string>>()
    const properties = byPseudo.get(effect.pseudoElement ?? '') ?? new Set<string>()
    if (animation instanceof CSSTransition) properties.add(animation.transitionProperty)
    for (const frame of effect.getKeyframes()) {
      for (const property of Object.keys(frame)) {
        properties.add(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`))
      }
    }
    byPseudo.set(effect.pseudoElement ?? '', properties)
    moving.set(effect.target, byPseudo)
  }
  const animated = (element: Element, pseudo = '') =>
    moving.get(element)?.get(pseudo) ?? new Set<string>()

  type Read = (property: string) => string
  const describe = (
    read: Read,
    parent: Record<string, string>,
    moved: Set<string>,
    displayDefault: string,
    /** The element whose style attribute may place it; none for a pseudo-element. */
    element: Element | undefined,
  ) => {
    const pseudo = element === undefined
    const inline = (element as HTMLElement | SVGElement | undefined)?.style
    const inherited: Record<string, string> = {}
    const parts: string[] = []
    const display = read('display')
    if (display !== displayDefault) parts.push(`display: ${display}`)
    if (pseudo) parts.push(`content: ${shorten(read('content'))}`)
    for (const property of config.inherited) {
      if (moved.has(property)) {
        inherited[property] = parent[property] ?? ''
        continue
      }
      const value = shorten(read(property))
      inherited[property] = value
      if (value !== parent[property]) parts.push(`${property}: ${value}`)
    }
    for (const [name, longhands, initial] of config.own) {
      if (config.placement.includes(name)) {
        if (pseudo || longhands.some((longhand) => inline?.getPropertyValue(longhand))) continue
      }
      if (moved.has(name) || longhands.some((longhand) => moved.has(longhand))) continue
      const value = sides(longhands.map((longhand) => shorten(read(longhand))))
      // A background of several layers, each at the default, is the default.
      if (value.split(', ').every((layer) => layer === initial)) continue
      parts.push(`${name}: ${value}`)
    }
    const styles = config.sides.map((side) => read(`border-${side}-style`))
    const drawn = (index: number) => styles[index] !== 'none' && styles[index] !== 'hidden'
    if (styles.some((_style, index) => drawn(index))) {
      const each = (property: string) =>
        sides(config.sides.map((side, index) => (drawn(index) ? shorten(read(`border-${side}-${property}`)) : '-')))
      parts.push(`border: ${sides(styles)} ${each('width')}`)
      if (!moved.has('border-color') && !config.sides.some((side) => moved.has(`border-${side}-color`))) {
        parts.push(`border-color: ${each('color')}`)
      }
    }
    if (read('outline-style') !== 'none' && !config.outline.some((property) => moved.has(property))) {
      parts.push(`outline: ${config.outline.map((property) => shorten(read(property))).join(' ')}`)
    }
    return { inherited, parts }
  }

  const walk = (element: Element, depth: number, parent: Record<string, string>): string[] => {
    const tag = element.localName
    if (config.skip.includes(tag)) return []
    const map = element.computedStyleMap()
    const read: Read = (property) => map.get(property)?.toString() ?? ''
    const classes = (element.getAttribute('class') ?? '')
      .trim()
      .split(/\s+/)
      .filter((name) => name && !config.unnamed.includes(name))
    const type = tag === 'input' ? `[type=${element.getAttribute('type') ?? 'text'}]` : ''
    const name = [tag + type, ...classes].join('.')
    const { inherited, parts } = describe(read, parent, animated(element), config.display[tag] ?? 'block', element)
    const indent = '  '.repeat(depth)
    const lines = [`${indent}${name}${parts.length ? ` { ${parts.join('; ')} }` : ''}`]
    if (read('display') === 'none') return lines
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(element, pseudo)
      if (style.content === 'none' || style.content === 'normal') continue
      const described = describe(
        (property) => style.getPropertyValue(property),
        inherited,
        animated(element, pseudo),
        'inline',
        undefined,
      )
      lines.push(`${indent}  ${pseudo} { ${described.parts.join('; ')} }`)
    }
    for (const child of Array.from(element.children)) lines.push(...walk(child, depth + 1, inherited))
    // Drawn with nothing of its own, and holding nothing that is: no line.
    return lines.length === 1 && parts.length === 0 ? [] : lines
  }

  return walk(document.documentElement, 0, {})
}

/**
 * Wait until the page is still: nothing loading, fonts in, every animation
 * that ends ended (one that never ends is left out property by property),
 * and the pointer off everything.
 */
export async function settle(page: Page) {
  await page.mouse.move(0, 0)
  await page.waitForFunction(() => !document.querySelector('.view-loading, .splash-screen'))
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => {
      if (animation.playState !== 'running') return true
      return animation.effect?.getComputedTiming().endTime === Infinity
    }),
  )
  // Two frames, so a class set by an effect after the last paint has landed.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** The lines describing the page as it is drawn now. */
export async function styleLines(page: Page): Promise<string[]> {
  return page.evaluate(collect, {
    inherited: INHERITED,
    own: OWN,
    placement: PLACEMENT,
    sides: SIDES,
    outline: OUTLINE,
    display: DISPLAY,
    skip: SKIP,
    unnamed: UNNAMED,
  })
}

/**
 * A baseline file: every distinct line, and the states it is drawn in.
 *
 * Kept as an inventory rather than a tree, because most of every page (the
 * header, the dock, a card) is drawn alike on many pages and in both
 * themes: each line is written once. `lines` maps a line to the states it
 * is in, by their place in `states` ("0-4 7": states 0 to 4, and 7). A
 * change to a rule moves the lines of what it reaches.
 *
 * Which lines a state draws, not how many times: a page with more of the
 * same (one more release on What's new, a longer list) draws nothing new,
 * and matches. A change to how anything is drawn makes a line that was not
 * there before.
 */
interface BaselineFile {
  about: string
  states: string[]
  lines: Record<string, string>
}

/** For each state, the distinct lines drawn in it. */
export type Drawn = Map<string, Set<string>>

export function distinctLines(lines: string[]): Set<string> {
  return new Set(lines.map((line) => line.trim()))
}

export function readBaselines(file: string): Drawn {
  const drawn: Drawn = new Map()
  if (!existsSync(file)) return drawn
  const stored = JSON.parse(readFileSync(file, 'utf8')) as BaselineFile
  for (const state of stored.states) drawn.set(state, new Set())
  for (const [line, where] of Object.entries(stored.lines)) {
    for (const token of where.split(' ')) {
      const [, from, to] = /^(\d+)(?:-(\d+))?$/.exec(token) ?? []
      for (let index = Number(from); index <= Number(to ?? from); index += 1) {
        drawn.get(stored.states[index])?.add(line)
      }
    }
  }
  return drawn
}

export function writeBaselines(file: string, drawn: Drawn, about: string) {
  const states = [...drawn.keys()].sort()
  const where = new Map<string, number[]>()
  states.forEach((state, index) => {
    for (const line of drawn.get(state) ?? []) where.set(line, [...(where.get(line) ?? []), index])
  })
  const lines: Record<string, string> = {}
  for (const line of [...where.keys()].sort()) {
    const tokens: string[] = []
    let run: [number, number] | undefined
    const close = () => {
      if (run) tokens.push(`${run[0]}${run[1] > run[0] ? `-${run[1]}` : ''}`)
    }
    for (const index of where.get(line) ?? []) {
      if (run && run[1] === index - 1) run[1] = index
      else {
        close()
        run = [index, index]
      }
    }
    close()
    lines[line] = tokens.join(' ')
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ about, states, lines } satisfies BaselineFile, null, 1)}\n`)
}

/**
 * What changed in one state, readably: each line no longer drawn, and each
 * one drawn now that was not before, with where it is on the page, so the
 * rule that moved can be found. Empty when nothing did.
 */
export function describeChanges(expected: Set<string>, actualLines: string[], limit = 30): string {
  const actual = distinctLines(actualLines)
  const out: string[] = []
  const where = (line: string) => {
    const index = actualLines.findIndex((candidate) => candidate.trim() === line)
    const chain: string[] = []
    let depth = (actualLines[index].match(/^ */)?.[0].length ?? 0) / 2
    for (let at = index - 1; at >= 0 && depth > 0; at -= 1) {
      const own = (actualLines[at].match(/^ */)?.[0].length ?? 0) / 2
      if (own < depth) {
        chain.unshift(actualLines[at].trim().split(' {')[0])
        depth = own
      }
    }
    return chain.join(' > ') || '(the root)'
  }
  for (const line of expected) if (!actual.has(line)) out.push(`- ${line}`)
  for (const line of actual) if (!expected.has(line)) out.push(`+ ${line}\n      in ${where(line)}`)
  if (out.length > limit) return [...out.slice(0, limit), `… and ${out.length - limit} more`].join('\n')
  return out.join('\n')
}
