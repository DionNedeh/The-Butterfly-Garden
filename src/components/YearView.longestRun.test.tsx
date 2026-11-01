import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { YearView } from './YearView'

/* 6.8: the year's longest run of days cared for, on the year's page. */
const TODAY = '2026-10-27'

function garden(days: string[], hideDayCounts = false): AppState {
  const base = createInitialState('Robin', 'Quiet Corner', new Date(2025, 2, 1, 9))
  return {
    ...base,
    profile: { ...base.profile!, ...(hideDayCounts ? { hideDayCounts } : {}) },
    sunlight: days.map((localDate, index) => ({
      id: `s${index}`,
      localDate,
      source: 'mood',
      awardedAt: `${localDate}T16:00:00.000Z`,
    })),
  }
}

const FIVE_DAYS = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-07-01']

function renderYear(state: AppState) {
  render(<YearView state={state} today={TODAY} onChooseYear={vi.fn()} onBack={vi.fn()} />)
  return screen.getByRole('region', { name: 'What you wrote' })
}

describe('6.8 the longest run on the year’s page', () => {
  it('says so for a year with a five-day run', () => {
    const journal = renderYear(garden(FIVE_DAYS))
    expect(journal).toHaveTextContent('Days you cared for yourself: 6.')
    expect(journal).toHaveTextContent('Your longest run of days cared for was five days.')
  })

  it('says nothing of runs when Settings hides day counts', () => {
    const journal = renderYear(garden(FIVE_DAYS, true))
    expect(journal).toHaveTextContent('Day counts are hidden, as you chose.')
    expect(journal).not.toHaveTextContent(/run|five|\b5\b/)
  })

  it('says nothing of runs for a year without two days in a row', () => {
    const journal = renderYear(garden(['2026-06-01', '2026-06-03']))
    expect(journal).toHaveTextContent('Days you cared for yourself: 2.')
    expect(journal).not.toHaveTextContent(/longest run/)
  })
})
