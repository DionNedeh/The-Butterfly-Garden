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
    undo()
    expect(root.style.fontSize).toBe('')
  })

  it('sets nothing at the usual size', () => {
    const root = document.createElement('div')
    const undo = applyTextSize(undefined, root)
    expect(root.getAttribute('style')).toBeNull()
    undo()
    expect(root.getAttribute('style')).toBeNull()
  })
})
