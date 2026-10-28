import { describe, expect, it } from 'vitest'
import type { ComfortPlan } from '../types'
import { COMFORT_ITEMS, COMFORT_TEXT_LENGTH } from './comfortPlan'
import {
  addComfortItem,
  changeComfortItem,
  moveComfortItem,
  phoneProblem,
  removeComfortItem,
  restoreComfortItem,
  telHref,
} from './comfortPlanEdits'

const tea = { id: 'tea', text: 'A cup of tea' }
const walk = { id: 'walk', text: 'A slow walk' }
const song = { id: 'song', text: 'That one song' }
const sam = { id: 'sam', text: 'Sam', phone: '+44 7700 900123' }

describe('adding a line', () => {
  it('adds it at the end of its list, trimmed, with an id of its own', () => {
    const plan: ComfortPlan = { helps: [tea] }
    const next = addComfortItem(plan, 'helps', { text: '  A slow walk ' }, 'walk')
    expect(next).toEqual({ helps: [tea, walk] })
    expect(plan).toEqual({ helps: [tea] })
    const fresh = addComfortItem({}, 'places', { text: 'The library' })
    expect(fresh.places?.[0].id).toEqual(expect.any(String))
    expect(fresh.places?.[0].id).not.toBe('')
  })

  it('keeps a person’s number, cleaned, and a number nowhere else', () => {
    expect(addComfortItem({}, 'people', { text: 'Sam', phone: ' +44 7700 900123 ' }, 'sam')).toEqual({
      people: [sam],
    })
    expect(addComfortItem({}, 'people', { text: 'Jo', phone: '' }, 'jo')).toEqual({
      people: [{ id: 'jo', text: 'Jo' }],
    })
    expect(addComfortItem({}, 'helps', { text: 'Tea', phone: '999' }, 'tea')).toEqual({
      helps: [{ id: 'tea', text: 'Tea' }],
    })
  })

  it('adds nothing without words, or to a full list', () => {
    const plan: ComfortPlan = { helps: [tea] }
    expect(addComfortItem(plan, 'helps', { text: '   ' })).toBe(plan)
    expect(addComfortItem(plan, 'people', { text: '', phone: '999' })).toBe(plan)
    const full: ComfortPlan = {
      matters: Array.from({ length: COMFORT_ITEMS }, (_, index) => ({ id: `m${index}`, text: `${index}` })),
    }
    expect(addComfortItem(full, 'matters', { text: 'One more' })).toBe(full)
  })

  it('cuts a long line to what the page keeps', () => {
    const next = addComfortItem({}, 'kindWords', { text: 'k'.repeat(COMFORT_TEXT_LENGTH + 30) }, 'k')
    expect(next.kindWords?.[0].text).toHaveLength(COMFORT_TEXT_LENGTH)
  })
})

describe('changing a line', () => {
  it('changes its words where it stands', () => {
    const plan: ComfortPlan = { helps: [tea, walk] }
    expect(changeComfortItem(plan, 'helps', 'tea', { text: 'Hot chocolate' })).toEqual({
      helps: [{ id: 'tea', text: 'Hot chocolate' }, walk],
    })
  })

  it('changes a person’s number, or takes it away', () => {
    const plan: ComfortPlan = { people: [sam] }
    expect(changeComfortItem(plan, 'people', 'sam', { text: 'Sam', phone: '0161 496 0000' })).toEqual({
      people: [{ id: 'sam', text: 'Sam', phone: '0161 496 0000' }],
    })
    expect(changeComfortItem(plan, 'people', 'sam', { text: 'Sam', phone: '' })).toEqual({
      people: [{ id: 'sam', text: 'Sam' }],
    })
  })

  it('changes nothing for the same words, no words, or a line that is not there', () => {
    const plan: ComfortPlan = { helps: [tea], people: [sam] }
    expect(changeComfortItem(plan, 'helps', 'tea', { text: ' A cup of tea ' })).toBe(plan)
    expect(changeComfortItem(plan, 'people', 'sam', { text: 'Sam', phone: '+44 7700 900123' })).toBe(plan)
    expect(changeComfortItem(plan, 'helps', 'tea', { text: '  ' })).toBe(plan)
    expect(changeComfortItem(plan, 'helps', 'gone', { text: 'New' })).toBe(plan)
    expect(changeComfortItem(plan, 'places', 'tea', { text: 'New' })).toBe(plan)
  })
})

describe('moving a line', () => {
  const plan: ComfortPlan = { helps: [tea, walk, song] }

  it('moves it one place up or down', () => {
    expect(moveComfortItem(plan, 'helps', 'walk', -1)).toEqual({ helps: [walk, tea, song] })
    expect(moveComfortItem(plan, 'helps', 'walk', 1)).toEqual({ helps: [tea, song, walk] })
    expect(plan).toEqual({ helps: [tea, walk, song] })
  })

  it('moves nothing past either end, or a line that is not there', () => {
    expect(moveComfortItem(plan, 'helps', 'tea', -1)).toBe(plan)
    expect(moveComfortItem(plan, 'helps', 'song', 1)).toBe(plan)
    expect(moveComfortItem(plan, 'helps', 'gone', 1)).toBe(plan)
    expect(moveComfortItem(plan, 'places', 'tea', 1)).toBe(plan)
  })
})

describe('removing a line, and putting it back', () => {
  it('removes it, and drops a list left empty', () => {
    const plan: ComfortPlan = { helps: [tea, walk], places: [song] }
    expect(removeComfortItem(plan, 'helps', 'tea')).toEqual({ helps: [walk], places: [song] })
    expect(removeComfortItem(plan, 'places', 'song')).toEqual({ helps: [tea, walk] })
    expect(removeComfortItem(plan, 'helps', 'gone')).toBe(plan)
  })

  it('puts it back where it was', () => {
    const plan: ComfortPlan = { helps: [tea, walk, song] }
    const removed = removeComfortItem(plan, 'helps', 'walk')
    expect(restoreComfortItem(removed, 'helps', walk, 1)).toEqual(plan)
    // Into a list that went with it, too.
    expect(restoreComfortItem({}, 'people', sam, 0)).toEqual({ people: [sam] })
    // Where the list has since grown shorter, at its end.
    expect(restoreComfortItem({ helps: [tea] }, 'helps', song, 5)).toEqual({ helps: [tea, song] })
  })

  it('leaves alone a line already back, and a list filled again meanwhile', () => {
    const plan: ComfortPlan = { helps: [tea, walk] }
    expect(restoreComfortItem(plan, 'helps', walk, 1)).toBe(plan)
    const full: ComfortPlan = {
      helps: Array.from({ length: COMFORT_ITEMS }, (_, index) => ({ id: `h${index}`, text: `${index}` })),
    }
    expect(restoreComfortItem(full, 'helps', tea, 0)).toBe(full)
  })
})

describe('a number to call', () => {
  it('takes numbers as people write them', () => {
    for (const number of ['999', '+44 7700 900123', '0161-496-0000', '(555) 123-4567', '555.123.4567', '']) {
      expect(phoneProblem(number)).toBeUndefined()
    }
  })

  it('says why it cannot take one', () => {
    expect(phoneProblem('call mum')).toBe('A phone number can hold digits, a plus sign, spaces and dashes.')
    expect(phoneProblem('0800 FLOWERS')).toBe(
      'A phone number can hold digits, a plus sign, spaces and dashes.',
    )
    expect(phoneProblem('12')).toBe('That number looks too short to call.')
    expect(phoneProblem('+ -')).toBe('That number looks too short to call.')
  })

  it('hands the dialler the digits and any plus sign', () => {
    expect(telHref('+44 7700 900123')).toBe('tel:+447700900123')
    expect(telHref('0161-496-0000')).toBe('tel:01614960000')
    expect(telHref('999')).toBe('tel:999')
  })

  it('leaves out a 0 in brackets after a country code, which is never dialled after it', () => {
    // The United Kingdom, written the common ways.
    expect(telHref('+44 (0)7700 900123')).toBe('tel:+447700900123')
    expect(telHref('+44(0)20 7946 0018')).toBe('tel:+442079460018')
    expect(telHref(' +44 ( 0 ) 161 496 0000')).toBe('tel:+441614960000')
    // Ireland and Australia.
    expect(telHref('+353 (0)85 123 4567')).toBe('tel:+353851234567')
    expect(telHref('+61 (0)4 1234 5678')).toBe('tel:+61412345678')
    // Digits in brackets round an area code are dialled.
    expect(telHref('+1 (555) 010-0199')).toBe('tel:+15550100199')
    expect(telHref('(555) 123-4567')).toBe('tel:5551234567')
    // Without a country code the 0 is the one to dial at home.
    expect(telHref('(0)161 496 0000')).toBe('tel:01614960000')
    expect(telHref('(020) 7946 0018')).toBe('tel:02079460018')
    // A 0 that is part of the number after its code, unbracketed, stays.
    expect(telHref('+39 06 1234 5678')).toBe('tel:+390612345678')
  })
})
