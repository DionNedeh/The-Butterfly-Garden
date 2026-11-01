import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { LAZY_PAGE_MS } from '../test/lazyPage'
import { GardenView } from './GardenView'

function renderGarden(props: { openPlant?: string; withGuide?: boolean } = {}) {
  const state = createInitialState('Tester', 'Test Garden')
  const onOpenGuideAt = vi.fn()
  render(
    <GardenView
      state={state}
      onPlant={vi.fn()}
      onRemovePlant={vi.fn()}
      onPlaceJar={vi.fn()}
      onRemoveJarPlacement={vi.fn()}
      onSelectCompanion={vi.fn()}
      onRenameCreature={vi.fn()}
      onOpenCare={vi.fn()}
      onOpenGuideAt={props.withGuide === false ? undefined : onOpenGuideAt}
      openPlant={props.openPlant === 'second' ? state.plants[1].id : props.openPlant}
    />,
  )
  return { state, onOpenGuideAt, user: userEvent.setup() }
}

const plantList = () => within(screen.getByLabelText('All garden plants'))
const panel = () => document.querySelector<HTMLElement>('.plant-detail')

describe('6.4 “What does this do?” in the garden', () => {
  it('links the seeds to how seeds and plants work, remembering no plant', async () => {
    const { user, onOpenGuideAt } = renderGarden()
    const link = await screen.findByRole(
      'link',
      { name: 'What does this do? Seeds and plants, in the Guide' },
      { timeout: LAZY_PAGE_MS },
    )
    expect(link).toHaveAttribute('href', '#/guide/seeds')
    expect(link.closest('.seed-economy-note')).not.toBeNull()
    await user.click(link)
    expect(onOpenGuideAt).toHaveBeenCalledExactlyOnceWith('seeds')
  })

  it('links a plant’s growth, remembering the plant whose panel it is', async () => {
    const { user, state, onOpenGuideAt } = renderGarden()
    await user.click(plantList().getByRole('button', { name: /^Aster/ }))
    const link = await screen.findByRole(
      'link',
      { name: 'What does this do? How plants grow, in the Guide' },
      { timeout: LAZY_PAGE_MS },
    )
    expect(panel()).toContainElement(link)
    await user.click(link)
    expect(onOpenGuideAt).toHaveBeenCalledExactlyOnceWith('seeds', undefined, {
      plantId: state.plants[1].id,
    })
  })

  it('opens the panel of the plant it is told to, as the way back from the Guide does', async () => {
    renderGarden({ openPlant: 'second' })
    expect(plantList().getByRole('button', { name: /^Aster/ })).toHaveAttribute('aria-pressed', 'true')
    await screen.findByRole('heading', { level: 3, name: 'Aster' }, { timeout: LAZY_PAGE_MS })
  })

  it('offers neither link without a Guide to open', async () => {
    const { user } = renderGarden({ withGuide: false })
    await user.click(plantList().getByRole('button', { name: /^Aster/ }))
    await screen.findByRole('heading', { level: 3, name: 'Aster' }, { timeout: LAZY_PAGE_MS })
    expect(screen.queryByRole('link', { name: /^What does this do\?/ })).toBeNull()
  })
})
