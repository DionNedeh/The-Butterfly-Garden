import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CreatureStage } from '../../types'
import { ButterflySprite } from './ButterflySprite'
import { CreatureSprite } from './CreatureSprite'
import { FlowerSprite } from './FlowerSprite'

function duplicateIds(root: ParentNode): string[] {
  const seen = new Map<string, number>()
  for (const element of root.querySelectorAll('[id]')) {
    seen.set(element.id, (seen.get(element.id) ?? 0) + 1)
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id)
}

describe('sprite ids', () => {
  it('keeps every gradient, clip path and pattern unique across butterflies', () => {
    // A dozen butterflies fly in the garden at once; a shared literal id would
    // make url(#…) resolve to whichever copy happened to render first.
    const { container } = render(
      <>
        {Array.from({ length: 12 }, (_, index) => (
          <ButterflySprite key={index} speciesId="blue-morpho" label={`Butterfly ${index}`} />
        ))}
      </>,
    )
    expect(duplicateIds(container)).toEqual([])
  })

  it('keeps flower pattern ids unique across a full garden', () => {
    const { container } = render(
      <>
        {Array.from({ length: 8 }, (_, index) => (
          <FlowerSprite key={index} plantId="coneflower" growth={3} />
        ))}
      </>,
    )
    expect(duplicateIds(container)).toEqual([])
  })

  it('keeps ids unique when several life stages share the page', () => {
    const stages: CreatureStage[] = ['egg', 'caterpillar', 'chrysalis', 'butterfly']
    const { container } = render(
      <>
        {stages.map((stage) => (
          <CreatureSprite key={stage} speciesId="monarch" stage={stage} />
        ))}
      </>,
    )
    expect(duplicateIds(container)).toEqual([])
  })
})

describe('outfit auras', () => {
  it('defines the aurora gradient inside every stage that can wear it', () => {
    // The aura used to reference a gradient declared only by the butterfly
    // sprite, so it drew strokeless on an egg, caterpillar or chrysalis.
    const stages: CreatureStage[] = ['egg', 'caterpillar', 'chrysalis', 'butterfly']
    for (const stage of stages) {
      const { container, unmount } = render(
        <CreatureSprite
          speciesId="monarch"
          stage={stage}
          outfit={{ aura: 'aurora-aura' }}
        />,
      )
      const ring = container.querySelector('.aura-aurora circle')
      expect(`${stage}: ${ring !== null}`).toBe(`${stage}: true`)

      const stroke = ring?.getAttribute('stroke') ?? ''
      const referenced = /^url\(#(.+)\)$/.exec(stroke)?.[1]
      expect(`${stage}: ${referenced !== undefined}`).toBe(`${stage}: true`)
      expect(`${stage}: ${container.querySelector(`#${referenced}`) !== null}`).toBe(
        `${stage}: true`,
      )
      unmount()
    }
  })
})
