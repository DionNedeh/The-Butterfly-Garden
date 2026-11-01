import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetDrafts } from '../lib/drafts'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { MoonlightRecap } from './MoonlightRecap'

/*
 * 6.3: a gentle day shows no Sunlight number anywhere, the recap that rounds
 * it out included, as Today's meter says "Rest counts too" in its place.
 */
const TODAY = '2026-09-08'
const YESTERDAY = '2026-09-07'

function garden(gentleDay?: string): AppState {
  const seed = createInitialState('Tester', 'Test Garden')
  return {
    ...seed,
    sunlight: [TODAY, YESTERDAY].map((localDate) => ({
      id: `mood-${localDate}`,
      localDate,
      source: 'mood',
      awardedAt: `${localDate}T09:00:00.000Z`,
    })),
    profile: { ...seed.profile!, ...(gentleDay ? { gentleDay } : {}) },
  }
}

function renderRecap(state: AppState, targetDate = TODAY) {
  render(
    <MoonlightRecap
      state={state}
      targetDate={targetDate}
      today={TODAY}
      onCollect={vi.fn()}
      onClose={vi.fn()}
    />,
  )
}

const summary = () => document.querySelector('.recap-summary')!

afterEach(() => resetDrafts())

describe('6.3 the recap of a gentle day', () => {
  it('shows the day without its Sunlight count', () => {
    renderRecap(garden(TODAY))
    expect(screen.getByText('Here is your day.')).toBeInTheDocument()
    expect(summary()).toHaveTextContent('Rest counts too')
    expect(summary()).not.toHaveTextContent(/\d/)
    expect(screen.queryByText(/\/ 5/)).toBeNull()
  })

  it('holds the count back for a gentle day rounded out after midnight', () => {
    renderRecap(garden(YESTERDAY), YESTERDAY)
    expect(summary()).toHaveTextContent('Rest counts too')
    expect(summary()).not.toHaveTextContent(/\d/)
  })

  it('counts an ordinary day as before', () => {
    renderRecap(garden(YESTERDAY))
    expect(summary()).toHaveTextContent('1 / 5Sunlight earned')
    expect(screen.queryByText('Rest counts too')).toBeNull()
  })
})
