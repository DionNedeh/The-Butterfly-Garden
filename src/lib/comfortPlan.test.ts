import { describe, expect, it } from 'vitest'
import type { AppState, ComfortPlan } from '../types'
import {
  changeComfortPlan,
  COMFORT_TEXT_LENGTH,
  comfortText,
  PHONE_LENGTH,
  phoneNumber,
} from './comfortPlan'
import { createInitialState } from './progression'

const walk = { id: 'walk', text: 'A slow walk' }

function gardenWith(comfortPlan?: ComfortPlan): AppState {
  const seed = createInitialState('Tester', 'Test Garden')
  return { ...seed, profile: { ...seed.profile!, ...(comfortPlan ? { comfortPlan } : {}) } }
}

describe('a comfort plan’s words as they are kept', () => {
  it('trims a line and keeps no more of it than the page does', () => {
    expect(comfortText('  A warm drink  ')).toBe('A warm drink')
    expect(comfortText('   ')).toBe('')
    const long = `${'a'.repeat(COMFORT_TEXT_LENGTH - 1)} and more`
    expect(comfortText(long)).toBe('a'.repeat(COMFORT_TEXT_LENGTH - 1))
    expect(comfortText('x'.repeat(COMFORT_TEXT_LENGTH + 5))).toHaveLength(COMFORT_TEXT_LENGTH)
  })

  it('keeps a number in digits, plus signs, spaces and dashes, with its groups', () => {
    expect(phoneNumber('+44 7700 900123')).toBe('+44 7700 900123')
    expect(phoneNumber('  0161-496-0000 ')).toBe('0161-496-0000')
    expect(phoneNumber('(555) 123.4567')).toBe('555 123 4567')
    expect(phoneNumber('555\t\n1234')).toBe('555 1234')
    expect(phoneNumber('call 999 now')).toBe('999')
  })

  it('is no number at all without a digit, and no longer than a number may be', () => {
    expect(phoneNumber('')).toBe('')
    expect(phoneNumber('mum')).toBe('')
    expect(phoneNumber('+ - +')).toBe('')
    const long = '1'.repeat(PHONE_LENGTH + 10)
    expect(phoneNumber(long)).toHaveLength(PHONE_LENGTH)
    // Cut where a space falls, it does not end on one.
    expect(phoneNumber(`${'1'.repeat(PHONE_LENGTH - 1)} 23`)).toBe('1'.repeat(PHONE_LENGTH - 1))
  })
})

describe('changing the plan in the garden', () => {
  it('puts the changed plan in the profile, and nowhere else', () => {
    const garden = gardenWith()
    const next = changeComfortPlan(garden, () => ({ helps: [walk] }))
    expect(next.profile?.comfortPlan).toEqual({ helps: [walk] })
    expect(next).not.toHaveProperty('comfortPlan')
    // Nothing else in the garden is touched.
    expect(next.goals).toBe(garden.goals)
    expect(next.profile?.gardenName).toBe('Test Garden')
    expect(garden.profile).not.toHaveProperty('comfortPlan')
  })

  it('hands an empty plan to a change when none is written yet', () => {
    let given: ComfortPlan | undefined
    changeComfortPlan(gardenWith(), (plan) => {
      given = plan
      return plan
    })
    expect(given).toEqual({})
  })

  it('gives back the very same garden when the change changes nothing', () => {
    const garden = gardenWith({ helps: [walk] })
    expect(changeComfortPlan(garden, (plan) => plan)).toBe(garden)
    const empty = gardenWith()
    expect(changeComfortPlan(empty, (plan) => plan)).toBe(empty)
  })

  it('keeps no plan at all once nothing is left in it', () => {
    const next = changeComfortPlan(gardenWith({ helps: [walk] }), () => ({}))
    expect(next.profile).not.toHaveProperty('comfortPlan')
  })

  it('has nowhere to keep a plan before there is a garden', () => {
    const garden = { ...gardenWith(), profile: undefined }
    expect(changeComfortPlan(garden, () => ({ helps: [walk] }))).toBe(garden)
  })
})
