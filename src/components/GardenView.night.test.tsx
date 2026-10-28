import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { backdropAssets, loadBackdrop } from '../data/backdropAssets'
import { GardenView } from './GardenView'

vi.mock('../data/backdropAssets', async (original) => ({
  ...await original<typeof import('../data/backdropAssets')>(),
  loadBackdrop: vi.fn(),
}))
beforeEach(() => vi.mocked(loadBackdrop).mockReset().mockResolvedValue())
const state = createInitialState('Tester', 'Moonlit')
const props = {
  state, onPlant: vi.fn(), onRemovePlant: vi.fn(), onPlaceJar: vi.fn(),
  onRemoveJarPlacement: vi.fn(), onSelectCompanion: vi.fn(),
  onRenameCreature: vi.fn(), onOpenCare: vi.fn(),
}
const image = (container: HTMLElement) => (container.querySelector('.garden-hero') as HTMLElement).style.backgroundImage
describe('the built-in night paintings', () => {
  it('keeps the decoded day visible until night finishes decoding', async () => {
    const { container, rerender } = render(<GardenView {...props} theme="sunlight" />)
    await waitFor(() => expect(loadBackdrop).toHaveBeenCalled())
    let finish!: () => void
    vi.mocked(loadBackdrop).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    rerender(<GardenView {...props} theme="night" />)
    expect(image(container)).toContain(backdropAssets['sunlit-meadow'].image)
    await act(async () => { finish(); await Promise.resolve() })
    expect(image(container)).toContain(backdropAssets['sunlit-meadow'].night)
  })
  it('falls back to the same day scene if the night image cannot load', async () => {
    vi.mocked(loadBackdrop).mockRejectedValueOnce(new Error('offline'))
    const { container } = render(<GardenView {...props} theme="night" />)
    await waitFor(() => expect(image(container)).toContain(backdropAssets['sunlit-meadow'].image))
    expect(container.querySelector('.garden-hero')).not.toHaveAttribute('data-night-art')
  })
  it('ignores a stale night completion after switching back to day', async () => {
    let finish!: () => void
    vi.mocked(loadBackdrop).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    const { container, rerender } = render(<GardenView {...props} theme="night" />)
    rerender(<GardenView {...props} theme="sunlight" />)
    await waitFor(() => expect(image(container)).toContain(backdropAssets['sunlit-meadow'].image))
    await act(async () => { finish(); await Promise.resolve() })
    expect(image(container)).toContain(backdropAssets['sunlit-meadow'].image)
  })
})
