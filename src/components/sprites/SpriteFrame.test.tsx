import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

type Callback = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void

describe('sprites out of view', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('pause while off screen and resume when they return, through one observer', async () => {
    const created: Array<{ callback: Callback; observed: Set<Element> }> = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observed = new Set<Element>()
        constructor(callback: Callback) {
          created.push({ callback, observed: this.observed })
        }
        observe(element: Element) {
          this.observed.add(element)
        }
        unobserve(element: Element) {
          this.observed.delete(element)
        }
        disconnect() {}
      },
    )
    // Fresh module, so its shared observer is built on the stub above.
    const { SpriteFrame, SpriteLayer } = await import('./SpriteFrame')
    const sprite = (key: string) => (
      <SpriteFrame key={key} width={10} height={10} className="test-sprite">
        <SpriteLayer viewBox="0 0 10 10">
          <circle r="1" />
        </SpriteLayer>
      </SpriteFrame>
    )
    const { container, unmount } = render(<>{['a', 'b', 'c'].map(sprite)}</>)

    expect(created).toHaveLength(1)
    const [{ callback, observed }] = created
    expect(observed.size).toBe(3)

    const [first, second] = container.querySelectorAll('.sprite-frame')
    act(() =>
      callback([
        { target: first, isIntersecting: false },
        { target: second, isIntersecting: true },
      ]),
    )
    expect(first.hasAttribute('data-offscreen')).toBe(true)
    expect(second.hasAttribute('data-offscreen')).toBe(false)

    act(() => callback([{ target: first, isIntersecting: true }]))
    expect(first.hasAttribute('data-offscreen')).toBe(false)

    unmount()
    expect(observed.size).toBe(0)
  })
})
