import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppearanceTheme, AppState, CustomBackdrop, Profile } from '../types'
import { GardenView } from './GardenView'

const picture = (id: string, data: string, brightness?: number): CustomBackdrop => ({
  id,
  name: id,
  createdAt: '2026-10-26T10:00:00.000Z',
  updatedAt: '2026-10-26T10:00:00.000Z',
  mimeType: 'image/webp',
  width: 400,
  height: 300,
  byteLength: 3,
  imageData: data,
  crop: { x: 0.5, y: 0.5, zoom: 1 },
  ...(brightness === undefined ? {} : { brightness }),
})

function renderGarden(profile: Partial<Profile>, theme?: AppearanceTheme) {
  const seed = createInitialState('Tester', 'Pictured')
  const state: AppState = {
    ...seed,
    customBackdrops: [picture('day', 'DDDD'), picture('night', 'NNNN', -30)],
    profile: { ...seed.profile!, ...profile },
  }
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
      theme={theme}
    />,
  )
}

const shown = () => document.querySelector<HTMLImageElement>('.custom-scene-layer img')

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

describe('the gardener’s image by day and by night', () => {
  it('shows the night image while the theme on screen is night', () => {
    renderGarden({ selectedCustomBackdropId: 'day', nightCustomBackdropId: 'night' }, 'night')
    expect(shown()?.src).toContain('NNNN')
    // Darkened on the picture alone; the heading over it is left as it is.
    expect(shown()?.style.filter).toBe('brightness(0.7)')
    expect(screen.getByRole('heading', { level: 1 }).style.filter).toBe('')
  })

  it('shows the day image by day, unfiltered when it was never adjusted', () => {
    renderGarden({ selectedCustomBackdropId: 'day', nightCustomBackdropId: 'night' }, 'sunlight')
    expect(shown()?.src).toContain('DDDD')
    expect(shown()?.style.filter).toBe('')
  })

  it('shows the scene by day when only the night has an image', () => {
    renderGarden({ nightCustomBackdropId: 'night' }, 'sunlight')
    expect(shown()).toBeNull()
    expect(screen.queryByText(/personal backdrop is currently unavailable/)).toBeNull()
  })

  it('says so when the night’s image cannot be shown', () => {
    renderGarden({ nightCustomBackdropId: 'gone' }, 'night')
    expect(shown()).toBeNull()
    expect(screen.getByText(/personal backdrop is currently unavailable/)).toBeInTheDocument()
  })
})
