import { describe, expect, it } from 'vitest'
import type { Season } from '../lib/seasons'
import { DAY_WORDS } from '../test/nightWords'
import { plants, species } from './content'
import { observations } from './observations'
import { nightLines } from './nightLines'
import { marigoldLines, seasonArt, seasonLines } from './seasons'
import { shopItems } from './shopItems'

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']
const REGIONS = ['north-america', 'europe', 'australasia'] as const

/** A butterfly on the wing, which it is not at night. */
const FLYING = /\b(fly|flies|flying|flew|glides?|gliding|soars?|sails?|flutters?|flickers?|drifts?|sweeps?)\b/i

const CATCHING = /\b(catch|net|nets|handle|hold|pick up|collect)\b/i

describe('the season’s lines', () => {
  it('say something for every season in every region', () => {
    for (const region of REGIONS) {
      for (const season of SEASONS) {
        const lines = seasonLines.filter((line) => line.region === region && line.season === season)
        expect(lines.length, `${region} ${season}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('name their place, cite a source, and say it plainly', () => {
    for (const line of seasonLines) {
      // The place first ("In much of North America, …"), and a full stop.
      expect(line.text, line.text).toMatch(
        /^In [^,]*\b(North America|United States|Florida|UK|England|Australia|New Zealand), .*\.$/,
      )
      expect(line.text.length, line.text).toBeLessThanOrEqual(130)
      expect(line.sources.length).toBeGreaterThan(0)
      for (const source of line.sources) expect(new URL(source).protocol).toBe('https:')
      expect(line.text).not.toMatch(CATCHING)
    }
    const texts = seasonLines.map((line) => line.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('can all be said at night: none speaks of the sun or the hour', () => {
    for (const line of seasonLines) expect(line.text, line.text).not.toMatch(DAY_WORDS)
    for (const hemisphere of Object.values(marigoldLines)) {
      for (const text of Object.values(hemisphere)) expect(text).not.toMatch(DAY_WORDS)
    }
  })
})

describe('Marigold’s travels', () => {
  it('get her ready in autumn and bring her back in spring, in both halves of the world', () => {
    for (const hemisphere of ['north', 'south'] as const) {
      expect(marigoldLines[hemisphere].autumn).toMatch(/^Marigold is getting ready to travel/)
      expect(marigoldLines[hemisphere].spring).toMatch(/^Marigold is back/)
      expect(marigoldLines[hemisphere].summer).toBeUndefined()
      expect(marigoldLines[hemisphere].winter).toBeUndefined()
    }
    expect(marigoldLines.north.spring).toMatch(/back from the south/)
    // In the south, monarchs go to winter roosts, not south.
    expect(marigoldLines.south.autumn).not.toMatch(/south|north/)
    expect(marigoldLines.south.spring).not.toMatch(/south|north/)
  })

  it('never has her leave: she stays to guide the gardener', () => {
    for (const hemisphere of ['north', 'south'] as const) {
      expect(marigoldLines[hemisphere].autumn).toMatch(/She will stay to guide you/)
      for (const text of Object.values(marigoldLines[hemisphere])) {
        expect(text).not.toMatch(/\b(gone|left|leaves|away|goodbye)\b/i)
      }
    }
  })
})

describe('the night’s lines', () => {
  const speciesIds = new Set(species.map((item) => item.id))

  it('belong to a butterfly of the garden, or to any garden', () => {
    for (const [speciesId] of nightLines) {
      expect(speciesId === 'all' || speciesIds.has(speciesId), speciesId).toBe(true)
    }
    expect(nightLines.filter(([speciesId]) => speciesId === 'all').length).toBeGreaterThanOrEqual(3)
  })

  it('give every butterfly its own, at least one naming its host plant', () => {
    // A plant's own name, without the words many names share.
    const generic = new Set(['native', 'tree', 'vine', 'garden', 'tropical', 'flowering', 'stinging', 'white', 'black'])
    for (const butterfly of species) {
      const own = nightLines.filter(([speciesId]) => speciesId === butterfly.id).map(([, text]) => text)
      expect(own.length, butterfly.id).toBeGreaterThanOrEqual(2)
      const plantWords = plants
        .filter((plant) => butterfly.hostPlantIds.includes(plant.id))
        .flatMap((plant) => plant.name.toLowerCase().split(/\s+/))
        .filter((word) => word.length >= 3 && !generic.has(word))
      expect(
        own.some((text) => plantWords.some((word) => text.toLowerCase().includes(word))),
        `${butterfly.id}: ${plantWords.join(', ')}`,
      ).toBe(true)
    }
  })

  it('keep the night: no sun, no hour of the day, and nobody on the wing', () => {
    for (const [, text] of nightLines) {
      expect(text, text).not.toMatch(DAY_WORDS)
      expect(text, text).not.toMatch(FLYING)
      expect(text, text).toMatch(/^[A-Z].*\.$/)
    }
  })

  it('are new words, never the day’s', () => {
    const day = new Set(observations.map((item) => item.text))
    const texts = nightLines.map(([, text]) => text)
    for (const text of texts) expect(day.has(text), text).toBe(false)
    expect(new Set(texts).size).toBe(texts.length)
  })
})

describe('the art each season will want', () => {
  it('names an overlay, a free keepsake and a Pass outfit for every season, with ids of their own', () => {
    const ids: string[] = []
    for (const season of SEASONS) {
      const art = seasonArt[season]
      for (const piece of [art.overlay, art.keepsake, art.passOutfit]) {
        expect(piece.id).toMatch(/^[a-z0-9-]+$/)
        expect(piece.name.trim()).not.toBe('')
        expect(piece.brief).toMatch(/\.$/)
        ids.push(piece.id)
      }
      expect(['headwear', 'accessory', 'aura']).toContain(art.passOutfit.slot)
    }
    expect(new Set(ids).size).toBe(ids.length)
    // None may be mistaken for something the shop already sells.
    const sold = new Set(shopItems.map((item) => item.id))
    for (const id of ids) expect(sold.has(id), id).toBe(false)
  })
})
