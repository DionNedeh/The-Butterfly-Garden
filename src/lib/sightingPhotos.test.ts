import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArrayBufferFileReader, unreadablePhoto } from '../test/fileReader'
import { base64Of, fileCopy, photosLeftOut, withPhotosAsText } from './sightingPhotos'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('photos written as text, for a file', () => {
  it('hands back the very same value when it holds no photo', async () => {
    const garden = { sightings: [{ id: 'a', note: 'No photo' }], moods: [] }
    await expect(withPhotosAsText(garden)).resolves.toEqual({ value: garden, unreadable: 0 })
    expect((await withPhotosAsText(garden)).value).toBe(garden)
    await expect(withPhotosAsText('text')).resolves.toEqual({ value: 'text', unreadable: 0 })
  })

  it('writes each photo as its type and base64, copying only what holds one', async () => {
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const untouched = [{ id: 'mood' }]
    const garden = { moods: untouched, sightings: [{ id: 'a', photo }, { id: 'b' }] }
    const { value: written, unreadable } = await withPhotosAsText(garden)
    expect(unreadable).toBe(0)
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
    const { value: written } = await withPhotosAsText(stores)
    expect(written.snapshot.sightings[0].photo).toEqual(written.current[0].photo)
  })

  it('writes a photo of many thousand bytes in full, by the browser’s own encoder', async () => {
    const bytes = Uint8Array.from({ length: 0x8000 * 2 + 5 }, (_, index) => index % 251)
    const text = await base64Of(new Blob([bytes]))
    expect(Uint8Array.from(atob(text), (character) => character.charCodeAt(0))).toEqual(bytes)
    await expect(base64Of(new Blob([]))).resolves.toBe('')
  })

  it('leaves out a photo whose bytes cannot be read, marked, and writes every other', async () => {
    vi.stubGlobal('FileReader', ArrayBufferFileReader)
    const sound = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const garden = {
      moods: [{ id: 'mood', note: 'Still here.' }],
      sightings: [
        { id: 'lost', photo: unreadablePhoto() },
        { id: 'kept', photo: sound },
        { id: 'also lost', photo: unreadablePhoto() },
      ],
    }
    const { value: written, unreadable } = await withPhotosAsText(garden)
    expect(unreadable).toBe(2)
    expect(written.moods).toBe(garden.moods)
    expect(written.sightings.map((sighting) => sighting.photo)).toEqual([
      { mimeType: 'image/webp', unreadable: true },
      { mimeType: 'image/png', imageData: 'AQID' },
      { mimeType: 'image/webp', unreadable: true },
    ])
  })

  it('makes a file’s text, saying what it had to leave out', async () => {
    vi.stubGlobal('FileReader', ArrayBufferFileReader)
    const sound = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    await expect(fileCopy({ photo: sound })).resolves.toEqual({
      text: JSON.stringify({ photo: { mimeType: 'image/png', imageData: 'AQID' } }, null, 2),
    })
    const copy = await fileCopy({ sightings: [{ photo: unreadablePhoto() }, { photo: sound }] })
    expect(copy.leftOut).toBe(photosLeftOut(1))
    expect(JSON.parse(copy.text)).toEqual({
      sightings: [
        { photo: { mimeType: 'image/webp', unreadable: true } },
        { photo: { mimeType: 'image/png', imageData: 'AQID' } },
      ],
    })
    expect(photosLeftOut(1)).toBe(
      'One photo in the field book could not be read on this device, so the file keeps its sighting without it.',
    )
    expect(photosLeftOut(3)).toBe(
      '3 photos in the field book could not be read on this device, so the file keeps their sightings without them.',
    )
  })
})
