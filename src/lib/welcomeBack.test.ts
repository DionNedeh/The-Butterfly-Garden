import { describe, expect, it } from 'vitest'
import { plants as plantCatalog } from '../data/content'
import type { AppState, CreatureInstance, PlantInstance } from '../types'
import { addDaysToLocalDate } from './date'
import { welcomeBackLine } from './welcomeBack'

function plant(plantId: string, growth: number, id = plantId): PlantInstance {
  return { id, plantId, growth, plantedAt: '2026-01-01T00:00:00.000Z' }
}

function creature(name: string, stage: CreatureInstance['stage'], speciesId = 'monarch'): CreatureInstance {
  return {
    id: name,
    speciesId,
    name,
    stage,
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-01-01T00:00:00.000Z',
  }
}

type Garden = Pick<AppState, 'plants' | 'creatures'>

const fullGarden: Garden = {
  plants: [plant('milkweed', 3), plant('zinnia', 3), plant('parsley', 1), plant('violet', 0)],
  creatures: [creature('Sol', 'butterfly'), creature('Fern', 'caterpillar', 'queen')],
}

/** Every line the garden says over a run of days. */
function linesOver(garden: Garden, days: number): string[] {
  return Array.from({ length: days }, (_, day) =>
    welcomeBackLine(garden, addDaysToLocalDate('2026-10-01', day)),
  )
}

const ABSENCE = /\b(days?|weeks?|months?|missed|miss|lost|gone|waited|waiting|while you were|been away|long)\b/i

describe('the welcome back line', () => {
  it('is the same for the same garden on the same day', () => {
    expect(welcomeBackLine(fullGarden, '2026-10-27')).toBe(welcomeBackLine(fullGarden, '2026-10-27'))
  })

  it('changes with the day, through everything the garden holds', () => {
    const lines = new Set(linesOver(fullGarden, 60))
    expect(lines).toContain('A note from Sol: “The flowers smelled lovely today. Glad you’re here.”')
    expect(lines).toContain('Sol fluttered a slow loop over the garden, just because.')
    expect(lines).toContain('The zinnia opened a new bloom while the garden rested.')
    expect(lines).toContain('A visitor fluttered by the milkweed while the garden rested.')
    expect(lines).toContain('The milkweed swayed in the breeze while the garden rested.')
    expect(lines).toContain('Dew gathered on the parsley while the garden rested.')
    expect(lines).toContain('The violet seed stayed tucked in, warm in the soil.')
    expect(lines).toContain('A note from Marigold: “The garden kept a sunny spot for you.”')
  })

  it('names only plants and companions the garden really has', () => {
    const names = [
      ...plantCatalog.map((entry) => entry.name.toLowerCase()),
      'Sol',
      'Fern',
      'Juniper',
    ]
    for (const line of linesOver(fullGarden, 90)) {
      const named = names.filter((name) => line.includes(name))
      for (const name of named) {
        expect(['milkweed', 'zinnia', 'parsley', 'violet', 'Sol', 'Fern', 'Marigold']).toContain(name)
      }
    }
    // Fern is a caterpillar, not the first companion: never said to fly.
    expect(linesOver(fullGarden, 90).some((line) => line.startsWith('Fern'))).toBe(false)
  })

  it('never says how long, never speaks of anything missed or lost', () => {
    const gardens: Garden[] = [
      fullGarden,
      { plants: [], creatures: [] },
      { plants: [plant('aster', 0)], creatures: [creature('Sol', 'chrysalis')] },
      { plants: [plant('passionflower', 2)], creatures: [creature('Sol', 'caterpillar')] },
    ]
    for (const garden of gardens) {
      for (const line of linesOver(garden, 30)) expect(line).not.toMatch(ABSENCE)
    }
  })

  it('never says a host plant opened a new bloom, which Keep giving would make a promise', () => {
    const hosts: Garden = { plants: [plant('milkweed', 3), plant('willow', 3)], creatures: [] }
    for (const line of linesOver(hosts, 40)) expect(line).not.toMatch(/new bloom/)
  })

  it('hears from the first companion as it is now', () => {
    const dates = Array.from({ length: 20 }, (_, day) => addDaysToLocalDate('2026-10-01', day))
    const lines = (garden: Garden) => new Set(dates.map((date) => welcomeBackLine(garden, date)))
    expect(lines({ plants: [], creatures: [creature('Sol', 'caterpillar')] })).toContain(
      'A note from Sol, nibbled into a leaf: “Hello again.”',
    )
    expect(lines({ plants: [], creatures: [creature('Sol', 'chrysalis')] })).toContain(
      'A note from Sol, tucked beside the chrysalis: “Still dreaming. Glad you’re here.”',
    )
    // An egg writes no notes; Marigold, who is in every garden, still does.
    const egg = lines({ plants: [], creatures: [creature('Sol', 'egg')] })
    expect([...egg].every((line) => line.startsWith('A note from Marigold'))).toBe(true)
  })

  it('says one line for each kind of plant, however many are growing', () => {
    const twins: Garden = {
      plants: [plant('zinnia', 3, 'z1'), plant('zinnia', 3, 'z2')],
      creatures: [],
    }
    const lines = linesOver(twins, 30)
    expect(new Set(lines).size).toBeLessThanOrEqual(4)
  })
})
