import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppState, GardenBackdropId, Profile } from '../types'
import { createEmptyState, createInitialState } from './progression'
import { previewProvider } from './gardenPass'
import {
  availableBackdropIds,
  backdropUnlockDays,
  daysUntilBackdrop,
  effectiveBackdropId,
  gardenBackdrops,
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

describe('backdrops that depend on pass access', () => {
  /**
   * A pass-gated scene, injected here rather than added to the catalog: the
   * four new backdrops in the plan need real artwork, which is a separate
   * deliverable, and shipping an id with no image would render a blank garden.
   */
  const PASS_SCENE_ID = 'twilight-orchard' as GardenBackdropId
  const passScene = {
    id: PASS_SCENE_ID,
    name: 'Twilight Orchard',
    description: 'A cool orchard with warm distant lights.',
    unlock: { kind: 'pass' } as const,
  }

  beforeEach(() => {
    gardenBackdrops.push(passScene)
  })

  afterEach(() => {
    const index = gardenBackdrops.indexOf(passScene)
    if (index >= 0) gardenBackdrops.splice(index, 1)
  })

  const passProfile = (overrides: Partial<Profile> = {}): Profile => ({
    id: 'profile',
    name: 'Tester',
    gardenName: 'Test Garden',
    createdAt: '2026-01-01T00:00:00.000Z',
    reducedMotion: false,
    ambientTrack: 'garden-chimes',
    theme: 'sunlight',
    selectedBackdropId: 'sunlit-meadow',
    unlockedBackdropIds: ['sunlit-meadow'],
    ...overrides,
  })

  const later = new Date('2026-04-01T00:00:00.000Z')

  it('offers a pass scene only while access holds', () => {
    expect(availableBackdropIds(passProfile(), later, previewProvider)).toContain(
      PASS_SCENE_ID,
    )
    expect(availableBackdropIds(passProfile(), later, null)).not.toContain(
      PASS_SCENE_ID,
    )
  })

  it('never records a pass scene as permanently unlocked', () => {
    // The permanent list is written back into the profile, so anything that
    // reaches it is kept for good. A grant that can lapse must stay out.
    expect(unlockedBackdropIds(passProfile(), later)).not.toContain(PASS_SCENE_ID)
  })

  it('refuses a pass scene smuggled into the stored unlocks', () => {
    // A hand-edited backup could list it. Availability is decided by access,
    // not by what the file claims was already earned.
    const forged = passProfile({
      unlockedBackdropIds: ['sunlit-meadow', PASS_SCENE_ID],
    })
    expect(unlockedBackdropIds(forged, later)).not.toContain(PASS_SCENE_ID)
    expect(availableBackdropIds(forged, later, null)).not.toContain(
      PASS_SCENE_ID,
    )
  })

  it('keeps the chosen pass scene when access lapses, and draws the default', () => {
    const chosen = passProfile({ selectedBackdropId: PASS_SCENE_ID })
    const state = { ...createInitialState('Tester', 'Test Garden'), profile: chosen }

    const progressed = progressAppearance(state, later)
    // The choice survives...
    expect(progressed.profile?.selectedBackdropId).toBe(PASS_SCENE_ID)
    // ...but is not treated as earned, and the scene drawn falls back.
    expect(progressed.profile?.unlockedBackdropIds).not.toContain(PASS_SCENE_ID)
    expect(effectiveBackdropId(chosen, later, null)).toBe('sunlit-meadow')
    expect(effectiveBackdropId(chosen, later, previewProvider)).toBe(
      PASS_SCENE_ID,
    )
  })

  it('still clears a selection this build does not recognise', () => {
    const broken = passProfile({
      selectedBackdropId: 'retired-scene' as GardenBackdropId,
    })
    const state = { ...createInitialState('Tester', 'Test Garden'), profile: broken }
    expect(progressAppearance(state, later).profile?.selectedBackdropId).toBe(
      'sunlit-meadow',
    )
  })

  it('reports no waiting days for an access-gated scene', () => {
    // Waiting is not how it is obtained, so a countdown would be misleading.
    expect(backdropUnlockDays(passScene)).toBe(0)
    expect(daysUntilBackdrop(passProfile(), PASS_SCENE_ID, later)).toBe(0)
  })
})

