import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addDaysToLocalDate, toLocalDate } from './lib/date'
import { resetDrafts } from './lib/drafts'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import type { AppState } from './types'
import { LAZY_PAGE_MS } from './test/lazyPage'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

/*
 * 6.3: a gentle day hides the header's Sunlight count and the navigation's
 * backup mark too, as Today hides its own counts, until the next day.
 */

/** A garden old enough, with no copy on record, for the backup mark to be due. */
function stored(gentleDay?: string): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  const longAgo = new Date(Date.now() - 40 * 86_400_000).toISOString()
  return {
    ...seed,
    sunlight: [
      { id: 'mood-today', localDate: toLocalDate(), source: 'mood', awardedAt: new Date().toISOString() },
    ],
    profile: {
      ...seed.profile!,
      createdAt: longAgo,
      lastVisitOn: toLocalDate(),
      ...(gentleDay ? { gentleDay } : {}),
    },
  }
}

async function openGarden(garden: AppState) {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden })
  vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
}

const pill = () => screen.getByTitle('Sunlight earned today')
const primaryNav = () => within(screen.getByRole('navigation', { name: 'Primary navigation' }))

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
  resetDrafts()
  window.history.replaceState(null, '', '/')
})

describe('6.3 the header on a gentle day', { timeout: 20_000 }, () => {
  it('shows the Sunlight pill without its number, and no backup mark anywhere', async () => {
    await openGarden(stored(toLocalDate()))
    // The pill stays, with its sun and its name, so the header keeps its shape.
    expect(pill()).toHaveTextContent(/^Sunlight$/)
    expect(pill()).not.toHaveTextContent(/\d/)
    expect(pill().querySelector('svg')).not.toBeNull()
    expect(screen.queryByText(/\/ 5/)).toBeNull()
    expect(primaryNav().getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /time for a fresh copy/ })).toEqual([])
  })

  it('is an ordinary header again the next day, count and mark back', async () => {
    await openGarden(stored(addDaysToLocalDate(toLocalDate(), -1)))
    expect(pill()).toHaveTextContent('1 / 5 Sunlight today')
    expect(
      primaryNav().getByRole('button', { name: 'Settings, time for a fresh copy' }),
    ).toBeInTheDocument()
  })

  it('leaves an ordinary day as it was', async () => {
    await openGarden(stored())
    expect(pill()).toHaveTextContent('1 / 5 Sunlight today')
    expect(
      primaryNav().getByRole('button', { name: 'Settings, time for a fresh copy' }),
    ).toBeInTheDocument()
  })
})
