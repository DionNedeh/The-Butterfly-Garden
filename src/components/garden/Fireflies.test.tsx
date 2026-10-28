import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Fireflies, FIREFLY_COUNT } from './Fireflies'

/** A device whose reduced-motion preference is as given, and can change. */
function preferReducedMotion(reduce: boolean) {
  const listeners = new Set<() => void>()
  const list = {
    matches: reduce,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', (query: string) => {
    expect(query).toBe('(prefers-reduced-motion: reduce)')
    return list
  })
  return (next: boolean) => {
    list.matches = next
    listeners.forEach((listener) => listener())
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fireflies', () => {
  it('are a handful of small lights, hidden from assistive technology', () => {
    preferReducedMotion(false)
    const { container } = render(<Fireflies />)
    const field = container.querySelector('.hero-fireflies')
    expect(field).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.hero-firefly')).toHaveLength(FIREFLY_COUNT)
    expect(FIREFLY_COUNT).toBeLessThanOrEqual(6)
  })

  it('are not drawn at all where the device asks for reduced motion, and leave when it does', () => {
    const change = preferReducedMotion(true)
    const { container } = render(<Fireflies />)
    expect(container.querySelector('.hero-firefly')).toBeNull()

    act(() => change(false))
    expect(container.querySelectorAll('.hero-firefly')).toHaveLength(FIREFLY_COUNT)
    act(() => change(true))
    expect(container.querySelector('.hero-fireflies')).toBeNull()
  })

  it('pause while out of view, like the scene’s sprites', () => {
    preferReducedMotion(false)
    let report: IntersectionObserverCallback | undefined
    const observed: Element[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          report = callback
        }
        observe(element: Element) {
          observed.push(element)
        }
        disconnect() {}
      },
    )
    const { container } = render(<Fireflies />)
    const field = container.querySelector('.hero-fireflies')!
    expect(observed).toContain(field)

    const seen = (isIntersecting: boolean) =>
      report?.([{ target: field, isIntersecting } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
    seen(false)
    expect(field).toHaveAttribute('data-offscreen')
    seen(true)
    expect(field).not.toHaveAttribute('data-offscreen')
  })
})
