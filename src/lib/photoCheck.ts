/*
 * Whether this browser will keep a sighting's photo (plan 5.2), asked of a
 * database of its own before the photo goes anywhere near the garden's.
 *
 * A photo is kept as a Blob. Safari's Private Browsing keeps none in
 * IndexedDB, and nor do WebKit's test contexts, which are private alike: the
 * write is taken, then refused ("Error preparing Blob/File data to be stored
 * in object store"). In the garden's own database that refusal did not stay
 * with the photo. Once the photo was taken back out (hooks/usePersistence),
 * the writes after it still did not land, and the garden went on saying that
 * a change could not be saved, with every later change only in the tab (CI's
 * browsers run, e2e/nature.spec.ts in WebKit). Asked here first, a photo this
 * browser will not keep never reaches the garden's database: the sighting is
 * kept without it (lib/sightings), and the field book says so
 * (PHOTO_NOT_KEPT).
 *
 * Loaded with the sighting form, never with the garden's first load.
 */

/** A database the check has to itself, emptied and deleted once it has answered. */
const CHECK_DATABASE = 'butterfly-garden-photo-check'

/** Photos this browser refused, which the field book leaves out. */
const refused = new WeakSet<Blob>()

/** Whether `photo` was tried (checkPhoto) and refused. */
export function isRefusedPhoto(photo: Blob): boolean {
  return refused.has(photo)
}

/**
 * Try `photo` in a database of its own, and take it straight back out: false
 * only when it was taken and then refused, which is the refusal that holds a
 * garden's write up. Anything else is answered yes, and the garden's own
 * write says what happens, as it always has: no answer within `timeoutMs`, a
 * storage that will not open, or a photo it cannot even take (that fails at
 * once, holding nothing up).
 */
export function checkPhoto(photo: Blob, timeoutMs = 4_000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let answered = false
    const answer = (kept: boolean) => {
      if (answered) return
      answered = true
      window.clearTimeout(timer)
      if (!kept) refused.add(photo)
      resolve(kept)
    }
    const timer = window.setTimeout(() => answer(true), timeoutMs)
    let opening: IDBOpenDBRequest
    try {
      opening = indexedDB.open(CHECK_DATABASE, 1)
    } catch {
      answer(true)
      return
    }
    opening.onupgradeneeded = () => opening.result.createObjectStore('photo')
    opening.onerror = () => answer(true)
    opening.onsuccess = () => {
      const db = opening.result
      const done = (kept: boolean) => {
        answer(kept)
        db.close()
        try {
          indexedDB.deleteDatabase(CHECK_DATABASE)
        } catch {
          // Left for the next check to open and empty again.
        }
      }
      try {
        const tx = db.transaction('photo', 'readwrite')
        const put = tx.objectStore('photo').put(photo, 'photo')
        put.onsuccess = () => {
          // It went in: out again, so nothing is kept here.
          tx.abort()
          done(true)
        }
        put.onerror = () => done(false)
      } catch {
        done(true)
      }
    }
  })
}
