import { vi } from 'vitest'
import type { BackupFileHandle, BackupFileRecord } from '../lib/autoBackup'
import { gardenRepository } from '../repository/gardenRepository'

/**
 * A file the File System Access API hands over, for tests: what it holds
 * once a write is closed, how often it was written, and the browser's
 * permission, which a test can take away or make a write fail.
 */
export interface FakeFile {
  handle: BackupFileHandle
  /** The text last written and closed; a write left unclosed is not here. */
  contents?: string
  /** Writes closed. */
  writes: number
  /** Writes begun and then aborted. */
  aborted: number
  /** What queryPermission answers, and requestPermission until it is changed. */
  permission: PermissionState
  /** What requestPermission answers when asked. */
  answer: PermissionState
  /** Times the page asked the browser for permission. */
  requested: number
  /** Thrown by createWritable when set: a file moved, a disk full. */
  failure?: DOMException
  /** Run while a write is open, before it is closed. */
  duringWrite?: () => void
}

export function fakeFile(name = 'garden-backup.json'): FakeFile {
  const file: FakeFile = {
    writes: 0,
    aborted: 0,
    permission: 'granted',
    answer: 'granted',
    requested: 0,
    handle: undefined as unknown as BackupFileHandle,
  }
  file.handle = {
    kind: 'file',
    name,
    queryPermission: () => Promise.resolve(file.permission),
    requestPermission: () => {
      file.requested += 1
      file.permission = file.answer
      return Promise.resolve(file.answer)
    },
    createWritable: () => {
      if (file.failure) return Promise.reject(file.failure)
      let pending = ''
      return Promise.resolve({
        write: (data: string) => {
          pending += data
          file.duringWrite?.()
          return Promise.resolve()
        },
        close: () => {
          file.contents = pending
          file.writes += 1
          return Promise.resolve()
        },
        abort: () => {
          file.aborted += 1
          return Promise.resolve()
        },
      })
    },
  }
  return file
}

/**
 * The browser's save screen, choosing `file` (or closed, with `cancel`).
 * Returns the mock, to see how it was called.
 */
export function installSavePicker(file: FakeFile, cancel = false) {
  const picker = vi.fn(() =>
    cancel
      ? Promise.reject(new DOMException('The user aborted a request.', 'AbortError'))
      : Promise.resolve(file.handle),
  )
  vi.stubGlobal('showSaveFilePicker', picker)
  return picker
}

/**
 * The record of the file kept in memory rather than IndexedDB: a stand-in
 * handle's functions cannot be stored there, as a browser's real handle can.
 * Returns where it is kept.
 */
export function recordInMemory(initial?: BackupFileRecord) {
  const kept: { record?: BackupFileRecord } = { record: initial }
  vi.spyOn(gardenRepository, 'readBackupFile').mockImplementation(() =>
    Promise.resolve(kept.record),
  )
  vi.spyOn(gardenRepository, 'writeBackupFile').mockImplementation((record) => {
    kept.record = record
    return Promise.resolve()
  })
  return kept
}
