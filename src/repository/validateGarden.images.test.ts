import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'

const checks = vi.hoisted(() => ({ count: 0 }))
vi.mock('../lib/customBackdrops', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/customBackdrops')>()
  return {
    ...actual,
    isValidCustomBackdropCollection: (value: unknown) => {
      checks.count += 1
      return actual.isValidCustomBackdropCollection(value)
    },
  }
})

const { validateGarden } = await import('./validateGarden')

describe('image collections in a synced garden', () => {
  it('checks a collection once, and a changed one again', () => {
    const base = createInitialState('Tester', 'Images')
    const images: unknown[] = []
    checks.count = 0

    validateGarden({ ...base, customBackdrops: images })
    // A sync from another tab: same images, other parts changed.
    validateGarden({ ...base, seeds: 9, customBackdrops: images })
    expect(checks.count).toBe(1)

    validateGarden({ ...base, customBackdrops: [] })
    expect(checks.count).toBe(2)
  })

  it('never remembers a collection that failed', () => {
    const base = createInitialState('Tester', 'Images')
    const damaged = [{ id: 'x' }]
    checks.count = 0
    expect(validateGarden({ ...base, customBackdrops: damaged }).refused).toMatch(/damaged/)
    expect(validateGarden({ ...base, customBackdrops: damaged }).refused).toMatch(/damaged/)
    expect(checks.count).toBe(2)
  })
})
