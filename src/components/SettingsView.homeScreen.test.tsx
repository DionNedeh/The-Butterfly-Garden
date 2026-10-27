import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { SettingsView } from './SettingsView'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15'

function onIPhone(userAgent: string, persisted: boolean) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
  Object.defineProperty(navigator, 'storage', {
    value: {
      persisted: () => Promise.resolve(persisted),
      persist: () => Promise.resolve(persisted),
      estimate: () => Promise.resolve({ usage: 2048, quota: 1_000_000 }),
    },
    configurable: true,
  })
}

function renderSettings() {
  render(
    <SettingsView
      state={createInitialState('Tester', 'Test Garden')}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={vi.fn(() => ({ text: '{}' }))}
      onImportGarden={vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))}
      onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
    />,
  )
}

afterEach(() => {
  for (const key of ['userAgent', 'maxTouchPoints', 'storage']) Reflect.deleteProperty(navigator, key)
  vi.unstubAllEnvs()
})

describe("Settings' line on the Home Screen", () => {
  it('stays in Settings on an iPhone in Safari, while the browser has not agreed to keep the garden', async () => {
    onIPhone(IPHONE_SAFARI, false)
    renderSettings()
    expect(
      await screen.findByText(
        /^On iPhone and iPad, Safari may clear what a website keeps after seven days of use without a visit\. Add the garden to your Home Screen to keep it \(Share, then Add to Home Screen, then Add\)/,
      ),
    ).toBeInTheDocument()
  })

  it("names another browser's own Share menu", async () => {
    onIPhone(IPHONE_FIREFOX, false)
    renderSettings()
    expect(
      await screen.findByText(/your browser’s Share menu, then Add to Home Screen, then Add/),
    ).toBeInTheDocument()
  })

  it('says nothing once the browser has agreed to keep the garden', async () => {
    onIPhone(IPHONE_SAFARI, true)
    renderSettings()
    expect(await screen.findByText('This browser has agreed to keep your garden.')).toBeInTheDocument()
    expect(screen.queryByText(/Add the garden to your Home Screen/)).toBeNull()
  })

  it('says nothing anywhere but an iPhone or iPad', async () => {
    renderSettings()
    expect(await screen.findByRole('heading', { name: 'Backup and restore' })).toBeInTheDocument()
    expect(screen.queryByText(/Add the garden to your Home Screen/)).toBeNull()
  })
})
