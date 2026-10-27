import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../../lib/progression'
import type { AppState } from '../../types'
import { YearLink } from './YearLink'

/** A garden begun in 2025, with a check-in that year. */
function garden(): AppState {
  const base = createInitialState('Robin', 'Quiet Corner', new Date(2025, 2, 1, 9))
  return {
    ...base,
    moods: [
      {
        id: 'mood-1',
        localDate: '2025-06-01',
        level: 3,
        note: '',
        createdAt: '2025-06-01T16:00:00.000Z',
        updatedAt: '2025-06-01T16:00:00.000Z',
      },
    ],
  }
}

function renderLink(today: string, state = garden(), focusOnArrival = false) {
  const onOpen = vi.fn()
  render(
    <p>
      <YearLink state={state} today={today} onOpen={onOpen} focusOnArrival={focusOnArrival} />
    </p>,
  )
  return onOpen
}

describe('the way to the year from the Journal', () => {
  it('is a quiet link for most of the year, to this year', async () => {
    const onOpen = renderLink('2026-10-27')
    const link = screen.getByRole('link', { name: 'Your garden’s year' })
    expect(link).toHaveAttribute('href', '#/year')
    await userEvent.setup().click(link)
    expect(onOpen).toHaveBeenCalledWith(undefined)
  })

  it('is one gentle line in December, for the year that is ending', async () => {
    const onOpen = renderLink('2026-12-01')
    expect(screen.getByText(/As the year turns,/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'look back on your garden’s 2026' })
    expect(link).toHaveAttribute('href', '#/year')
    await userEvent.setup().click(link)
    expect(onOpen).toHaveBeenCalledWith(undefined)
  })

  it('offers the year just gone through January', async () => {
    const onOpen = renderLink('2026-01-31')
    const link = screen.getByRole('link', { name: 'look back on your garden’s 2025' })
    expect(link).toHaveAttribute('href', '#/year/2025')
    await userEvent.setup().click(link)
    expect(onOpen).toHaveBeenCalledWith(2025)
  })

  it('stays quiet in January for a garden with nothing in the year gone', () => {
    renderLink('2026-01-15', createInitialState('Robin', 'Quiet Corner', new Date(2026, 0, 2, 9)))
    expect(screen.getByRole('link', { name: 'Your garden’s year' })).toBeInTheDocument()
    expect(screen.queryByText(/As the year turns/)).toBeNull()
  })

  it('leaves a new tab or window to the browser', () => {
    const onOpen = renderLink('2026-10-27')
    fireEvent.click(screen.getByRole('link', { name: 'Your garden’s year' }), { ctrlKey: true })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('takes focus when the gardener comes back from the year', () => {
    renderLink('2026-10-27', garden(), true)
    expect(screen.getByRole('link', { name: 'Your garden’s year' })).toHaveFocus()
  })
})
