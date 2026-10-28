import { readText } from './woff2'

// Through a variable: Vite turns `new URL('…', import.meta.url)` written out
// in full into a served asset's address, and the files are wanted on disk
// (a `?raw` import of a stylesheet comes to a test empty).
const here = import.meta.url

/** The stylesheets every screen has, in the order the app loads them. */
const FIRST_LOAD = ['index.css', 'App.css', 'theme-aurora.css', 'garden-3.css']

/**
 * The app's own stylesheets put into the document, then any others named
 * (paths from src/), so jsdom can work out how something is drawn. Returns
 * how to take them out again.
 */
export function applyStylesheets(...others: string[]): () => void {
  const style = document.createElement('style')
  style.textContent = [...FIRST_LOAD, ...others]
    .map((path) => readText(new URL(`../${path}`, here)))
    .join('\n')
  document.head.append(style)
  return () => style.remove()
}

/**
 * The colour an element's text is drawn in and the colour it is filled with,
 * as #rrggbb. jsdom leaves a fill given as `var(--name)` unworked, so that
 * one is looked up here.
 */
export function paintOf(element: Element): { text: string; fill: string } {
  const look = getComputedStyle(element)
  return { text: hex(look.color), fill: hex(fillOf(look)) }
}

function fillOf(look: CSSStyleDeclaration): string {
  for (const value of [look.backgroundColor, look.getPropertyValue('background')]) {
    const named = /^var\((--[\w-]+)\)$/.exec(value.trim())
    if (named) return look.getPropertyValue(named[1]).trim()
    if (value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)') return value
  }
  throw new Error('The element has no fill of its own.')
}

function hex(colour: string): string {
  if (/^#[0-9a-f]{6}$/i.test(colour)) return colour.toLowerCase()
  const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(colour)
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) !== 1)) {
    throw new Error(`Not a solid colour: ${colour}`)
  }
  return `#${rgb
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`
}
