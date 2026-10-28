import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { announce } from '../lib/announcer'
import { CELEBRATION_MS, Celebrations } from './Celebrations'

describe('celebrations', () => {
  afterEach(() => vi.useRealTimers())

  it('speaks each moment politely and lets it go after a while', () => {
    vi.useFakeTimers()
    render(<Celebrations />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region).toBeEmptyDOMElement()

    act(() => announce([{ kind: 'stage-advanced', creatureName: 'Sol', stage: 'butterfly' }]))
    expect(region).toHaveTextContent('Sol emerged as a butterfly!')

    act(() => {
      vi.advanceTimersByTime(CELEBRATION_MS)
    })
    expect(region).toBeEmptyDOMElement()
  })

  it('says nothing when there is nothing to say', () => {
    render(<Celebrations />)
    act(() => announce([]))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
