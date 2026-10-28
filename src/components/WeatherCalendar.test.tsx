import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDaysToLocalDate } from '../lib/date'
import type { MoodEntry } from '../types'
import { WeatherCalendar } from './WeatherCalendar'

/** A Tuesday. */
const TODAY = '2026-10-27'

function mood(localDate: string, level: MoodEntry['level'], unsure?: true): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level,
    ...(unsure ? { unsure } : {}),
    note: '',
    createdAt: `${localDate}T09:00:00.000Z`,
    updatedAt: `${localDate}T09:00:00.000Z`,
  }
}

const MOODS = [
  mood('2025-08-20', 5),
  mood('2026-09-15', 2),
  mood('2026-10-01', 1),
  mood('2026-10-06', 4),
  mood('2026-10-13', 3, true),
]

/**
 * The week start comes from the locale, and the engine running the tests may
 * say either. Each test fixes it, and the original is put back afterwards.
 */
const localeProto = Intl.Locale.prototype as object
const originalGetWeekInfo = Object.getOwnPropertyDescriptor(localeProto, 'getWeekInfo')

function weekStartsOn(firstDay: number) {
  Object.defineProperty(localeProto, 'getWeekInfo', {
    configurable: true,
    value: () => ({ firstDay }),
  })
}

beforeEach(() => weekStartsOn(7))

afterEach(() => {
  if (originalGetWeekInfo) Object.defineProperty(localeProto, 'getWeekInfo', originalGetWeekInfo)
  else Reflect.deleteProperty(localeProto, 'getWeekInfo')
})

function props({
  moods = MOODS,
  written = ['2026-10-20'],
  today = TODAY,
}: { moods?: MoodEntry[]; written?: string[]; today?: string } = {}) {
  const moodByDate = new Map(moods.map((entry) => [entry.localDate, entry]))
  const others = new Set(written)
  return {
    moodByDate,
    hasEntry: vi.fn((localDate: string) => moodByDate.has(localDate) || others.has(localDate)),
    today,
    onOpenDay: vi.fn(),
  }
}

function renderCalendar(options?: Parameters<typeof props>[0]) {
  const calendarProps = props(options)
  const utils = render(<WeatherCalendar {...calendarProps} />)
  return { ...utils, ...calendarProps }
}

const status = () => screen.getByRole('status')

describe('WeatherCalendar, month view', () => {
  it("opens on today's month, with the weekdays named from the start of the week", () => {
    renderCalendar()

    expect(screen.getByRole('table', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Year' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'SunSunday',
      'MonMonday',
      'TueTuesday',
      'WedWednesday',
      'ThuThursday',
      'FriFriday',
      'SatSaturday',
    ])
    expect(screen.getByRole('columnheader', { name: 'Sunday' })).toBeInTheDocument()
    // Only the abbreviation is drawn; the full name is for a screen reader.
    expect(within(screen.getAllByRole('columnheader')[0]).getByText('Sun')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('starts the week on Monday where the locale does', () => {
    weekStartsOn(1)
    renderCalendar()

    const headers = screen.getAllByRole('columnheader')
    expect(headers[0]).toHaveAccessibleName('Monday')
    expect(headers[6]).toHaveAccessibleName('Sunday')
    // 1 October 2026 is a Thursday: the fourth day of a Monday week.
    const firstWeek = screen.getAllByRole('row')[1]
    expect(within(firstWeek).getAllByRole('cell')[3]).toHaveTextContent('1')
    expect(within(firstWeek).getAllByRole('cell')[2]).toBeEmptyDOMElement()
  })

  it('names each day with an entry by its date and weather, and opens it', async () => {
    const user = userEvent.setup()
    const { onOpenDay } = renderCalendar()

    expect(screen.getByRole('button', { name: 'Thursday, October 1: Stormy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tuesday, October 13: Not sure' })).toBeInTheDocument()
    // A day with only a reflection or a recap still opens.
    expect(
      screen.getByRole('button', { name: 'Tuesday, October 20: no check-in' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tuesday, October 6: Bright' }))
    expect(onOpenDay).toHaveBeenCalledWith('2026-10-06')
  })

  it('leaves a day without entries as plain text', () => {
    renderCalendar()

    expect(screen.queryByRole('button', { name: /October 7\b/ })).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '7' })).toBeInTheDocument()
  })

  it('marks today, whether or not anything is written yet', () => {
    const { unmount } = renderCalendar()
    const plain = screen.getByRole('cell', { name: '27' })
    expect(plain.querySelector('[aria-current="date"]')).toHaveTextContent('27')
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
    unmount()

    renderCalendar({ moods: [...MOODS, mood(TODAY, 5)] })
    expect(screen.getByRole('button', { name: 'Tuesday, October 27: Radiant' })).toHaveAttribute(
      'aria-current',
      'date',
    )
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
  })

  it('draws each weather, "Not sure" and a day with no check-in apart', () => {
    renderCalendar()

    const tile = (name: string) =>
      screen.getByRole('button', { name }).querySelector('.cal-tile')
    expect(tile('Thursday, October 1: Stormy')).toHaveClass('cal-weather-1')
    expect(tile('Tuesday, October 6: Bright')).toHaveClass('cal-weather-4')
    expect(tile('Tuesday, October 13: Not sure')).toHaveClass('cal-weather-unsure')
    expect(tile('Tuesday, October 13: Not sure')).not.toHaveClass('cal-weather-3')
    expect(tile('Tuesday, October 20: no check-in')).toHaveClass('cal-no-check-in')
    expect(screen.getByText('28')).toHaveClass('cal-plain', 'cal-future')
  })

  it('colours a day by a check-in written later, and says it was written later', async () => {
    const user = userEvent.setup()
    const later: MoodEntry = { ...mood('2026-10-08', 2), writtenLater: true }
    const { onOpenDay } = renderCalendar({ moods: [...MOODS, later] })

    const day = screen.getByRole('button', { name: 'Thursday, October 8: Rainy, written later' })
    expect(day.querySelector('.cal-tile')).toHaveClass('cal-weather-2')
    await user.click(day)
    expect(onOpenDay).toHaveBeenCalledWith('2026-10-08')
  })

  it('names every weather in a visible key, so colour is never the only sign', () => {
    renderCalendar()

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
  })

  it('moves between months, never past this month nor before the first check-in', async () => {
    const user = userEvent.setup()
    renderCalendar()

    const previous = screen.getByRole('button', { name: 'Previous month' })
    const next = screen.getByRole('button', { name: 'Next month' })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(previous).toHaveAttribute('aria-disabled', 'false')

    // At a limit the button does nothing, and keeps focus.
    await user.click(next)
    expect(screen.getByRole('table', { name: 'October 2026' })).toBeInTheDocument()
    expect(next).toHaveFocus()
    expect(status()).toBeEmptyDOMElement()

    await user.click(previous)
    expect(screen.getByRole('table', { name: 'September 2026' })).toBeInTheDocument()
    expect(status()).toHaveTextContent('September 2026')
    expect(next).toHaveAttribute('aria-disabled', 'false')

    // Back to August 2025, the month of the first check-in, and no further.
    for (let step = 0; step < 13; step += 1) await user.click(previous)
    expect(screen.getByRole('table', { name: 'August 2025' })).toBeInTheDocument()
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    await user.click(previous)
    expect(screen.getByRole('table', { name: 'August 2025' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Wednesday, August 20: Radiant' }),
    ).toBeInTheDocument()

    await user.click(next)
    expect(screen.getByRole('table', { name: 'September 2025' })).toBeInTheDocument()
  })

  it("stays on this month when there is no check-in yet, even with earlier reflections", () => {
    renderCalendar({ moods: [], written: ['2026-03-02', '2026-10-20'] })

    expect(screen.getByRole('table', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Next month' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('returns to a month it can reach when the earliest check-in is deleted', async () => {
    const user = userEvent.setup()
    const { rerender, hasEntry, onOpenDay } = renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('table', { name: 'September 2026' })).toBeInTheDocument()

    const octoberOnly = new Map([['2026-10-06', mood('2026-10-06', 4)]])
    rerender(
      <WeatherCalendar
        moodByDate={octoberOnly}
        hasEntry={hasEntry}
        today={TODAY}
        onOpenDay={onOpenDay}
      />,
    )
    expect(screen.getByRole('table', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('never offers a month after this one, even if a clock turned back left a check-in there', () => {
    renderCalendar({ moods: [mood('2026-11-02', 4)], written: [] })

    expect(screen.getByRole('table', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous month' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Next month' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('WeatherCalendar, year view', () => {
  it('shows the year as twelve months of days, each written day opening its entry', async () => {
    const user = userEvent.setup()
    const { onOpenDay } = renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Year' }))
    expect(screen.getByRole('button', { name: 'Year' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false')
    expect(status()).toHaveTextContent('2026')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    const year = screen.getByRole('group', { name: '2026' })
    expect(year.querySelectorAll('.cal-year-row')).toHaveLength(12)

    const october = within(year).getByRole('list', { name: 'October 2026' })
    // Only the days that can be opened are heard; the rest are drawn.
    expect(within(october).getAllByRole('listitem')).toHaveLength(4)
    expect(october.querySelectorAll('li')).toHaveLength(31)
    expect(
      within(october).getByRole('button', { name: 'Tuesday, October 13: Not sure' }),
    ).toHaveClass('cal-weather-unsure')

    await user.click(within(october).getByRole('button', { name: 'Tuesday, October 6: Bright' }))
    expect(onOpenDay).toHaveBeenCalledWith('2026-10-06')

    // A month with nothing in it says so, in words.
    expect(screen.queryByRole('list', { name: 'January 2026' })).not.toBeInTheDocument()
    expect(screen.getByText('January 2026: no entries')).toHaveClass('sr-only')
    // Months still to come are drawn but say nothing and cannot be opened.
    expect(screen.queryByText(/November 2026/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'November 2026, month view' }),
    ).not.toBeInTheDocument()
  })

  it('marks today among the pixels', async () => {
    const user = userEvent.setup()
    renderCalendar({ moods: [...MOODS, mood(TODAY, 2)] })

    await user.click(screen.getByRole('button', { name: 'Year' }))
    const today = screen.getByRole('button', { name: 'Tuesday, October 27: Rainy' })
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(today).toHaveClass('cal-pixel', 'cal-weather-2', 'cal-today')
  })

  it('moves between years within the same limits', async () => {
    const user = userEvent.setup()
    renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Year' }))
    const previous = screen.getByRole('button', { name: 'Previous year' })
    const next = screen.getByRole('button', { name: 'Next year' })
    expect(next).toHaveAttribute('aria-disabled', 'true')

    await user.click(previous)
    expect(screen.getByRole('group', { name: '2025' })).toBeInTheDocument()
    expect(status()).toHaveTextContent('2025')
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveAttribute('aria-disabled', 'false')
    expect(
      screen.getByRole('button', { name: 'Wednesday, August 20: Radiant' }),
    ).toBeInTheDocument()

    // Before the first check-in a month is drawn but cannot be opened.
    expect(
      screen.queryByRole('button', { name: 'July 2025, month view' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'August 2025, month view' })).toBeInTheDocument()

    await user.click(previous)
    expect(screen.getByRole('group', { name: '2025' })).toBeInTheDocument()

    await user.click(next)
    expect(screen.getByRole('group', { name: '2026' })).toBeInTheDocument()
  })

  it("opens a month at full size from its row, and moves focus to it", async () => {
    const user = userEvent.setup()
    renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Year' }))
    await user.click(screen.getByRole('button', { name: 'September 2026, month view' }))

    const table = screen.getByRole('table', { name: 'September 2026' })
    expect(table).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(status()).toHaveTextContent('September 2026')
  })

  it('keeps the month across a change of view, and a pressed view does nothing', async () => {
    const user = userEvent.setup()
    renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Month' }))
    expect(status()).toHaveTextContent('September 2026')

    await user.click(screen.getByRole('button', { name: 'Year' }))
    await user.click(screen.getByRole('button', { name: 'Year' }))
    expect(status()).toHaveTextContent('2026')
    await user.click(screen.getByRole('button', { name: 'Previous year' }))
    await user.click(screen.getByRole('button', { name: 'Month' }))
    // A year back from September 2026, in the same month.
    expect(screen.getByRole('table', { name: 'September 2025' })).toBeInTheDocument()
  })

  it('shows a check-in a turned-back clock left in a month still to come', async () => {
    const user = userEvent.setup()
    renderCalendar({ moods: [mood('2026-11-02', 4)], written: [] })

    await user.click(screen.getByRole('button', { name: 'Year' }))
    const november = screen.getByRole('list', { name: 'November 2026' })
    expect(within(november).getByRole('button', { name: 'Monday, November 2: Bright' })).toHaveClass(
      'cal-future',
    )
  })
})

describe('WeatherCalendar, with years of entries', () => {
  /** Three years of check-ins on alternate days, reflections on the rest. */
  function longJournal() {
    const moods: MoodEntry[] = []
    let date = '2023-11-01'
    for (let day = 0; date <= TODAY; day += 1) {
      if (day % 2 === 0) moods.push(mood(date, ((day % 5) + 1) as MoodEntry['level']))
      date = addDaysToLocalDate(date, 1)
    }
    return moods
  }

  it('looks up only the days on screen, and only once for the same inputs', async () => {
    const user = userEvent.setup()
    const calendarProps = props({ moods: longJournal(), written: [] })
    const { rerender } = render(<WeatherCalendar {...calendarProps} />)

    // Days with a check-in never need asking; the rest of one month do.
    expect(calendarProps.hasEntry.mock.calls.length).toBeGreaterThan(0)
    expect(calendarProps.hasEntry.mock.calls.length).toBeLessThanOrEqual(31)

    calendarProps.hasEntry.mockClear()
    rerender(<WeatherCalendar {...calendarProps} />)
    expect(calendarProps.hasEntry).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Year' }))
    expect(calendarProps.hasEntry.mock.calls.length).toBeLessThanOrEqual(366)
    expect(screen.getAllByRole('list', { name: /2026$/ })).toHaveLength(10)
  })
})

describe('reaching every written day', () => {
  it('goes back to a reflection kept before the first check-in', async () => {
    const user = userEvent.setup()
    const calendarProps = props({ moods: [mood('2026-10-06', 4)], written: ['2026-08-02'] })
    render(<WeatherCalendar {...calendarProps} firstDate="2026-08-02" />)
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('table')).toHaveAccessibleName(/August 2026/)
    expect(screen.getByRole('button', { name: /August 2: no check-in/ })).toBeInTheDocument()
  })

  it('keeps a year of days out of the tab order, its months in it', async () => {
    const user = userEvent.setup()
    renderCalendar()
    await user.click(screen.getByRole('button', { name: 'Year' }))
    const day = screen.getByRole('button', { name: /October 6: Bright/ })
    expect(day).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('button', { name: /October 2026, month view/ })).not.toHaveAttribute(
      'tabindex',
    )
  })
})
