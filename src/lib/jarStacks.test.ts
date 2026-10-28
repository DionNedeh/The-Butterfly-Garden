import { describe, expect, it } from 'vitest'
import type { JarColorId, JarInstance } from '../types'
import { stackJars, stackKey } from './jarStacks'

const jar = (id: string, character: string, colorId: JarColorId = 'blue'): JarInstance => ({
  id,
  character,
  colorId,
  purchasedAt: '2026-10-01T12:00:00.000Z',
})

describe('stacking the jar shelf', () => {
  it('makes one stack of alike jars, and keeps different colours apart', () => {
    const jars = [jar('a1', 'A'), jar('a2', 'A'), jar('a3', 'A', 'pink'), jar('a4', 'A')]
    const stacks = stackJars(jars, [])
    expect(stacks.map((stack) => [stack.key, stack.jars.length])).toEqual([
      ['blue A', 3],
      ['pink A', 1],
    ])
    expect(stacks[0].jars.map((entry) => entry.id)).toEqual(['a1', 'a2', 'a4'])
  })

  it('says which of a stack are on no plant, in shelf order', () => {
    const jars = [jar('a1', 'A'), jar('a2', 'A'), jar('a3', 'A')]
    const [stack] = stackJars(jars, [{ jarId: 'a2', plantId: 'p1' }])
    expect(stack.loose.map((entry) => entry.id)).toEqual(['a1', 'a3'])
    expect(stack.jars).toHaveLength(3)
  })

  it('follows the shop: letters, numbers, accents, marks, and colours in its order', () => {
    const jars = [
      jar('1', '!', 'blue'),
      jar('2', 'É', 'blue'),
      jar('3', '7', 'blue'),
      jar('4', 'B', 'charcoal'),
      jar('5', 'B', 'blue'),
      jar('6', 'A', 'white'),
    ]
    expect(stackJars(jars, []).map((stack) => stack.key)).toEqual([
      'white A',
      'blue B',
      'charcoal B',
      'blue 7',
      'blue É',
      'blue !',
    ])
  })

  it('has nothing to stack on an empty shelf', () => {
    expect(stackJars([], [])).toEqual([])
  })

  it('names a stack', () => {
    expect(stackKey(jar('x', '&', 'green'))).toBe('green &')
  })
})
