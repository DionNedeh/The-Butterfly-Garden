import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MoodEntry } from '../types'
import { YearCalendar } from './WeatherCalendar'

function mood(localDate: string, extra: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note: '',
    createdAt: `${localDate}T16:00:00.000Z`,
    updatedAt: `${localDate}T16:00:00.000Z`,
    ...extra,
  }
}

const moods = new Map([
  ['2026-01-06', mood('2026-01-06')],
  ['2026-03-10', mood('2026-03-10', { level: 1 })],
  ['2026-03-11', mood('2026-03-11', { level: 3, unsure: true })],
])
const written = new Set(['2026-03-12'])
const hasEntry = (localDate: string) => moods.has(localDate) || written.has(localDate)

describe('a year in pixels, to look at', () => {
  it('names each day with something in it by its weather, and nothing is a button', () => {
    render(<YearCalendar year={2026} moodByDate={moods} hasEntry={hasEntry} today="2026-10-27" />)
    const calendar = screen.getByRole('region', { name: 'The year’s weather' })
    expect(within(calendar).queryAllByRole('button')).toHaveLength(0)
    const march = within(calendar).getByRole('list', { name: 'March 2026' })
    expect(within(march).getAllByRole('img').map((day) => day.getAttribute('aria-label'))).toEqual([
      'Tuesday, March 10: Stormy',
      'Wednesday, March 11: Not sure',
      'Thursday, March 12: no check-in',
    ])
    expect(within(calendar).getByRole('img', { name: 'Tuesday, January 6: Bright' })).toHaveClass(
      'cal-pixel',
      'cal-weather-4',
    )
  })

  it('says a month that has passed had no entries, and leaves months to come unsaid', () => {
    render(<YearCalendar year={2026} moodByDate={moods} hasEntry={hasEntry} today="2026-10-27" />)
    expect(screen.getByText('February 2026: no entries')).toBeInTheDocument()
    expect(screen.getByText('October 2026: no entries')).toBeInTheDocument()
    expect(screen.queryByText('November 2026: no entries')).toBeNull()
    expect(screen.queryByRole('list', { name: 'February 2026' })).toBeNull()
  })

  it('has the same key as the Journal’s calendar', () => {
    render(<YearCalendar year={2025} moodByDate={moods} hasEntry={hasEntry} today="2026-10-27" />)
    const key = screen.getByRole('list', { name: 'Key' })
    expect(within(key).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Stormy',
      'Rainy',
      'Overcast',
      'Bright',
      'Radiant',
      'Not sure',
      'No check-in',
    ])
    // A whole year gone: every month has passed, and none had entries.
    expect(screen.getByText('December 2025: no entries')).toBeInTheDocument()
  })
})
