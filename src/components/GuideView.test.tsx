import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { Profile } from '../types'
import { GuideView } from './GuideView'

function renderGuide(profile: Partial<Profile> = {}) {
  const state = createInitialState('Tester', 'Test Garden')
  render(
    <GuideView state={{ ...state, profile: { ...state.profile!, ...profile } }} onShowSeed={vi.fn()} />,
  )
}

describe('the Guide on Moonlight and Sunlight', () => {
  it('speaks of the gardener’s own evening and late night', () => {
    renderGuide({ recapOpensHour: 21, recapGraceEndsHour: 6 })
    expect(screen.getByText(/From 9\s?PM you can round out your day/)).toBeInTheDocument()
    expect(screen.getByText(/keeps offering yesterday until 6\s?AM/)).toBeInTheDocument()
  })

  it('says nothing of a late night that ends at midnight', () => {
    renderGuide({ recapGraceEndsHour: 0 })
    expect(screen.queryByText(/keeps offering yesterday/)).toBeNull()
    expect(screen.getByText(/Both hours can be moved in Settings/)).toBeInTheDocument()
  })

  it('says the next Sunlight tends the plant chosen on Today', () => {
    renderGuide()
    expect(screen.getByText(/tending the plant you chose on Today/)).toBeInTheDocument()
  })
})
