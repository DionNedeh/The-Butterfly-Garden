import { describe, expect, it } from 'vitest'
import { phoneProblem, telHref } from './comfortPlanEdits'

/*
 * 6.9: the comfort plan's phone help says what a number may hold, and the
 * dialler is handed the right digits for more of the ways people write an
 * international number with the 0 dialled only at home.
 */
describe('6.9 a number to call', () => {
  it('says plainly what a number may hold, brackets and dots included', () => {
    const help = 'A phone number can hold digits, a plus sign, spaces, dashes, brackets and dots.'
    expect(phoneProblem('call mum')).toBe(help)
    expect(phoneProblem('0800 FLOWERS')).toBe(help)
    // Everything the help names is taken.
    expect(phoneProblem('+44 (0)20.7946-0018')).toBeUndefined()
  })

  it('takes 00 for the plus sign before a country code and its bracketed 0', () => {
    expect(telHref('0044 (0)7700 900123')).toBe('tel:+447700900123')
    expect(telHref('00 44 (0) 20 7946 0018')).toBe('tel:+442079460018')
    expect(telHref('00353 (0)85 123 4567')).toBe('tel:+353851234567')
  })

  it('leaves out the home 0 at the start of a bracketed area code, where the country has one', () => {
    // The UK, Germany, France, Australia, New Zealand and Ireland.
    expect(telHref('+44 (020) 7946 0018')).toBe('tel:+442079460018')
    expect(telHref('+49 (030) 1234 5678')).toBe('tel:+493012345678')
    expect(telHref('+33 (01) 23 45 67 89')).toBe('tel:+33123456789')
    expect(telHref('+61 (02) 9876 5432')).toBe('tel:+61298765432')
    expect(telHref('+64 (09) 123 4567')).toBe('tel:+6491234567')
    expect(telHref('+353 (01) 234 5678')).toBe('tel:+35312345678')
    expect(telHref('0044 (0161) 496 0000')).toBe('tel:+441614960000')
  })

  it('keeps the 0 where it is dialled after the country code, as in Italy', () => {
    expect(telHref('+39 (06) 1234 5678')).toBe('tel:+390612345678')
    expect(telHref('0039 (06) 1234 5678')).toBe('tel:+390612345678')
    expect(telHref('+39 06 1234 5678')).toBe('tel:+390612345678')
  })

  it('dials everything else as before', () => {
    expect(telHref('+1 (555) 010-0199')).toBe('tel:+15550100199')
    expect(telHref('(020) 7946 0018')).toBe('tel:02079460018')
    expect(telHref('0161 496 0000')).toBe('tel:01614960000')
    expect(telHref('+44 (0)7700 900123')).toBe('tel:+447700900123')
    expect(telHref('0044 7700 900123')).toBe('tel:00447700900123')
    // Australia's own way out, 0011, is not taken for a country code.
    expect(telHref('0011 44 (0)20 7946 0018')).toBe('tel:00114402079460018')
  })
})
