import { describe, expect, it } from 'vitest'
import { base64Of, withPhotosAsText } from './sightingPhotos'

describe('photos written as text, for a file', () => {
  it('hands back the very same value when it holds no photo', async () => {
    const garden = { sightings: [{ id: 'a', note: 'No photo' }], moods: [] }
    await expect(withPhotosAsText(garden)).resolves.toBe(garden)
    await expect(withPhotosAsText('text')).resolves.toBe('text')
  })

  it('writes each photo as its type and base64, copying only what holds one', async () => {
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const untouched = [{ id: 'mood' }]
    const garden = { moods: untouched, sightings: [{ id: 'a', photo }, { id: 'b' }] }
    const written = await withPhotosAsText(garden)
    expect(written).not.toBe(garden)
    expect(written.moods).toBe(untouched)
    expect(written.sightings[1]).toBe(garden.sightings[1])
    expect(written.sightings[0]).toEqual({ id: 'a', photo: { mimeType: 'image/png', imageData: 'AQID' } })
    // The garden itself is left as it was.
    expect(garden.sightings[0].photo).toBe(photo)
  })

  it('writes the same photo, wherever it appears, the same way', async () => {
    const photo = new Blob([new Uint8Array([9])], { type: 'image/webp' })
    const stores = { snapshot: { sightings: [{ photo }] }, current: [{ photo }] }
    const written = await withPhotosAsText(stores)
    expect(written.snapshot.sightings[0].photo).toEqual(written.current[0].photo)
  })

  it('writes a photo larger than one slice in full', async () => {
    const bytes = Uint8Array.from({ length: 0x8000 * 2 + 5 }, (_, index) => index % 251)
    const text = await base64Of(new Blob([bytes]))
    expect(Uint8Array.from(atob(text), (character) => character.charCodeAt(0))).toEqual(bytes)
  })
})
