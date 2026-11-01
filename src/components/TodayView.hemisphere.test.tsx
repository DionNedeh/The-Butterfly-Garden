import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seasonalPrompts, type SeasonalPrompt } from '../data/prompts'
import { addDaysToLocalDate } from '../lib/date'
import { resetDrafts } from '../lib/drafts'
import { createInitialState } from '../lib/progression'
import { promptForDay } from '../lib/prompts'
import type { Profile } from '../types'
import { TodayView } from './TodayView'

/*
 * 1.4: where the gardener chose a half of the world, their season is known,
 * so the season's own prompts join Today's rotation as a region's do.
 */
function renderToday(profile: Partial<Profile>, today: string) {
  const seed = createInitialState('Tester', 'Test Garden')
  const handlers = Object.fromEntries(
    [
      'onSaveMood',
      'onSaveReflection',
      'onAddGoal',
      'onUpdateGoal',
      'onDeleteGoal',
      'onCompleteGoal',
      'onSkipGoal',
      'onSnoozeGoal',
      'onWakeGoal',
      'onPlanGoal',
      'onSetGoalArchived',
      'onUncompleteGoal',
      'onRestoreGoal',
      'onAdoptGoal',
      'onOpenRecap',
    ].map((name) => [name, vi.fn()]),
  )
  render(
    <TodayView
      state={{ ...seed, profile: { ...seed.profile!, ...profile } }}
      today={today}
      moonlightCollected={false}
      {...(handlers as unknown as Omit<
        Parameters<typeof TodayView>[0],
        'state' | 'today' | 'moonlightCollected'
      >)}
    />,
  )
}

/** The first July day whose own prompt, in a southern winter, is winter's. */
function winterPromptDay(): string {
  let day = '2026-07-01'
  while (!seasonalPrompts.includes(promptForDay(day, 0, 'winter') as SeasonalPrompt)) {
    day = addDaysToLocalDate(day, 1)
  }
  return day
}

afterEach(() => {
  cleanup()
  resetDrafts()
})

describe('1.4 the season’s prompts for a half of the world chosen by hand', () => {
  it('offers the south’s winter prompt in July, for Elsewhere and for no region', () => {
    const day = winterPromptDay()
    const winter = promptForDay(day, 0, 'winter')
    for (const region of ['elsewhere', undefined] as const) {
      renderToday({ region, hemisphere: 'south' }, day)
      expect(screen.getByRole('heading', { level: 2, name: winter.text })).toBeInTheDocument()
      cleanup()
    }
  })

  it('offers none of the season’s prompts until a half is chosen', () => {
    const day = winterPromptDay()
    renderToday({ region: 'elsewhere' }, day)
    expect(screen.getByRole('heading', { level: 2, name: promptForDay(day).text })).toBeInTheDocument()
    for (const prompt of seasonalPrompts) {
      expect(screen.queryByRole('heading', { level: 2, name: prompt.text })).toBeNull()
    }
  })
})
