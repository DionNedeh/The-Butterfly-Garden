import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { backdropUnlockDays, gardenBackdrops } from '../lib/appearance'
import { createInitialState } from '../lib/progression'
import type { AppState, CustomBackdrop, Profile } from '../types'
import { BackdropGallery } from './BackdropGallery'

function renderGallery(createdDaysAgo: number) {
  const seed = createInitialState('Tester', 'Scenes')
  const created = new Date()
  created.setDate(created.getDate() - createdDaysAgo)
  render(
    <BackdropGallery
      state={{ ...seed, profile: { ...seed.profile!, createdAt: created.toISOString() } }}
      onSelectBackdrop={vi.fn()}
      onSaveCustomBackdrop={vi.fn(() => Promise.resolve({ ok: true }))}
      onSelectCustomBackdrop={vi.fn()}
      onDeleteCustomBackdrop={vi.fn()}
    />,
  )
}

describe('scenes that grow with the garden', () => {
  it('say how many days are left, with a ring showing how far along they are', () => {
    const scene = gardenBackdrops.find((item) => backdropUnlockDays(item) > 2)!
    const wait = backdropUnlockDays(scene)
    renderGallery(1)
    const button = screen.getByRole('button', { name: `Opens in ${wait - 1} days` })
    const ring = button.querySelector<HTMLElement>('.unlock-ring')!
    expect(ring.style.getPropertyValue('--ripeness')).toBe(`${Math.round((100 * 1) / wait)}%`)
  })
})

describe('an image by day and another by night', () => {
  const picture = (id: string, name: string): CustomBackdrop => ({
    id,
    name,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    mimeType: 'image/webp',
    width: 400,
    height: 300,
    byteLength: 3,
    imageData: 'AAAA',
    crop: { x: 0.5, y: 0.5, zoom: 1 },
  })

  function renderPictured(profile: Partial<Profile> = {}, images = [picture('a', 'Meadow'), picture('b', 'Lamplight')]) {
    const seed = createInitialState('Tester', 'Pictured')
    const state: AppState = {
      ...seed,
      customBackdrops: images,
      profile: { ...seed.profile!, ...profile },
    }
    const actions = {
      onSelectBackdrop: vi.fn(),
      onSaveCustomBackdrop: vi.fn(() => Promise.resolve({ ok: true })),
      onSelectCustomBackdrop: vi.fn(),
      onDeleteCustomBackdrop: vi.fn(),
      onChooseNightBackdrop: vi.fn(),
    }
    render(<BackdropGallery state={state} {...actions} />)
    return { actions, user: userEvent.setup() }
  }

  const nightChoices = () => within(screen.getByRole('group', { name: 'By night' }))

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('offers the same as by day first, saying what the day shows, then each image', async () => {
    const { actions, user } = renderPictured({ selectedCustomBackdropId: 'a' })
    const same = nightChoices().getByRole('radio', { name: /^The same as by day/ })
    expect(same).toBeChecked()
    expect(same.closest('label')).toHaveTextContent('Meadow')
    const lamplight = nightChoices().getByRole('radio', { name: 'Lamplight' })
    expect(lamplight).not.toBeChecked()

    await user.click(lamplight)
    expect(actions.onChooseNightBackdrop).toHaveBeenCalledWith('b')
  })

  it('shows the night image chosen, and goes back to the day’s', async () => {
    const { actions, user } = renderPictured({ nightCustomBackdropId: 'b' })
    expect(nightChoices().getByRole('radio', { name: 'Lamplight' })).toBeChecked()
    const same = nightChoices().getByRole('radio', { name: /^The same as by day/ })
    // No image by day: the day shows the scene.
    expect(same.closest('label')).toHaveTextContent('Sunlit Meadow')
    await user.click(same)
    expect(actions.onChooseNightBackdrop).toHaveBeenCalledWith(undefined)
  })

  it('reads a night choice that names no image as the same as by day', () => {
    renderPictured({ nightCustomBackdropId: 'gone' })
    expect(nightChoices().getByRole('radio', { name: /^The same as by day/ })).toBeChecked()
  })

  it('offers no night choice before there is an image to choose', () => {
    renderPictured({}, [])
    expect(screen.queryByRole('group', { name: 'By night' })).toBeNull()
  })

  it('saves the night’s own image without making it the day’s too', async () => {
    const { actions, user } = renderPictured({
      selectedCustomBackdropId: 'a',
      nightCustomBackdropId: 'b',
    })
    const lamplight = screen.getByRole('heading', { name: 'Lamplight' }).closest('article')!
    await user.click(within(lamplight).getByRole('button', { name: 'Edit image' }))
    await user.click(await screen.findByRole('button', { name: 'Save night image', hidden: true }))
    expect(actions.onSaveCustomBackdrop).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b' }),
      false,
    )
  })

  it('saves and chooses any other image, as before', async () => {
    const { actions, user } = renderPictured({ nightCustomBackdropId: 'b', selectedCustomBackdropId: 'b' })
    const lamplight = screen.getByRole('heading', { name: 'Lamplight' }).closest('article')!
    await user.click(within(lamplight).getByRole('button', { name: 'Edit image' }))
    await user.click(await screen.findByRole('button', { name: 'Save & use backdrop', hidden: true }))
    expect(actions.onSaveCustomBackdrop).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }))
    expect(actions.onSaveCustomBackdrop.mock.calls[0]).toHaveLength(1)
  })
})
