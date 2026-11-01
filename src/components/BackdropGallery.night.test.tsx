import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { backdropAssets } from '../data/backdropAssets'
import { backdropThumbnails } from '../data/backdropThumbnails'
import { gardenBackdrops } from '../lib/appearance'
import { createInitialState } from '../lib/progression'
import { readText } from '../test/woff2'
import { BackdropGallery } from './BackdropGallery'

/*
 * ART-8: the scene gallery shows each scene as it looks at night while the
 * theme on screen is night. Both thumbnails are in each card; the stylesheet
 * shows the one for the theme the app shell carries (.theme-night), so a
 * theme chosen by hand is followed as well as the device's, and the hidden
 * one, being lazy, is never fetched.
 */
const here = import.meta.url

function renderGallery(container?: HTMLElement) {
  const seed = createInitialState('Tester', 'Scenes')
  return render(
    <BackdropGallery
      state={seed}
      onSelectBackdrop={vi.fn()}
      onSaveCustomBackdrop={vi.fn(() => Promise.resolve({ ok: true }))}
      onSelectCustomBackdrop={vi.fn()}
      onDeleteCustomBackdrop={vi.fn()}
    />,
    container ? { container } : undefined,
  )
}

const card = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll<HTMLElement>('.scene-card')].find(
    (each) => each.querySelector('h3')?.textContent === name,
  )!

describe('ART-8 night thumbnails in the scene gallery', () => {
  it('has a night painting’s thumbnail for every scene, kept apart from the first load', () => {
    for (const scene of gardenBackdrops) {
      expect(backdropThumbnails[scene.id].night).toMatch(new RegExp(`thumb-${scene.id}-night`))
      expect(backdropThumbnails[scene.id].day).toMatch(new RegExp(`thumb-${scene.id}\\.`))
    }
    // backdropAssets is in the first load: no thumbnail is named there, by
    // day or by night; they come with the gallery.
    expect(JSON.stringify(backdropAssets)).not.toMatch(/thumb-/)
  })

  it('offers each scene by day and by night, both lazy and the same size', () => {
    const { container } = renderGallery()
    for (const scene of gardenBackdrops) {
      const each = card(container, scene.name)
      const day = each.querySelector('img.scene-thumb-day')!
      const night = each.querySelector('img.scene-thumb-night')!
      expect(day).toHaveAttribute('src', backdropThumbnails[scene.id].day)
      expect(night).toHaveAttribute('src', backdropThumbnails[scene.id].night)
      for (const image of [day, night]) {
        expect(image).toHaveAttribute('alt', '')
        expect(image).toHaveAttribute('loading', 'lazy')
        expect(image).toHaveAttribute('width', '400')
        expect(image).toHaveAttribute('height', '225')
      }
    }
  })

  it('shows the day’s thumbnail at night when the night’s cannot be had, as offline before it was seen', () => {
    const { container } = renderGallery()
    const night = card(container, gardenBackdrops[1].name).querySelector('img.scene-thumb-night')!
    fireEvent.error(night)
    expect(night).toHaveAttribute('src', backdropThumbnails[gardenBackdrops[1].id].day)
    // The others keep their own.
    const other = card(container, gardenBackdrops[2].name).querySelector('img.scene-thumb-night')!
    expect(other).toHaveAttribute('src', backdropThumbnails[gardenBackdrops[2].id].night)
  })

  it('is shown by the theme on screen, which the app shell carries, whichever way it was chosen', () => {
    // The app's own stylesheets, in the order it loads them, then the gallery's.
    const style = document.createElement('style')
    style.textContent = ['../index.css', '../App.css', '../garden-3.css', './backdrops/backdrops.css']
      .map((path) => readText(new URL(path, here)))
      .join('\n')
    document.head.append(style)
    try {
      for (const theme of ['sunlight', 'night'] as const) {
        const shell = document.createElement('div')
        shell.className = `app-shell theme-${theme}`
        document.body.append(shell)
        const { container, unmount } = renderGallery(shell)
        const each = card(container, gardenBackdrops[0].name)
        const shown = (selector: string) =>
          getComputedStyle(each.querySelector(selector)!).display !== 'none'
        expect(shown('img.scene-thumb-day'), theme).toBe(theme === 'sunlight')
        expect(shown('img.scene-thumb-night'), theme).toBe(theme === 'night')
        unmount()
        shell.remove()
      }
    } finally {
      style.remove()
    }
  })
})
