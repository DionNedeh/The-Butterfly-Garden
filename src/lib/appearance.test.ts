import { describe, expect, it } from 'vitest'
import type { AppState, Profile } from '../types'
import { createEmptyState } from './progression'
import {
  daysUntilBackdrop,
  progressAppearance,
  unlockedBackdropIds,
} from './appearance'

const profile: Profile = {
  id: 'profile',
  name: 'Gardener',
  gardenName: 'Test Garden',
  createdAt: '2026-01-01T12:00:00.000Z',
  reducedMotion: false,
}

describe('garden appearance unlocks', () => {
  it('unlocks backdrops after 30 and 60 elapsed days', () => {
    expect(
      unlockedBackdropIds(profile, new Date('2026-01-30T12:00:00.000Z')),
    ).toEqual(['sunlit-meadow'])
    expect(
      unlockedBackdropIds(profile, new Date('2026-01-31T12:00:00.000Z')),
    ).toEqual(['sunlit-meadow', 'woodland-brook'])
    expect(
      unlockedBackdropIds(profile, new Date('2026-03-02T12:00:00.000Z')),
    ).toEqual([
      'sunlit-meadow',
      'woodland-brook',
      'secret-conservatory',
    ])
  })

  it('reports the remaining elapsed days for locked scenes', () => {
    expect(
      daysUntilBackdrop(
        profile,
        'woodland-brook',
        new Date('2026-01-21T12:00:00.000Z'),
      ),
    ).toBe(10)
  })

  it('persists unlocked scenes so a backward clock cannot relock them', () => {
    const state: AppState = { ...createEmptyState(), profile }
    const unlocked = progressAppearance(
      state,
      new Date('2026-03-02T12:00:00.000Z'),
    )
    const clockMovedBack = progressAppearance(
      unlocked,
      new Date('2026-01-02T12:00:00.000Z'),
    )

    expect(clockMovedBack.profile?.unlockedBackdropIds).toEqual([
      'sunlit-meadow',
      'woodland-brook',
      'secret-conservatory',
    ])
  })

  it('adds defaults to profiles saved before appearance settings existed', () => {
    const state: AppState = { ...createEmptyState(), profile }
    expect(
      progressAppearance(state, new Date('2026-01-02T12:00:00.000Z')).profile,
    ).toMatchObject({
      theme: 'sunlight',
      selectedBackdropId: 'sunlit-meadow',
      unlockedBackdropIds: ['sunlit-meadow'],
    })
  })
})
