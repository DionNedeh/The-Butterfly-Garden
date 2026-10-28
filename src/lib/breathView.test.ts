import { afterEach, describe, expect, it } from 'vitest'
import { openView, startScroll } from './breathView'

const view = { top: 133, bottom: 283 }

describe('scrolling as a session starts', () => {
  it('moves nothing already in view', () => {
    expect(startScroll({ top: 220, bottom: 270 }, { top: 150, bottom: 200 }, view)).toBe(0)
  })

  it('brings Stop up from behind the dock', () => {
    expect(startScroll({ top: 260, bottom: 310 }, { top: 190, bottom: 240 }, view)).toBe(27)
  })

  it('brings both down from under the header', () => {
    expect(startScroll({ top: 160, bottom: 210 }, { top: 90, bottom: 140 }, view)).toBe(-43)
  })

  it('keeps the count in view where the screen cannot hold both', () => {
    // Stop would need 60 down; the count would then be under the header.
    const shift = startScroll({ top: 290, bottom: 343 }, { top: 150, bottom: 207 }, view)
    expect(shift).toBe(17)
  })

  it('brings a count below the screen up into view', () => {
    expect(startScroll({ top: 470, bottom: 520 }, { top: 400, bottom: 450 }, view)).toBe(237)
  })
})

describe('the open part of the screen', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  function place(className: string, rect: Partial<DOMRect>) {
    const element = document.createElement('div')
    element.className = className
    element.getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0, ...rect }) as DOMRect
    document.body.append(element)
  }

  it('lies between the header and the dock, with a little room', () => {
    place('app-header', { top: 0, bottom: 125, height: 125 })
    place('bottom-nav', { top: 291, bottom: 376, height: 85 })
    expect(openView(document, 390)).toEqual({ top: 133, bottom: 283 })
  })

  it('reaches the foot of the screen where no dock shows', () => {
    place('app-header', { top: 0, bottom: 84, height: 84 })
    place('bottom-nav', { top: 0, bottom: 0, height: 0 })
    expect(openView(document, 600)).toEqual({ top: 92, bottom: 592 })
  })

  it('is the whole screen with neither', () => {
    expect(openView(document, 500)).toEqual({ top: 8, bottom: 492 })
  })
})
