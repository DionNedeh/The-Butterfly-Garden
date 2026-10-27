import type { TextSize } from '../types'

/**
 * The root font size for each text size. The stylesheets size text and most
 * spacing in rem, so scaling the root scales the page with it. Percentages of
 * the browser's own default, so a size the gardener already set there is
 * built on rather than replaced.
 */
const ROOT_FONT_SIZES: Record<TextSize, string> = {
  larger: '112.5%',
  largest: '125%',
}

/** The root font size to set, or undefined for the usual size. */
export function rootFontSize(size: TextSize | undefined): string | undefined {
  return size ? ROOT_FONT_SIZES[size] : undefined
}

/**
 * Set the text size on <html>, which is what rem reads, and return a function
 * that takes it off again. The usual size sets nothing at all, so the page is
 * exactly as it was before this setting existed.
 *
 * The size is also named on <html> (data-text-size), for the few rules that
 * lay out differently at a larger size: a media query cannot see a font size
 * set on the root, only the window's width.
 */
export function applyTextSize(
  size: TextSize | undefined,
  root: HTMLElement = document.documentElement,
): () => void {
  const fontSize = rootFontSize(size)
  if (!fontSize) return () => undefined
  root.style.fontSize = fontSize
  root.dataset.textSize = size
  return () => {
    root.style.removeProperty('font-size')
    delete root.dataset.textSize
  }
}
