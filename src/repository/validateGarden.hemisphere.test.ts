import { describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import { readImportedState } from './gardenRepository'
import { validateGarden } from './validateGarden'

/*
 * 1.4: Profile.hemisphere, the half of the world a gardener chose in
 * Settings when their region does not say. Optional, and carried whole by
 * older builds with the rest of the profile.
 */
function garden(hemisphere: unknown) {
  const seed = createInitialState('Tester', 'Seasons')
  return { ...seed, profile: { ...seed.profile, region: 'elsewhere', hemisphere } }
}

describe('1.4 the half of the world a gardener chose', () => {
  it('is kept when it is the north or the south', () => {
    for (const hemisphere of ['north', 'south']) {
      const result = validateGarden(garden(hemisphere))
      expect(result.state?.profile?.hemisphere).toBe(hemisphere)
      expect(result.repaired).toBe(0)
    }
  })

  it('is dropped, without counting as damage, when it is anything else', () => {
    for (const hemisphere of ['South', 'east', '', 'australasia', 1, true, null, { half: 'south' }]) {
      const result = validateGarden(garden(hemisphere))
      expect(result.refused).toBeUndefined()
      expect(result.state?.profile).not.toHaveProperty('hemisphere')
      // The rest of the profile stands.
      expect(result.state?.profile?.region).toBe('elsewhere')
      expect(result.repaired).toBe(0)
    }
  })

  it('is simply absent from a garden that never chose one', () => {
    const seed = createInitialState('Tester', 'Seasons')
    expect(validateGarden(seed).state?.profile).not.toHaveProperty('hemisphere')
  })

  it('comes back from a backup as it went in', () => {
    const envelope = JSON.parse(
      JSON.stringify({
        format: 'the-butterfly-garden',
        exportedAt: '2026-11-01T09:00:00.000Z',
        garden: garden('south'),
      }),
    ) as unknown
    expect(readImportedState(envelope)?.profile).toMatchObject({
      region: 'elsewhere',
      hemisphere: 'south',
    })
  })
})
