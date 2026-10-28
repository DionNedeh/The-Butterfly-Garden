import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openValue, sealValue } from './sealedStores'

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function dataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function bytesOf(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())]
}

describe('a photo sealed for one place and then another', () => {
  it('opens from the place it was set aside in, after being opened from the field book', async () => {
    const key = await dataKey()
    const photo = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/webp' })
    const fieldBook = await sealValue(key, 'sightings', [{ id: 'a', photo }])
    const [opened] = (await openValue(key, 'sightings', fieldBook)) as Array<{ photo: Blob }>
    // The same photo, now set aside: sealed for there, not reused from the field book.
    const setAside = await sealValue(key, 'quarantine', { sightings: [opened] })
    const back = (await openValue(key, 'quarantine', setAside)) as { sightings: Array<{ photo: Blob }> }
    expect(await bytesOf(back.sightings[0].photo)).toEqual([1, 2, 3, 4, 5])
    expect(back.sightings[0].photo.type).toBe('image/webp')
  })

  it('still reuses a photo’s sealed copy when it is stored again in the same place', async () => {
    const key = await dataKey()
    const photo = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/webp' })
    const first = await sealValue(key, 'sightings', [{ photo }])
    const [opened] = (await openValue(key, 'sightings', first)) as Array<{ photo: Blob }>
    const encrypt = vi.spyOn(crypto.subtle, 'encrypt')
    const again = await sealValue(key, 'sightings', [opened])
    // Only the field book's text: the photo's copy is the one it was opened from.
    expect(encrypt).toHaveBeenCalledTimes(1)
    expect(again.blobs?.[0]).toBe(first.blobs?.[0])
  })
})
