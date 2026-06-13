import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChrysalisCountdown } from './ChrysalisCountdown'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ChrysalisCountdown', () => {
  it('keeps the visible hours current while the garden stays open', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-13T12:00:00.000Z'))

    render(
      <ChrysalisCountdown emergeAt="2026-06-15T14:00:00.000Z" />,
    )
    expect(screen.getByText('2d 2h remaining')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000)
    })

    expect(screen.getByText('2d 1h remaining')).toBeInTheDocument()
  })

  it('updates immediately when the app regains focus', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-13T12:00:00.000Z'))

    render(
      <ChrysalisCountdown emergeAt="2026-06-13T14:30:00.000Z" />,
    )
    expect(screen.getByText('2h 30m remaining')).toBeInTheDocument()

    vi.setSystemTime(new Date('2026-06-13T13:15:00.000Z'))
    act(() => window.dispatchEvent(new Event('focus')))

    expect(screen.getByText('1h 15m remaining')).toBeInTheDocument()
  })
})
