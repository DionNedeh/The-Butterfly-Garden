import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { shopItems } from '../../data/shopItems'
import { OutfitOverlay, type OutfitAnchor } from './OutfitOverlay'
import type { OutfitSlot } from '../../types'

const anchor: OutfitAnchor = {
  headX: 0,
  headY: -10,
  bodyX: 0,
  bodyY: 4,
  scale: 1,
}

const cosmetics = shopItems.filter((item) => item.kind === 'cosmetic')

function drawn(slot: OutfitSlot, itemId: string) {
  const { container } = render(
    <svg>
      <OutfitOverlay outfit={{ [slot]: itemId }} anchor={anchor} />
    </svg>,
  )
  const overlay = container.querySelector('.outfit-overlay')
  // Anything that actually draws leaves at least one shape behind.
  return overlay?.querySelectorAll('path, circle, ellipse, rect, line, polygon')
    .length ?? 0
}

describe('every equippable cosmetic draws something', () => {
  it('has a catalog worth checking', () => {
    expect(cosmetics.length).toBeGreaterThan(0)
  })

  /**
   * The overlay picks art by item id in a switch. A catalog entry with no
   * matching branch is silently invisible: the item is buyable, equips, is
   * saved onto the creature, and nothing appears. This walks the whole catalog
   * so a new cosmetic cannot ship without its art.
   */
  it.each(cosmetics.map((item) => [item.id, item.slot] as const))(
    'draws %s',
    (itemId, slot) => {
      expect(slot).toBeDefined()
      expect(drawn(slot as OutfitSlot, itemId)).toBeGreaterThan(0)
    },
  )

  it('draws nothing for an id that is not in the catalog', () => {
    // The negative case, so the check above is known to be able to fail.
    expect(drawn('headwear', 'not-a-real-item')).toBe(0)
  })
})
