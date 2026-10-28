import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nightLines } from '../data/nightLines'
import { marigoldLines } from '../data/seasons'
import { addDaysToLocalDate } from '../lib/date'
import { dayLine, isSeasonDay, nightLine, seasonLine } from '../lib/gardenLines'
import { createInitialState } from '../lib/progression'
import { DAY_WORDS } from '../test/nightWords'
import type { AppearanceTheme, CreatureInstance, Profile } from '../types'
import { GardenView } from './GardenView'

/** Midday on a local calendar day, as this device's clock would have it. */
function at(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(year, month - 1, day, 12) })
}

/** The first day from this one that is, or is not, a day the garden speaks of the season. */
function firstDay(from: string, seasonDay: boolean): string {
  let day = from
  while (isSeasonDay(day) !== seasonDay) day = addDaysToLocalDate(day, 1)
  return day
}

function butterfly(speciesId: string): CreatureInstance {
  return {
    id: 'flyer',
    speciesId,
    name: 'Juniper',
    stage: 'butterfly',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-01-01T00:00:00.000Z',
  }
}

function renderGarden(
  profile: Partial<Profile> = {},
  theme?: AppearanceTheme,
  creatures?: CreatureInstance[],
) {
  const seed = createInitialState('Tester', 'Test Garden')
  const state = {
    ...seed,
    ...(creatures ? { creatures } : {}),
    profile: { ...seed.profile!, ...profile },
  }
  return render(
    <GardenView
      state={state}
      theme={theme}
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

const line = (container: HTMLElement) => container.querySelector('.garden-observation')!
const scene = (container: HTMLElement) => container.querySelector('.garden-hero')!

afterEach(() => {
  vi.useRealTimers()
})

describe('the season on the scene', () => {
  it('is carried by the scene for its art, by the north’s calendar where no region is chosen', () => {
    at('2026-07-15')
    const { container } = renderGarden()
    expect(scene(container)).toHaveAttribute('data-season', 'summer')
  })

  it('follows the gardener’s region: July is winter in Australia and New Zealand', () => {
    at('2026-07-15')
    const { container } = renderGarden({ region: 'australasia' })
    expect(scene(container)).toHaveAttribute('data-season', 'winter')
  })

  it('turns with the calendar', () => {
    at('2026-10-27')
    const { container } = renderGarden({ region: 'europe' })
    expect(scene(container)).toHaveAttribute('data-season', 'autumn')
  })
})

describe('the line under the garden’s name', () => {
  it('keeps the day’s own words by day on an ordinary day', async () => {
    const day = firstDay('2026-07-01', false)
    at(day)
    const { container } = renderGarden({}, 'sunlight')
    await waitFor(() => expect(line(container)).toHaveTextContent(dayLine(undefined, day)))
  })

  it('is a night line at night, never the day’s words while it loads', async () => {
    const day = firstDay('2026-07-01', false)
    at(day)
    const { container } = renderGarden({}, 'night')
    expect(line(container).textContent).not.toBe(dayLine(undefined, day))
    await waitFor(() => expect(line(container)).toHaveTextContent(nightLine(undefined, day)))
    expect(line(container).textContent).not.toMatch(DAY_WORDS)
  })

  it('is the active butterfly’s own night, or the garden’s', async () => {
    const day = firstDay('2026-07-01', false)
    at(day)
    const { container } = renderGarden({ activeCompanionId: 'flyer' }, 'night', [butterfly('queen')])
    const expected = nightLine('queen', day)
    await waitFor(() => expect(line(container)).toHaveTextContent(expected))
    const queenOrAny = nightLines
      .filter(([speciesId]) => speciesId === 'queen' || speciesId === 'all')
      .map(([, text]) => text)
    expect(queenOrAny).toContain(expected)
  })

  it('says what the season is doing one day in three, where the gardener gardens', async () => {
    const day = firstDay('2026-10-01', true)
    at(day)
    const { container } = renderGarden({ region: 'north-america' }, 'sunlight')
    await waitFor(() =>
      expect(line(container)).toHaveTextContent(seasonLine('north-america', day)),
    )
  })

  it('in Australia and New Zealand, says the south’s season', async () => {
    const day = firstDay('2026-10-01', true)
    at(day)
    const { container } = renderGarden({ region: 'australasia' }, 'night')
    await waitFor(() =>
      expect(line(container)).toHaveTextContent(seasonLine('australasia', day)),
    )
  })
})

describe('fireflies', () => {
  const fireflies = (container: HTMLElement) => container.querySelectorAll('.hero-firefly')
  const petals = (container: HTMLElement) => container.querySelectorAll('.hero-petal')

  it('take the place of the petals at night', async () => {
    at('2026-07-15')
    const { container } = renderGarden({}, 'night')
    await waitFor(() => expect(fireflies(container).length).toBeGreaterThan(0))
    expect(petals(container)).toHaveLength(0)
  })

  it('are not there by day, when the petals fall', async () => {
    at('2026-07-15')
    const { container } = renderGarden({}, 'sunlight')
    expect(petals(container).length).toBeGreaterThan(0)
    // Long enough for a lazily loaded part to have arrived, had one been asked for.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fireflies(container)).toHaveLength(0)
  })

  it('never show with reduced motion or calm motion', async () => {
    at('2026-07-15')
    for (const profile of [{ reducedMotion: true }, { calmMotion: true }]) {
      const { container, unmount } = renderGarden(profile, 'night')
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(fireflies(container)).toHaveLength(0)
      unmount()
    }
  })

  it('stay away on a winter night', async () => {
    at('2026-01-15')
    const { container } = renderGarden({}, 'night')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fireflies(container)).toHaveLength(0)
    expect(petals(container)).toHaveLength(0)
  })
})

describe('Marigold’s travels', () => {
  it('are on her card in autumn, and she is still the garden’s guide', async () => {
    at('2026-10-15')
    const user = userEvent.setup()
    renderGarden({ region: 'north-america' }, 'sunlight')
    await user.click(screen.getByRole('button', { name: /^Meet Marigold/ }))
    const card = await screen.findByRole('dialog', { name: 'Marigold' })
    expect(card).toHaveTextContent('Your garden guide, who looks after the garden with you.')
    expect(card).toHaveTextContent(marigoldLines.north.autumn!)
    // She flies on, as ever.
    expect(screen.getByRole('button', { name: /^Meet Marigold/ })).toBeInTheDocument()
  })

  it('say nothing of travel in summer', async () => {
    at('2026-07-15')
    const user = userEvent.setup()
    renderGarden({ region: 'north-america' }, 'sunlight')
    await user.click(screen.getByRole('button', { name: /^Meet Marigold/ }))
    const card = await screen.findByRole('dialog', { name: 'Marigold' })
    expect(card).not.toHaveTextContent(/travel|back from/)
  })
})
