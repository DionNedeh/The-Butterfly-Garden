import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_FILTER, type JournalFilter } from '../lib/journalSearch'
import { JournalSearch } from './JournalSearch'

/** Holds the filter the way the Journal will, so typing and toggling add up. */
function Harness({
  initial = EMPTY_FILTER,
  matches = 0,
  total = 12,
  onChange,
}: {
  initial?: JournalFilter
  matches?: number
  total?: number
  onChange?: (filter: JournalFilter) => void
}) {
  const [filter, setFilter] = useState(initial)
  return (
    <JournalSearch
      filter={filter}
      onChange={(next) => {
        onChange?.(next)
        setFilter(next)
      }}
      matches={matches}
      total={total}
    />
  )
}

function lastFilter(onChange: ReturnType<typeof vi.fn>): JournalFilter {
  return onChange.mock.lastCall?.[0] as JournalFilter
}

describe('JournalSearch', () => {
  it('is a named search with a labelled search field', () => {
    render(<Harness />)
    expect(screen.getByRole('search', { name: 'Find things in your journal' })).toBeInTheDocument()
    const field = screen.getByRole('searchbox', { name: 'Search your journal' })
    expect(field).toHaveAttribute('type', 'search')
    expect(field).toHaveAccessibleDescription(/on this device/i)
  })

  it('reports each keystroke, keeping the rest of the filter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={{ query: '', kinds: ['recap'] }} onChange={onChange} />)

    await user.type(screen.getByRole('searchbox'), 'river')
    expect(onChange).toHaveBeenCalledTimes(5)
    expect(lastFilter(onChange)).toEqual({ query: 'river', kinds: ['recap'] })
    expect(screen.getByRole('searchbox')).toHaveValue('river')
  })

  it('clears the words on Escape, and only the words', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={{ query: 'river', kinds: ['reflection'], weather: 2 }} onChange={onChange} />)

    await user.click(screen.getByRole('searchbox'))
    await user.keyboard('{Escape}')
    expect(lastFilter(onChange)).toEqual({ query: '', kinds: ['reflection'], weather: 2 })
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('keeps Escape to itself only when it had words to clear', async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    const onChange = vi.fn()
    render(
      <div
        onKeyDown={(event) => {
          outer(event.key)
        }}
      >
        <Harness initial={{ query: 'river', kinds: [] }} onChange={onChange} />
      </div>,
    )

    await user.click(screen.getByRole('searchbox'))
    await user.keyboard('{Escape}')
    expect(outer).not.toHaveBeenCalled()

    // Nothing left to clear: Escape is free for whatever holds the journal.
    onChange.mockClear()
    await user.keyboard('{Escape}')
    expect(onChange).not.toHaveBeenCalled()
    expect(outer).toHaveBeenCalledWith('Escape')
  })

  it('leaves Escape to an input method that is still composing', () => {
    const onChange = vi.fn()
    render(<Harness initial={{ query: 'かわ', kinds: [] }} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape', isComposing: true })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('searchbox')).toHaveValue('かわ')
  })

  it('toggles the kinds as pressed buttons, kept in timeline order', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const kinds = within(screen.getByRole('group', { name: 'Show only' }))
    const checkIns = kinds.getByRole('button', { name: 'Check-ins' })
    const reflections = kinds.getByRole('button', { name: 'Reflections' })
    const recaps = kinds.getByRole('button', { name: 'Recaps' })
    for (const button of [checkIns, reflections, recaps]) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }

    await user.click(recaps)
    expect(recaps).toHaveAttribute('aria-pressed', 'true')
    expect(lastFilter(onChange).kinds).toEqual(['recap'])

    await user.click(checkIns)
    expect(lastFilter(onChange).kinds).toEqual(['check-in', 'recap'])

    await user.click(recaps)
    expect(recaps).toHaveAttribute('aria-pressed', 'false')
    expect(checkIns).toHaveAttribute('aria-pressed', 'true')
    expect(lastFilter(onChange).kinds).toEqual(['check-in'])
  })

  it('offers any weather, each weather by name, and not sure', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const weather = screen.getByRole('combobox', { name: 'Weather that day' })
    expect(within(weather).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Any weather',
      'Stormy',
      'Rainy',
      'Overcast',
      'Bright',
      'Radiant',
      'Not sure',
    ])
    expect(weather).toHaveValue('')

    await user.selectOptions(weather, 'Bright')
    expect(lastFilter(onChange)).toEqual({ query: '', kinds: [], weather: 4 })

    await user.selectOptions(weather, 'Not sure')
    expect(lastFilter(onChange)).toEqual({ query: '', kinds: [], weather: 'unsure' })
    expect(weather).toHaveValue('unsure')

    await user.selectOptions(weather, 'Any weather')
    expect(lastFilter(onChange)).not.toHaveProperty('weather')
    expect(weather).toHaveValue('')
  })

  it('counts the matching days politely, only while a filter is active', () => {
    const { rerender } = render(
      <JournalSearch filter={EMPTY_FILTER} onChange={vi.fn()} matches={12} total={12} />,
    )
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()

    rerender(
      <JournalSearch filter={{ query: 'river', kinds: [] }} onChange={vi.fn()} matches={3} total={12} />,
    )
    expect(status).toHaveTextContent('3 days match')

    rerender(
      <JournalSearch filter={{ query: 'river', kinds: [] }} onChange={vi.fn()} matches={1} total={12} />,
    )
    expect(status).toHaveTextContent('1 day matches')

    rerender(<JournalSearch filter={{ query: '', kinds: [], weather: 5 }} onChange={vi.fn()} matches={0} total={12} />)
    expect(status).toHaveTextContent('0 days match')

    // Spaces alone are not a search.
    rerender(<JournalSearch filter={{ query: '   ', kinds: [] }} onChange={vi.fn()} matches={12} total={12} />)
    expect(status).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
  })

  it('clears everything with Clear, then hands focus back to the field', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Harness initial={{ query: 'river', kinds: ['check-in'], weather: 'unsure' }} matches={2} onChange={onChange} />,
    )

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_FILTER)
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Check-ins' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('combobox', { name: 'Weather that day' })).toHaveValue('')
  })

  it('shows Clear for a kind or a weather alone', () => {
    const { rerender } = render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    rerender(<JournalSearch filter={{ query: '', kinds: ['recap'] }} onChange={vi.fn()} matches={1} total={2} />)
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    rerender(<JournalSearch filter={{ query: '', kinds: [], weather: 1 }} onChange={vi.fn()} matches={1} total={2} />)
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  })

  it('stays out of an empty journal, unless a filter is left to clear', () => {
    const { container, rerender } = render(
      <JournalSearch filter={EMPTY_FILTER} onChange={vi.fn()} matches={0} total={0} />,
    )
    expect(container).toBeEmptyDOMElement()

    rerender(<JournalSearch filter={{ query: 'river', kinds: [] }} onChange={vi.fn()} matches={0} total={0} />)
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('0 days match')
  })
})

describe('JournalSearch while the search catches up', () => {
  it('keeps the last count until the new one is known', () => {
    const filter: JournalFilter = { ...EMPTY_FILTER, query: 'river' }
    const { rerender } = render(
      <JournalSearch filter={filter} onChange={vi.fn()} matches={3} total={40} />,
    )
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('3 days match')
    // Typing on: the count for "rivers" is not known yet; no other count is said.
    const typed = { ...filter, query: 'rivers' }
    rerender(<JournalSearch filter={typed} onChange={vi.fn()} matches={undefined} total={40} />)
    expect(status).toHaveTextContent('3 days match')
    rerender(<JournalSearch filter={typed} onChange={vi.fn()} matches={1} total={40} />)
    expect(status).toHaveTextContent('1 day matches')
  })

  it('stays, with focus in it, when cleared after the last entry has gone', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ ...EMPTY_FILTER, query: 'river' }} total={0} />)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('searchbox', { name: 'Search your journal' })).toHaveFocus()
  })
})
