import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { MonthPlanner } from './MonthPlanner'

/*
 * 6.3: on a gentle day Today shows no Sunlight number, its calendar
 * included: a day still says it gathered Sunlight, but not how much.
 */
const TODAY = '2026-10-27'
const EARLIER = '2026-10-20'

function garden(gentleDay?: string): AppState {
  const seed = createInitialState('Tester', 'Test Garden')
  return {
    ...seed,
    sunlight: [TODAY, TODAY, EARLIER, EARLIER, EARLIER].map((localDate, index) => ({
      id: `award-${index}`,
      localDate,
      source: `goal-${index}`,
      awardedAt: `${localDate}T09:00:00.000Z`,
    })),
    profile: { ...seed.profile!, ...(gentleDay ? { gentleDay } : {}) },
  }
}

function renderPlanner(state: AppState) {
  render(<MonthPlanner state={state} today={TODAY} onPlanGoal={vi.fn()} />)
  return userEvent.setup()
}

const note = () => document.querySelector('.calendar-sunlight-note')

describe('6.3 the calendar on a gentle day', () => {
  it('says a day gathered Sunlight, without the number, today or any other day', async () => {
    const user = renderPlanner(garden(TODAY))
    expect(note()).toHaveTextContent(/^Sunlight gathered\.$/)
    await user.click(screen.getByRole('button', { name: /October 20/ }))
    expect(note()).toHaveTextContent(/^Sunlight gathered\.$/)
  })

  it('counts it again once the gentle day has passed, and on ordinary days', async () => {
    const user = renderPlanner(garden(EARLIER))
    expect(note()).toHaveTextContent('2 Sunlight gathered.')
    await user.click(screen.getByRole('button', { name: /October 20/ }))
    expect(note()).toHaveTextContent('3 Sunlight gathered.')
  })
})
