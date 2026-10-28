import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gardenRepository } from '../repository/gardenRepository'
import { fakeFile, installSavePicker, recordInMemory } from '../test/fileSystemAccess'
import { fileWriteDue } from './autoBackup'
import {
  askToKeepWriting,
  canKeepBackupFile,
  chooseBackupFile,
  forgetBackupFile,
  loadBackupFile,
  noteChange,
  writeBackupFile,
} from './autoBackupFile'

/*
 * The backup file kept up to date, against a stand-in for the File System
 * Access API: choosing the file, writing it, the browser's permission, and
 * what is remembered when a write cannot be made.
 */

const copy = () => ({ text: '{"format":"the-butterfly-garden"}' })

beforeEach(() => {
  // No lock: the garden is open as most are.
  gardenRepository.forget()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 27, 9) })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('choosing the file', () => {
  it('is offered only where the browser has a save screen that hands over a file', () => {
    expect(canKeepBackupFile()).toBe(false)
    installSavePicker(fakeFile())
    expect(canKeepBackupFile()).toBe(true)
  })

  it('keeps the file chosen on the browser’s save screen, and nothing when it is closed', async () => {
    const kept = recordInMemory()
    const file = fakeFile()
    installSavePicker(file, true)
    expect(await chooseBackupFile()).toBe('cancelled')
    expect(kept.record).toBeUndefined()

    const picker = installSavePicker(file)
    expect(await chooseBackupFile()).toBe('chosen')
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'butterfly-garden-backup.json' }),
    )
    expect(kept.record).toEqual({ handle: file.handle })
  })

  it('says when the save screen would not open', async () => {
    recordInMemory()
    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(new DOMException('no', 'SecurityError')))
    await expect(chooseBackupFile()).rejects.toThrow()
    vi.unstubAllGlobals()
    expect(await chooseBackupFile()).toBe('cancelled')
  })
})

describe('writing the file', () => {
  it('writes the plain backup, and remembers when the copy was made', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle })
    const result = await writeBackupFile(copy)
    expect(result.outcome).toBe('written')
    expect(file.contents).toBe(copy().text)
    expect(kept.record).toEqual({ handle: file.handle, writtenAt: result.madeAt!.toISOString() })
  })

  it('writes only when due, and marks a change once', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 27, 8).toISOString() })
    const due = (moment: 'daily' | 'hidden') => (record: Parameters<typeof fileWriteDue>[0]) =>
      fileWriteDue(record, moment, new Date())
    expect((await writeBackupFile(copy, due('hidden'))).outcome).toBe('not-due')

    await noteChange()
    const changedAt = kept.record?.changedAt
    expect(changedAt).toBe(new Date(2026, 9, 27, 9).toISOString())
    vi.setSystemTime(new Date(2026, 9, 27, 9, 30))
    await noteChange()
    expect(kept.record?.changedAt).toBe(changedAt)

    // Today's change waits for the page to be hidden, or for tomorrow.
    expect((await writeBackupFile(copy, due('daily'))).outcome).toBe('not-due')
    expect((await writeBackupFile(copy, due('hidden'))).outcome).toBe('written')
    expect(file.writes).toBe(1)
    expect(kept.record?.changedAt).toBeUndefined()
  })

  it('keeps a change noted while it was writing, if it came after the copy', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 26).toISOString() })
    file.duringWrite = () => {
      vi.setSystemTime(new Date(2026, 9, 27, 9, 1))
      kept.record = { ...kept.record!, changedAt: new Date().toISOString() }
    }
    await writeBackupFile(copy)
    expect(kept.record?.changedAt).toBe(new Date(2026, 9, 27, 9, 1).toISOString())
  })

  it('writes nothing and remembers nothing when there is no file', async () => {
    const kept = recordInMemory()
    expect((await writeBackupFile(copy)).outcome).toBe('not-due')
    await noteChange()
    expect(kept.record).toBeUndefined()
  })

  it('writes nothing while the garden cannot be copied (saving paused)', async () => {
    const file = fakeFile()
    recordInMemory({ handle: file.handle })
    expect((await writeBackupFile(() => undefined)).outcome).toBe('paused')
    expect(file.writes).toBe(0)
  })

  it('records what the copy had to leave out', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle })
    await writeBackupFile(() => Promise.resolve({ text: '{}', leftOut: 'One photo was left out.' }))
    expect(kept.record?.leftOut).toBe('One photo was left out.')
  })

  it('stops writing once turned off, and forgets the file', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle })
    await forgetBackupFile()
    expect(kept.record).toBeUndefined()
    expect(await loadBackupFile()).toBeUndefined()
    expect((await writeBackupFile(copy)).outcome).toBe('not-due')
    expect(file.writes).toBe(0)
  })

  it('waits for another tab’s write through the browser’s lock', async () => {
    const file = fakeFile()
    recordInMemory({ handle: file.handle })
    const request = vi.fn((_name: string, optionsOrWork: unknown, work?: () => Promise<unknown>): Promise<unknown> =>
      (work ?? optionsOrWork as () => Promise<unknown>)())
    vi.stubGlobal('navigator', { ...navigator, locks: { request } })
    expect((await writeBackupFile(copy)).outcome).toBe('written')
    expect(request).toHaveBeenCalledWith('the-butterfly-garden-backup-file', expect.any(Function))
    expect(request).toHaveBeenCalledWith('butterfly-garden-switch', { mode: 'shared' }, expect.any(Function))
  })
})

describe('the browser’s permission', () => {
  it('is asked about before a write, and never asked for without a tap', async () => {
    const file = fakeFile()
    file.permission = 'prompt'
    const kept = recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 26).toISOString() })
    const result = await writeBackupFile(copy)
    expect(result.outcome).toBe('permission')
    expect(file.requested).toBe(0)
    expect(file.writes).toBe(0)
    expect(kept.record?.problem).toEqual({ kind: 'permission', at: new Date().toISOString() })

    // The same problem again is not stored again: the first time is said.
    vi.setSystemTime(new Date(2026, 9, 27, 10))
    await writeBackupFile(copy)
    expect(kept.record?.problem?.at).toBe(new Date(2026, 9, 27, 9).toISOString())
  })

  it('is asked for on a tap, and the file written once given', async () => {
    const file = fakeFile()
    file.permission = 'prompt'
    const kept = recordInMemory({
      handle: file.handle,
      problem: { kind: 'permission', at: new Date().toISOString() },
    })
    await loadBackupFile()
    const result = await askToKeepWriting(copy)
    expect(file.requested).toBe(1)
    expect(result.outcome).toBe('written')
    expect(kept.record?.problem).toBeUndefined()
  })

  it('says so when it is refused on that tap', async () => {
    const file = fakeFile()
    file.permission = 'prompt'
    file.answer = 'denied'
    recordInMemory({ handle: file.handle })
    await loadBackupFile()
    expect((await askToKeepWriting(copy)).outcome).toBe('permission')
    expect(file.writes).toBe(0)
  })

  it('cannot be asked for when there is no file', async () => {
    recordInMemory()
    await loadBackupFile()
    expect((await askToKeepWriting(copy)).outcome).toBe('not-due')
  })

  it('is lost when the browser refuses the write itself', async () => {
    const file = fakeFile()
    file.failure = new DOMException('No longer allowed.', 'NotAllowedError')
    const kept = recordInMemory({ handle: file.handle })
    expect((await writeBackupFile(copy)).outcome).toBe('permission')
    expect(kept.record?.problem?.kind).toBe('permission')
  })
})

describe('when the file cannot be written', () => {
  it('remembers a file moved or deleted, and a disk that is full', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle })
    file.failure = new DOMException('Gone.', 'NotFoundError')
    expect((await writeBackupFile(copy)).outcome).toBe('missing')
    expect(kept.record?.problem?.kind).toBe('missing')
    file.failure = new DOMException('Full.', 'QuotaExceededError')
    expect((await writeBackupFile(copy)).outcome).toBe('full')
    expect(kept.record?.problem?.kind).toBe('full')
    // Room made: the next write puts it right.
    file.failure = undefined
    expect((await writeBackupFile(copy)).outcome).toBe('written')
    expect(kept.record?.problem).toBeUndefined()
  })

  it('leaves the file as it was when a write fails part-way', async () => {
    const file = fakeFile()
    recordInMemory({ handle: file.handle })
    file.contents = 'the copy before'
    file.duringWrite = () => {
      throw new DOMException('Full.', 'QuotaExceededError')
    }
    expect((await writeBackupFile(copy)).outcome).toBe('full')
    expect(file.contents).toBe('the copy before')
    expect(file.aborted).toBe(1)
  })
})

describe('the garden lock', () => {
  it('abandons a write when saving pauses or the chosen file is forgotten during it', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle })
    file.contents = 'previous copy'
    let allowed = true
    file.duringWrite = () => { allowed = false }
    expect((await writeBackupFile(copy, undefined, () => allowed)).outcome).toBe('paused')
    expect(file.contents).toBe('previous copy')
    allowed = true
    file.duringWrite = () => { kept.record = undefined }
    expect((await writeBackupFile(copy)).outcome).toBe('paused')
    expect(file.contents).toBe('previous copy')
  })
  it('pauses the file: nothing is written while it is on', async () => {
    const file = fakeFile()
    recordInMemory({ handle: file.handle })
    gardenRepository.unlock({} as CryptoKey, 'lock-1')
    const make = vi.fn(copy)
    expect((await writeBackupFile(make)).outcome).toBe('paused')
    expect(make).not.toHaveBeenCalled()
    expect(file.writes).toBe(0)
  })

  it('stops a write the lock went on during, before the plain copy lands', async () => {
    const file = fakeFile()
    recordInMemory({ handle: file.handle })
    file.contents = 'the copy before'
    file.duringWrite = () => gardenRepository.unlock({} as CryptoKey, 'lock-1')
    expect((await writeBackupFile(copy)).outcome).toBe('paused')
    expect(file.contents).toBe('the copy before')
    expect(file.aborted).toBe(1)
  })
})
