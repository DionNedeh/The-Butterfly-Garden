import { describe, expect, it } from 'vitest'
import { createInitialState } from './progression'
import { isQuietWrite, markQuietWrite } from './quietWrites'

describe('quiet writes', () => {
  it('remembers exactly the garden marked, and no other', () => {
    const garden = createInitialState('Tester', 'Test Garden')
    expect(isQuietWrite(garden)).toBe(false)
    expect(markQuietWrite(garden)).toBe(garden)
    expect(isQuietWrite(garden)).toBe(true)
    // A garden with the gardener's change on top is a different object.
    expect(isQuietWrite({ ...garden, nectar: garden.nectar + 1 })).toBe(false)
  })
})
