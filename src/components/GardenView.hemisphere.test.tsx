import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { marigoldLines } from '../data/seasons'
import { createInitialState } from '../lib/progression'
import { LAZY_PAGE_MS } from '../test/lazyPage'
import type { AppearanceTheme, Profile } from '../types'
import { GardenView } from './GardenView'

/*
 * 1.4: a gardener whose region is Elsewhere, or not chosen, who said they are
 * in the south, gets the south's seasons in the scene and in Marigold's travels.
 */

/** Midday on a local calendar day, as this device's clock would have it. */
function at(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(year, month - 1, day, 12) })
}

function renderGarden(profile: Partial<Profile>, theme?: AppearanceTheme) {
  const seed = createInitialState('Tester', 'Test Garden')
  return render(
    <GardenView
      state={{ ...seed, profile: { ...seed.profile!, ...profile } }}
      theme={theme}
      onPlant={vi.fn()}
      onRemovePlant={vi.fn()}
      onPlaceJar={vi.fn()}
      onRemoveJarPlacement={vi.fn()}
      onSelectCompanion={vi.fn()}
      onRenameCreature={vi.fn()}
      onOpenCare={vi.fn()}
    />,
  )
}

const scene = (container: HTMLElement) => container.querySelector('.garden-hero')!
const fireflies = (container: HTMLElement) => container.querySelectorAll('.hero-firefly')

afterEach(() => {
  vi.useRealTimers()
})

describe('1.4 the south, chosen where the region does not say', () => {
  it('makes July winter on the scene, with no fireflies at night', async () => {
    at('2026-07-15')
    for (const region of ['elsewhere', undefined] as const) {
      const { container, unmount } = renderGarden({ region, hemisphere: 'south' }, 'night')
      expect(scene(container)).toHaveAttribute('data-season', 'winter')
      // Long enough for a lazily loaded part to have arrived, had one been asked for.
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(fireflies(container)).toHaveLength(0)
      unmount()
    }
  })

  it('leaves a garden that chose nothing as it was: the north’s summer, fireflies and all', async () => {
    at('2026-07-15')
    const { container } = renderGarden({ region: 'elsewhere' }, 'night')
    expect(scene(container)).toHaveAttribute('data-season', 'summer')
    await waitFor(() => expect(fireflies(container).length).toBeGreaterThan(0))
  })

  it('sends Marigold on her travels in the south’s autumn', async () => {
    at('2026-04-15')
    const user = userEvent.setup()
    renderGarden({ region: 'elsewhere', hemisphere: 'south' }, 'sunlight')
    await user.click(screen.getByRole('button', { name: /^Meet Marigold/ }))
    const card = await screen.findByRole('dialog', { name: 'Marigold' }, { timeout: LAZY_PAGE_MS })
    expect(card).toHaveTextContent(marigoldLines.south.autumn!)
  })
})
