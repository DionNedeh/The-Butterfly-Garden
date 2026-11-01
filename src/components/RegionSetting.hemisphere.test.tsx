import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setRegion } from '../lib/gardenActions'
import { createInitialState } from '../lib/progression'
import type { AppState, Profile } from '../types'
import { RegionSetting } from './RegionSetting'

/*
 * 1.4: where the region does not say which half of the world the gardener
 * is in (Elsewhere, or no region chosen), Settings asks, so the garden's
 * seasons can follow theirs.
 */
const QUESTION = 'Which half of the world are you in?'

function renderRegion(profile: Partial<Profile> = {}) {
  const onChoose = vi.fn()
  render(
    <RegionSetting region={profile.region} hemisphere={profile.hemisphere} onChoose={onChoose} />,
  )
  return onChoose
}

function garden(profile: Partial<Profile> = {}): AppState {
  const seed = createInitialState('Tester', 'Seasons')
  return { ...seed, profile: { ...seed.profile!, ...profile } }
}

describe('1.4 which half of the world', () => {
  it('is asked for Elsewhere, and for no region, with nothing chosen at first', () => {
    for (const region of ['elsewhere', undefined] as const) {
      const { unmount } = render(<RegionSetting region={region} onChoose={vi.fn()} />)
      const group = screen.getByRole('group', { name: QUESTION })
      expect(screen.getByRole('radio', { name: 'North' })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: 'South' })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: 'Rather not say' })).toBeChecked()
      expect(group).toHaveTextContent(/seasons/)
      unmount()
    }
  })

  it('is not asked where the region says it', () => {
    for (const region of ['north-america', 'europe', 'australasia'] as const) {
      const { unmount } = render(<RegionSetting region={region} hemisphere="south" onChoose={vi.fn()} />)
      expect(screen.queryByRole('group', { name: QUESTION })).toBeNull()
      unmount()
    }
  })

  it('is chosen with the region it goes with, and can be taken back', async () => {
    const user = userEvent.setup()
    const onChoose = renderRegion({ region: 'elsewhere' })
    await user.click(screen.getByRole('radio', { name: 'South' }))
    expect(onChoose).toHaveBeenLastCalledWith('elsewhere', 'south')
    await user.click(screen.getByRole('radio', { name: 'North' }))
    expect(onChoose).toHaveBeenLastCalledWith('elsewhere', 'north')
  })

  it('shows what was chosen, and keeps it while the region still does not say', async () => {
    const user = userEvent.setup()
    const onChoose = renderRegion({ region: 'elsewhere', hemisphere: 'south' })
    expect(screen.getByRole('radio', { name: 'South' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Rather not say' }))
    expect(onChoose).toHaveBeenLastCalledWith('elsewhere')
    await user.selectOptions(screen.getByRole('combobox', { name: 'My region' }), '')
    expect(onChoose).toHaveBeenLastCalledWith(undefined, 'south')
    await user.selectOptions(screen.getByRole('combobox', { name: 'My region' }), 'europe')
    expect(onChoose).toHaveBeenLastCalledWith('europe')
  })

  it('is stored as chosen beside its region, and none again leaves nothing', () => {
    const south = setRegion(garden(), 'elsewhere', 'south')
    expect(south.profile).toMatchObject({ region: 'elsewhere', hemisphere: 'south' })
    expect(setRegion(garden(), undefined, 'south').profile).toMatchObject({ hemisphere: 'south' })
    // The same again changes nothing.
    expect(setRegion(south, 'elsewhere', 'south')).toBe(south)
    // Rather not say.
    expect(setRegion(south, 'elsewhere').profile).not.toHaveProperty('hemisphere')
    // A named region, chosen alone as Settings chooses it, leaves none beside it.
    const europe = setRegion(south, 'europe')
    expect(europe.profile?.region).toBe('europe')
    expect(europe.profile).not.toHaveProperty('hemisphere')
    // None again: no region and no half of the world, as every garden began.
    const none = setRegion(south, undefined)
    expect(none.profile).not.toHaveProperty('region')
    expect(none.profile).not.toHaveProperty('hemisphere')
  })
})
