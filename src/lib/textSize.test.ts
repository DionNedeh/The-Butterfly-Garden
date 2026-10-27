import { afterEach, describe, expect, it } from 'vitest'
import { applyTextSize, rootFontSize } from './textSize'

afterEach(() => document.documentElement.style.removeProperty('font-size'))

describe('the text size', () => {
  it('scales the root by an eighth, then a quarter', () => {
    expect(rootFontSize(undefined)).toBeUndefined()
    expect(rootFontSize('larger')).toBe('112.5%')
    expect(rootFontSize('largest')).toBe('125%')
  })

  it('sets the root font size, and takes it off again', () => {
    const root = document.documentElement
    const undo = applyTextSize('largest')
    expect(root.style.fontSize).toBe('125%')
    // Named too, for the rules a media query cannot reach.
    expect(root.dataset.textSize).toBe('largest')
    undo()
    expect(root.style.fontSize).toBe('')
    expect(root).not.toHaveAttribute('data-text-size')
  })

  it('sets nothing at the usual size', () => {
    const root = document.createElement('div')
    const undo = applyTextSize(undefined, root)
    expect(root.getAttribute('style')).toBeNull()
    expect(root).not.toHaveAttribute('data-text-size')
    undo()
    expect(root.getAttribute('style')).toBeNull()
  })
})
