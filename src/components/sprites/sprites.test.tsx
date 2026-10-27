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

describe('sprite layers', () => {
  /** The classes the stylesheet animates. Each must sit on a layer. */
  const MOVING = [
    '.wing',
    '.plant-sway',
    '.egg-wobble',
    '.caterpillar-inch',
    '.chrysalis-sway',
    '.aura-layer',
  ].join(', ')

  function expectMotionOnLayers(container: HTMLElement) {
    const moving = [...container.querySelectorAll(MOVING)]
    expect(moving.length).toBeGreaterThan(0)
    for (const element of moving) {
      // Chromium animates a layer on the compositor, but an element inside
      // an SVG on the main thread, with a layout every frame.
      expect(element.tagName.toLowerCase()).toBe('svg')
      expect(element.classList.contains('sprite-layer')).toBe(true)
      expect(element.parentElement?.classList.contains('sprite-frame')).toBe(true)
    }
  }

  it('animates a butterfly only through its layers', () => {
    const { container } = render(
      <ButterflySprite
        speciesId="monarch"
        outfit={{ aura: 'sparkle-aura', headwear: 'flower-crown', accessory: 'silk-bow' }}
      />,
    )
    expectMotionOnLayers(container)
    expect(container.querySelectorAll('.wing')).toHaveLength(2)
  })

  it('animates every life stage and plant only through layers', () => {
    const stages: CreatureStage[] = ['egg', 'caterpillar', 'chrysalis']
    for (const stage of stages) {
      const { container, unmount } = render(
        <CreatureSprite speciesId="monarch" stage={stage} outfit={{ aura: 'firefly-glow' }} />,
      )
      expectMotionOnLayers(container)
      unmount()
    }
    for (const growth of [0, 1, 2, 3]) {
      const { container, unmount } = render(<FlowerSprite plantId="aster" growth={growth} />)
      expectMotionOnLayers(container)
      unmount()
    }
  })

  it('keeps the drawing order: wings, body, aura, then what is worn', () => {
    const { container } = render(
      <ButterflySprite
        speciesId="monarch"
        outfit={{ aura: 'sparkle-aura', headwear: 'flower-crown' }}
      />,
    )
    const layers = [...container.querySelectorAll('.sprite-frame > .sprite-layer')]
    expect(layers.map((layer) => layer.getAttribute('class'))).toEqual([
      'sprite-layer wing wing-left',
      'sprite-layer wing wing-right',
      'sprite-layer ',
      'sprite-layer aura-layer aura-motion-sparkle',
      'sprite-layer ',
    ])
    expect(layers[4].querySelector('.outfit-overlay')).not.toBeNull()
  })

  it('names a creature and hides a flower from assistive technology', () => {
    const { getByRole, container } = render(
      <>
        <CreatureSprite speciesId="monarch" stage="egg" label="Sunny" />
        <FlowerSprite plantId="aster" growth={3} />
      </>,
    )
    expect(getByRole('img', { name: 'Sunny egg' })).toBeTruthy()
    expect(container.querySelector('.flower-sprite')?.getAttribute('aria-hidden')).toBe('true')
    for (const layer of container.querySelectorAll('.sprite-layer')) {
      expect(layer.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

describe('every plant at every stage', () => {
  it('draws something for each plant in the catalogue, at each growth', async () => {
    const { plants } = await import('../../data/content')
    for (const plant of plants) {
      for (const growth of [0, 1, 2, 3]) {
        const { container, unmount } = render(<FlowerSprite plantId={plant.id} growth={growth} />)
        const layer = container.querySelector('.plant-sway')
        const shapes = layer?.querySelectorAll('path, circle, ellipse, rect').length ?? 0
        expect(`${plant.id}@${growth}: ${shapes > 0}`).toBe(
          `${plant.id}@${growth}: true`,
        )
        unmount()
      }
    }
  })

  it('draws an unknown plant rather than nothing', () => {
    const { container } = render(<FlowerSprite plantId="not-a-plant" growth={3} />)
    expect(container.querySelector('.plant-sway path, .plant-sway circle')).not.toBeNull()
  })
})
