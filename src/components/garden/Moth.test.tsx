import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Moth } from './Moth'

afterEach(() => vi.unstubAllGlobals())
describe('decorative moth drawings', () => {
  it.each([false, true])('draws the %s resting design on HTML-level sprite layers', (resting) => {
    const { container } = render(<Moth resting={resting} />)
    expect(container.querySelector('.plant-moth')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.sprite-layer')).toHaveLength(3)
    expect(container.querySelectorAll('svg .sprite-layer')).toHaveLength(0)
    expect(container.querySelectorAll('path').length).toBeGreaterThan(3)
  })
  it('draws nothing when the device requests reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const { container } = render(<Moth />)
    expect(container).toBeEmptyDOMElement()
  })
})
