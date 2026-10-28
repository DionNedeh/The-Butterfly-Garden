import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createInitialState } from './lib/progression'
import { resetDrafts } from './lib/drafts'
import { gardenRepository } from './repository/gardenRepository'
import { FakeBroadcastChannel } from './test/fakeBroadcastChannel'
import { fakeFile, installSavePicker, recordInMemory } from './test/fileSystemAccess'
import { LAZY_PAGE_MS } from './test/lazyPage'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

/*
 * The app keeps the chosen backup file up to date from the moment the garden
 * is open, where the browser can keep a file, and records each write as a
 * backup kept. Nowhere else does it so much as load the writer.
 */

beforeEach(async () => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
})

afterEach(async () => {
  cleanup()
  resetDrafts()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
  await gardenRepository.clear().catch(() => undefined)
})

describe('the backup file kept up to date, in the app', () => {
  it('writes an earlier day’s changes once the garden opens, as a backup kept', async () => {
    const file = fakeFile()
    installSavePicker(file)
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
    recordInMemory({ handle: file.handle, writtenAt: daysAgo(2), changedAt: daysAgo(1) })
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    await waitFor(() => expect(file.writes).toBe(1), { timeout: LAZY_PAGE_MS })
    expect(JSON.parse(file.contents!)).toMatchObject({
      format: 'the-butterfly-garden',
      garden: { profile: { gardenName: 'Quiet Corner' } },
    })
    await waitFor(async () =>
      expect((await gardenRepository.load()).state.profile?.lastBackupAt).toBeDefined(),
    )
  }, 20_000)

  it('loads no writer where the browser cannot keep a file', async () => {
    const read = vi.spyOn(gardenRepository, 'readBackupFile')
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(read).not.toHaveBeenCalled()
  }, 20_000)
})
