import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { formatDayInWords } from '../../lib/fieldNotes'
import type { CreatureInstance } from '../../types'
import { CompanionStory } from './CompanionStory'

function at(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 9).toISOString()
}

function creature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: 'sol',
    speciesId: 'monarch',
    name: 'Sol',
    stage: 'butterfly',
    careDates: {
      egg: ['2026-06-02', '2026-06-03', '2026-06-04'],
      caterpillar: ['2026-06-05', '2026-06-06', '2026-06-07'],
      chrysalis: ['2026-06-08', '2026-06-09', '2026-06-10'],
      butterfly: ['2026-06-11'],
    },
    actionLog: { 'but-groom': '2026-06-11' },
    bond: 12,
    outfit: { headwear: 'sprout-cap' },
    carePoints: 0,
    discoveredAt: at(2026, 6, 1),
    hatchedAt: at(2026, 6, 4),
    chrysalisStartedAt: at(2026, 6, 7),
    emergedAt: at(2026, 6, 10),
    careCounts: { 'but-groom': 1, 'egg-warm': 3 },
    outfitsWorn: ['silk-bow', 'sprout-cap'],
    ...overrides,
  }
}

/** The story as a list of what it says: "Hatched: 4 June 2026". */
function said(): string[] {
  return Array.from(document.querySelectorAll('dt')).map(
    (term) => `${term.textContent}: ${term.nextElementSibling?.textContent}`,
  )
}

async function openStory() {
  await userEvent.setup().click(screen.getByText(/’s story$/))
}

describe('a companion’s story on the Care page', () => {
  it('stays folded until asked for', () => {
    render(<CompanionStory creature={creature()} profile={{ diarySince: at(2026, 5, 1) }} />)
    expect(screen.getByText('Sol’s story')).toBeVisible()
    expect(document.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.queryByRole('term')).toBeNull()
  })

  it('tells a whole life, from welcome to emergence', async () => {
    render(<CompanionStory creature={creature()} profile={{ diarySince: at(2026, 5, 1) }} />)
    await openStory()
    const day = (localDate: string) => formatDayInWords(localDate)
    expect(said()).toEqual([
      `Welcomed: ${day('2026-06-01')}, as an egg`,
      `Hatched: ${day('2026-06-04')}`,
      `Became a chrysalis: ${day('2026-06-07')}`,
      `Emerged: ${day('2026-06-10')}`,
      'Days cared for: 10 days',
      'Favourite care: Keep warm, 3 times',
      'Outfits worn: Silk Bow and Sprout Cap',
    ])
    // A whole story needs no word about the diary.
    expect(document.querySelector('.story-note')).toBeNull()
  })

  it('says “once” and “twice”, and none yet for what has not happened', async () => {
    const egg = creature({
      stage: 'egg',
      careDates: {},
      careCounts: undefined,
      outfitsWorn: undefined,
      outfit: {},
      hatchedAt: undefined,
      chrysalisStartedAt: undefined,
      emergedAt: undefined,
    })
    const { rerender } = render(
      <CompanionStory creature={egg} profile={{ diarySince: at(2026, 5, 1) }} />,
    )
    await openStory()
    expect(said()).toEqual([
      `Welcomed: ${formatDayInWords('2026-06-01')}, as an egg`,
      'Days cared for: None yet',
      'Favourite care: None yet',
      'Outfits worn: None yet',
    ])
    // Open it stays as the companion changes.
    rerender(
      <CompanionStory
        creature={{ ...egg, careCounts: { 'egg-warm': 1 }, careDates: { egg: ['2026-06-02'] } }}
        profile={{ diarySince: at(2026, 5, 1) }}
      />,
    )
    expect(said()).toContain('Favourite care: Keep warm, once')
    expect(said()).toContain('Days cared for: 1 day')
    rerender(
      <CompanionStory
        creature={{ ...egg, careCounts: { 'egg-warm': 2 } }}
        profile={{ diarySince: at(2026, 5, 1) }}
      />,
    )
    expect(said()).toContain('Favourite care: Keep warm, twice')
  })

  it('says plainly what the garden did not keep for an older companion', async () => {
    const older = creature({
      discoveredAt: at(2026, 3, 1),
      hatchedAt: undefined,
      careCounts: undefined,
      outfitsWorn: undefined,
      outfit: {},
      careDates: { butterfly: ['2026-06-11'] },
    })
    render(<CompanionStory creature={older} profile={{ diarySince: at(2026, 10, 27) }} />)
    await openStory()
    // Nothing guessed: no hatching it cannot date, no favourite, no outfits.
    expect(said().map((row) => row.split(':')[0])).toEqual([
      'Welcomed',
      'Became a chrysalis',
      'Emerged',
      'Days cared for',
    ])
    expect(screen.getByText(/as a caterpillar$/)).toBeInTheDocument()
    expect(
      screen.getByText(
        `This garden began keeping a diary on ${formatDayInWords('2026-10-27')}, so some of Sol’s story from before then was never written down.`,
      ),
    ).toBeInTheDocument()
  })

  it('says the diary starts from now when the garden has kept none yet', async () => {
    render(<CompanionStory creature={creature({ careCounts: undefined })} />)
    await openStory()
    expect(screen.getByText(/keeps a diary from now on/)).toHaveTextContent(
      'This garden keeps a diary from now on: the care Sol is given and the outfits Sol wears will be written down here.',
    )
    expect(said().map((row) => row.split(':')[0])).not.toContain('Favourite care')
  })

  it('reads a welcome the garden could not date as having no day', async () => {
    render(
      <CompanionStory
        creature={creature({ discoveredAt: new Date(0).toISOString() })}
        profile={{ diarySince: at(2026, 5, 1) }}
      />,
    )
    await openStory()
    expect(document.querySelector('dd')).toHaveTextContent(/^As an egg$/)
  })
})
