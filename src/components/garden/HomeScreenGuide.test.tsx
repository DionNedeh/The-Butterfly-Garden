import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDraft, loadDrafts, resetDrafts } from '../../lib/drafts'
import { HOME_SCREEN_GUIDE_DRAFT } from '../../lib/install'
import { createInitialState } from '../../lib/progression'
import { gardenRepository } from '../../repository/gardenRepository'
import { GardenView } from '../GardenView'
import { HomeScreenGuide } from './HomeScreenGuide'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

/** Stand in for a device: its user agent, its touch, and whether installed. */
function onDevice(userAgent: string, { maxTouchPoints = 5, installed = false } = {}) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: installed && query === '(display-mode: standalone)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

/** The stored drafts, read as the app reads them once the garden loads. */
async function draftsRead(stored: Record<string, string> = {}) {
  vi.spyOn(gardenRepository, 'readDrafts').mockResolvedValue(stored)
  vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue()
  await act(() => loadDrafts())
}

function renderGarden() {
  render(
    <GardenView
      state={createInitialState('Tester', 'Test Garden')}
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

const GUIDE = { name: 'Add the garden to your Home Screen' }

afterEach(() => {
  Reflect.deleteProperty(navigator, 'userAgent')
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  resetDrafts()
})

describe('the Home Screen guide', () => {
  it("gives Safari's three steps, and why, plainly", async () => {
    const onPutAway = vi.fn()
    const user = userEvent.setup()
    render(<HomeScreenGuide advice="safari" onPutAway={onPutAway} />)
    const guide = screen.getByRole('region', GUIDE)
    expect(guide).toHaveTextContent(
      'Safari may clear what a website keeps after seven days of use without a visit. A garden on your Home Screen is kept',
    )
    expect(within(guide).getAllByRole('listitem').map((step) => step.textContent)).toEqual([
      'Tap Share . If you can’t see it, look under ⋯.',
      'Choose Add to Home Screen. You may need to scroll to find it.',
      'Tap Add.',
    ])
    // The Home Screen garden starts apart, so what is here needs carrying over.
    expect(guide).toHaveTextContent('save a backup in Settings first')
    await user.click(within(guide).getByRole('button', { name: 'Got it' }))
    expect(onPutAway).toHaveBeenCalledOnce()
  })

  it("points another iPhone browser to its own Share menu", () => {
    render(<HomeScreenGuide advice="browser" onPutAway={vi.fn()} />)
    const guide = screen.getByRole('region', GUIDE)
    expect(guide).toHaveTextContent('On iPhone and iPad, a browser may clear what a website keeps')
    expect(within(guide).getAllByRole('listitem')[0]).toHaveTextContent(
      'Open your browser’s Share menu.',
    )
    expect(guide).not.toHaveTextContent('Safari')
  })
})

describe('the guide in the garden', () => {
  it('shows on an iPhone in Safari, once the drafts are read', async () => {
    onDevice(IPHONE_SAFARI)
    renderGarden()
    // Not before: a guide put away long ago would flash up on every visit.
    expect(screen.queryByRole('region', GUIDE)).toBeNull()
    await draftsRead()
    expect(await screen.findByRole('region', GUIDE)).toBeInTheDocument()
  })

  it('goes for good when put away, handing focus to the garden’s name', async () => {
    onDevice(IPHONE_CHROME)
    await draftsRead()
    const user = userEvent.setup()
    renderGarden()
    const guide = await screen.findByRole('region', GUIDE)
    expect(guide).toHaveTextContent('Open your browser’s Share menu.')
    await user.click(within(guide).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('region', GUIDE)).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Test Garden' })).toHaveFocus()
    expect(getDraft(HOME_SCREEN_GUIDE_DRAFT)).toBe('put away')
  })

  it('stays away once put away on this device', async () => {
    onDevice(IPHONE_SAFARI)
    await draftsRead({ [HOME_SCREEN_GUIDE_DRAFT]: 'put away' })
    renderGarden()
    await screen.findByRole('heading', { level: 1, name: 'Test Garden' })
    await act(() => Promise.resolve())
    expect(screen.queryByRole('region', GUIDE)).toBeNull()
  })

  it('is never shown once installed, on Android, on a desktop, or in the Android app', async () => {
    await draftsRead()
    const cases: Array<() => void> = [
      () => onDevice(IPHONE_SAFARI, { installed: true }),
      () => onDevice(ANDROID_CHROME),
      () => onDevice('Mozilla/5.0 (X11; Linux x86_64)', { maxTouchPoints: 0 }),
      () => {
        vi.stubEnv('VITE_PLATFORM', 'android')
        onDevice(IPHONE_SAFARI)
      },
    ]
    for (const device of cases) {
      device()
      const { unmount } = render(
        <GardenView
          state={createInitialState('Tester', 'Test Garden')}
          onPlant={vi.fn()}
          onRemovePlant={vi.fn()}
          onPlaceJar={vi.fn()}
          onRemoveJarPlacement={vi.fn()}
          onSelectCompanion={vi.fn()}
          onRenameCreature={vi.fn()}
          onOpenCare={vi.fn()}
        />,
      )
      await act(() => Promise.resolve())
      expect(screen.queryByRole('region', GUIDE)).toBeNull()
      unmount()
    }
  })
})
