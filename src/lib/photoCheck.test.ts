import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkPhoto, isRefusedPhoto } from './photoCheck'

/** A photo as a browser's IndexedDB copies it (src/test/node-buffer.d.ts). */
const photo = () => new NodeBlob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })

/** Whether the check left its database behind. */
async function leftBehind() {
  return (await indexedDB.databases()).some((db) => db.name === 'butterfly-garden-photo-check')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('5.2 a photo is tried before the garden keeps it', () => {
  it('answers yes for a photo this browser keeps, and leaves nothing behind', async () => {
    const kept = photo()
    await expect(checkPhoto(kept)).resolves.toBe(true)
    expect(isRefusedPhoto(kept)).toBe(false)
    await vi.waitFor(async () => expect(await leftBehind()).toBe(false))
  })

  it('answers no for a photo taken and then refused, as Safari’s Private Browsing does', async () => {
    // A fake IndexedDB that refuses Blobs: the write is taken, and fails after.
    const put = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, 'put')?.value as (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) => IDBRequest<IDBValidKey>
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (!(value instanceof NodeBlob)) return put.call(this, value, key)
      put.call(this, 0, key)
      return this.add(0, key)
    })
    const refused = photo()
    await expect(checkPhoto(refused)).resolves.toBe(false)
    expect(isRefusedPhoto(refused)).toBe(true)
    // Only the photo tried is marked.
    expect(isRefusedPhoto(photo())).toBe(false)
  })

  it('takes no answer as yes, so a slow device keeps its photo as before', async () => {
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => ({}) as IDBRequest<IDBValidKey>)
    const slow = photo()
    await expect(checkPhoto(slow, 20)).resolves.toBe(true)
    expect(isRefusedPhoto(slow)).toBe(false)
  })

  it('leaves to the garden’s own write a photo the storage cannot take at all, or a storage that will not open', async () => {
    // jsdom's own Blob, which fake-indexeddb cannot copy: the put throws at once.
    const uncopied = new Blob([new Uint8Array([1])], { type: 'image/webp' })
    await expect(checkPhoto(uncopied)).resolves.toBe(true)
    expect(isRefusedPhoto(uncopied)).toBe(false)
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('No storage here.')
    })
    await expect(checkPhoto(photo())).resolves.toBe(true)
  })
})
