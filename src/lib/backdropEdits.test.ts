import { describe, expect, it } from 'vitest'
import { addQuarterTurn, brightnessWords, turnCrop, withBrightness } from './backdropEdits'
import type { CustomBackdrop } from '../types'

describe('turning in quarter turns', () => {
  it('counts turns to the right, 0 to 3, either way round', () => {
    expect(addQuarterTurn(0, 1)).toBe(1)
    expect(addQuarterTurn(3, 1)).toBe(0)
    expect(addQuarterTurn(0, -1)).toBe(3)
    expect(addQuarterTurn(2, -1)).toBe(1)
  })

  it('turns the focal point with the picture', () => {
    const crop = { x: 0.2, y: 0.1, zoom: 2 }
    // Near the top left; a turn right takes that to the top right.
    expect(turnCrop(crop, 1)).toEqual({ x: 0.9, y: 0.2, zoom: 2 })
    // And a turn left to the bottom left.
    expect(turnCrop(crop, -1)).toEqual({ x: 0.1, y: 0.8, zoom: 2 })
  })

  it('comes back to the same framing after a turn undone, or four the same way', () => {
    // Values a slider gives, which floating point cannot hold exactly.
    const sliders = { x: 0.2, y: 0.1, zoom: 1.5 }
    expect(turnCrop(turnCrop(sliders, 1), -1)).toEqual(sliders)
    expect(turnCrop(turnCrop(sliders, -1), 1)).toEqual(sliders)
    const crop = { x: 0.25, y: 0.75, zoom: 1.5 }
    expect(turnCrop(turnCrop(crop, 1), -1)).toEqual(crop)
    let turned = crop
    for (let turn = 0; turn < 4; turn += 1) turned = turnCrop(turned, 1)
    expect(turned).toEqual(crop)
  })
})

describe('brightness', () => {
  it('says how far from as taken, either way', () => {
    expect(brightnessWords(undefined)).toBe('As taken')
    expect(brightnessWords(0)).toBe('As taken')
    expect(brightnessWords(-20)).toBe('20% darker')
    expect(brightnessWords(15)).toBe('15% brighter')
  })

  it('keeps no field for as taken, so an untouched image stays as it was written', () => {
    const image = {
      id: 'a',
      name: 'Meadow',
      crop: { x: 0.5, y: 0.5, zoom: 1 },
    } as CustomBackdrop
    const darker = withBrightness(image, -25)
    expect(darker.brightness).toBe(-25)
    expect(image).not.toHaveProperty('brightness')
    expect(withBrightness(darker, 0)).not.toHaveProperty('brightness')
    expect(withBrightness(darker, 0)).toEqual(image)
  })
})
