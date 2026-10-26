import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { backdropUnlockDays, gardenBackdrops } from '../lib/appearance'
import { createInitialState } from '../lib/progression'
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
