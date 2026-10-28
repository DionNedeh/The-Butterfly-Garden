import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { MonthPlanner } from './MonthPlanner'

const TODAY = '2026-10-27'

function renderPlanner() {
  render(
    <MonthPlanner
      state={createInitialState('Tester', 'Test Garden')}
      today={TODAY}
      onPlanGoal={vi.fn()}
    />,
  )
  return userEvent.setup()
}

const toggle = () => screen.getByRole('button', { name: /the month$/ })

describe('the month planner’s fold', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts open where there is room, and folds and opens on one button', async () => {
    const user = renderPlanner()
    expect(toggle()).toHaveAccessibleName('Hide the month')
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    const body = document.getElementById(toggle().getAttribute('aria-controls')!)
    expect(body).toContainElement(screen.getByRole('group', { name: /2026/ }))

    await user.click(toggle())
    expect(toggle()).toHaveAccessibleName('Show the month')
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Previous month' })).toBeNull()
    // The same button, so focus stays where the gardener left it.
    expect(toggle()).toHaveFocus()

    await user.click(toggle())
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument()
  })

  it('starts folded on a phone-sized screen', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('max-width') }))
    renderPlanner()
    expect(toggle()).toHaveAccessibleName('Show the month')
    expect(screen.queryByRole('button', { name: 'Previous month' })).toBeNull()
  })
})
