import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../../lib/progression'
import type { Profile } from '../../types'
import { LetterCard } from './LetterCard'

// The tests run in New York. Sunday 25 October 2026 ends the week of the
// 19th; Sunday 1 November, when the clocks go back, ends the next.

/** A garden planted well before, with its own evening at 6pm. */
const planted = createInitialState('Robin', 'Letters', new Date(2026, 8, 1, 9)).profile!

const card = () => screen.queryByRole('region', { name: 'A letter from Marigold is waiting' })

function renderCard(profile: Profile = planted) {
  const onRead = vi.fn()
  const onPutAway = vi.fn()
  const view = render(<LetterCard profile={profile} onRead={onRead} onPutAway={onPutAway} />)
  return { onRead, onPutAway, view }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('the letter card', () => {
  it('arrives on Sunday at the gardener’s evening hour, while the garden is open', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 25, 17, 59) })
    renderCard({ ...planted, lastLetterRead: '2026-10-18' })
    expect(card()).toBeNull()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(card()).toBeInTheDocument()
  })

  it('waits all week until it is read', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 10) })
    renderCard()
    expect(card()).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(4 * 24 * 3_600_000)
    })
    expect(card()).toBeInTheDocument()
  })

  it('is replaced by the next letter on the Sunday the clocks go back', () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 1, 17, 30) })
    const { onPutAway } = renderCard({ ...planted, lastLetterRead: '2026-10-25' })
    expect(card()).toBeNull()
    act(() => {
      vi.advanceTimersByTime(30 * 60_000)
    })
    expect(new Date().getHours()).toBe(18)
    act(() => {
      screen.getByRole('button', { name: 'Put away' }).click()
    })
    expect(onPutAway).toHaveBeenCalledWith('2026-11-01')
  })

  it('follows the gardener’s own evening hour', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 25, 19) })
    renderCard({ ...planted, recapOpensHour: 20, lastLetterRead: '2026-10-18' })
    expect(card()).toBeNull()
    act(() => {
      vi.advanceTimersByTime(3_600_000)
    })
    expect(card()).toBeInTheDocument()
  })

  it('looks again when the page is seen again, as a phone asleep may hold a timer back', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 25, 12) })
    renderCard({ ...planted, lastLetterRead: '2026-10-18' })
    expect(card()).toBeNull()
    // Time passes without the timer firing, as on a phone asleep.
    vi.setSystemTime(new Date(2026, 9, 25, 21))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(card()).toBeInTheDocument()
  })

  it('opens the letter, or is put away, with one button each', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 10) })
    const { onRead, onPutAway } = renderCard()
    const read = screen.getByRole('button', { name: 'Read the letter' })
    act(() => read.click())
    expect(onRead).toHaveBeenCalledTimes(1)
    act(() => screen.getByRole('button', { name: 'Put away' }).click())
    expect(onPutAway).toHaveBeenCalledWith('2026-10-25')
  })

  it('says nothing once read, or before the garden has had a week', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 10) })
    const { view } = renderCard({ ...planted, lastLetterRead: '2026-10-25' })
    expect(view.container).toBeEmptyDOMElement()
    view.unmount()
    // Planted on the Sunday itself: no letter about the hour it has existed.
    renderCard({ ...planted, createdAt: new Date(2026, 9, 25, 9).toISOString() })
    expect(card()).toBeNull()
  })

  it('stops its timer when the garden closes', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 27, 10) })
    const { view } = renderCard()
    expect(vi.getTimerCount()).toBe(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
