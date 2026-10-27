import { describe, expect, it } from 'vitest'
import type { CreatureInstance } from '../types'
import { fieldNotesBySpecies, formatWelcomedOn } from './fieldNotes'

function creature(id: string, overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id,
    speciesId: 'monarch',
    name: id,
    stage: 'butterfly',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-03-03T15:00:00.000Z',
    ...overrides,
  }
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

describe('field notes by species', () => {
  it('counts species, not creatures, and only butterflies', () => {
    const notes = fieldNotesBySpecies([
      creature('Sol'),
      creature('Luna'),
      creature('Pip', { speciesId: 'queen' }),
      creature('Egg', { speciesId: 'viceroy', stage: 'egg' }),
    ])
    expect([...notes.keys()]).toEqual(['monarch', 'queen'])
    expect(notes.get('monarch')?.count).toBe(2)
    expect(notes.get('queen')?.count).toBe(1)
  })

  it('names the first of a species to be welcomed, wherever it sits in the garden', () => {
    const notes = fieldNotesBySpecies([
      creature('Later', { discoveredAt: '2026-05-01T12:00:00.000Z' }),
      creature('First', { discoveredAt: '2026-02-01T12:00:00.000Z' }),
      creature('Between', { discoveredAt: '2026-04-01T12:00:00.000Z' }),
    ])
    expect(notes.get('monarch')).toMatchObject({ count: 3, first: { name: 'First' } })
  })

  it('keeps the garden’s own order on a tie, and puts an unknown date last', () => {
    const tie = fieldNotesBySpecies([creature('One'), creature('Two')])
    expect(tie.get('monarch')?.first.name).toBe('One')

    const unknown = fieldNotesBySpecies([
      creature('Damaged', { discoveredAt: new Date(0).toISOString() }),
      creature('Unreadable', { discoveredAt: 'soon' }),
      creature('Known', { discoveredAt: '2026-06-01T12:00:00.000Z' }),
    ])
    expect(unknown.get('monarch')?.first.name).toBe('Known')
    expect(fieldNotesBySpecies([creature('Damaged', { discoveredAt: 'soon' })]).get('monarch')?.first.name).toBe(
      'Damaged',
    )
  })
})

describe('the day a creature was welcomed', () => {
  it('is the gardener’s own calendar day, though UTC has moved on', () => {
    // 01:30 UTC on 4 March is still the evening of 3 March in New York.
    expect(formatWelcomedOn(creature('Sol', { discoveredAt: '2026-03-04T01:30:00.000Z' }))).toBe(
      dayFormat.format(new Date(2026, 2, 3, 12)),
    )
  })

  it('is unknown for a damaged or unreadable date', () => {
    expect(formatWelcomedOn(creature('Sol', { discoveredAt: new Date(0).toISOString() }))).toBeUndefined()
    expect(formatWelcomedOn(creature('Sol', { discoveredAt: '' }))).toBeUndefined()
  })
})
