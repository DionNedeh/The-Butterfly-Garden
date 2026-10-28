import { describe, expect, it } from 'vitest'
import { createInitialState } from './progression'
import { markQuietWrite } from './quietWrites'
import {
  backupFileStatus,
  changedForTheFile,
  fileWriteDue,
  hasChangesToWrite,
  HIDDEN_WRITE_GAP_MS,
  isBackupFileRecord,
  problemOf,
  writtenWhen,
  type BackupFileHandle,
  type BackupFileRecord,
} from './autoBackup'

const handle = { kind: 'file', name: 'garden.json', createWritable: () => undefined } as unknown as BackupFileHandle

/** Local times on 27 October 2026. */
function at(hour: number, minute = 0, day = 27): Date {
  return new Date(2026, 9, day, hour, minute)
}

function record(fields: Partial<BackupFileRecord> = {}): BackupFileRecord {
  return { handle, ...fields }
}

describe('when the file is due a write', () => {
  it('is always due before it has been written at all', () => {
    expect(fileWriteDue(record(), 'daily', at(9))).toBe(true)
    expect(fileWriteDue(record(), 'hidden', at(9))).toBe(true)
  })

  it('is never due without a change since the last write', () => {
    const written = record({ writtenAt: at(8).toISOString() })
    expect(hasChangesToWrite(written)).toBe(false)
    expect(fileWriteDue(written, 'daily', at(9, 0, 28))).toBe(false)
    expect(fileWriteDue(written, 'hidden', at(23))).toBe(false)
    // A change from before the copy was made is in it.
    const older = record({ writtenAt: at(8).toISOString(), changedAt: at(7).toISOString() })
    expect(hasChangesToWrite(older)).toBe(false)
  })

  it('writes an earlier day’s changes on a later day, and today’s only as the page is hidden', () => {
    const changed = record({ writtenAt: at(8).toISOString(), changedAt: at(10).toISOString() })
    expect(fileWriteDue(changed, 'daily', at(22))).toBe(false)
    expect(fileWriteDue(changed, 'daily', at(0, 5, 28))).toBe(true)
    expect(fileWriteDue(changed, 'hidden', at(10, 30))).toBe(true)
  })

  it('writes on hiding at most every few minutes', () => {
    const justWritten = record({
      writtenAt: at(10).toISOString(),
      changedAt: at(10, 2).toISOString(),
    })
    expect(fileWriteDue(justWritten, 'hidden', at(10, 5))).toBe(false)
    expect(
      fileWriteDue(justWritten, 'hidden', new Date(at(10).getTime() + HIDDEN_WRITE_GAP_MS)),
    ).toBe(true)
    // A clock set back is no reason to wait.
    expect(fileWriteDue(justWritten, 'hidden', at(9))).toBe(true)
  })
})

describe('what a failed write means', () => {
  it('names the browser’s refusals plainly', () => {
    expect(problemOf(new DOMException('no', 'NotAllowedError'))).toBe('permission')
    expect(problemOf(new DOMException('no', 'SecurityError'))).toBe('permission')
    expect(problemOf(new DOMException('gone', 'NotFoundError'))).toBe('missing')
    expect(problemOf(new DOMException('a folder', 'TypeMismatchError'))).toBe('missing')
    expect(problemOf(new DOMException('full', 'QuotaExceededError'))).toBe('full')
    expect(problemOf(new Error('odd'))).toBe('other')
    expect(problemOf(undefined)).toBe('other')
  })
})

describe('which changes the file should have', () => {
  const garden = createInitialState('Robin', 'Quiet Corner')

  it('counts the gardener’s changes, and not the app’s own notes', () => {
    expect(changedForTheFile(garden, garden)).toBe(false)
    expect(changedForTheFile(garden, { ...garden, seeds: garden.seeds + 1 })).toBe(true)
    expect(changedForTheFile(garden, { ...garden, moods: [] })).toBe(true)
    expect(
      changedForTheFile(garden, { ...garden, profile: { ...garden.profile!, name: 'Wren' } }),
    ).toBe(true)
    // The backup recorded, which writing the file does.
    expect(
      changedForTheFile(garden, {
        ...garden,
        profile: { ...garden.profile!, lastBackupAt: '2026-10-27T09:00:00.000Z' },
      }),
    ).toBe(false)
    // A visit noted, made quietly.
    expect(
      changedForTheFile(
        garden,
        markQuietWrite({ ...garden, profile: { ...garden.profile!, lastVisitOn: '2026-10-27' } }),
      ),
    ).toBe(false)
    // A garden made, or one let go.
    expect(changedForTheFile({ ...garden, profile: undefined }, garden)).toBe(true)
  })
})

describe('the record kept for the file', () => {
  it('is one this build can write through only with a handle that writes', () => {
    expect(isBackupFileRecord(record())).toBe(true)
    expect(isBackupFileRecord({ handle: {} })).toBe(false)
    expect(isBackupFileRecord({ handle: { name: 'x' } })).toBe(false)
    expect(isBackupFileRecord(undefined)).toBe(false)
    expect(isBackupFileRecord('sealed')).toBe(false)
  })
})

describe('where the file stands, in words', () => {
  const now = at(15)

  it('says when it was last written', () => {
    expect(writtenWhen(at(14, 5).toISOString(), now)).toMatch(/^today at 2:05/i)
    expect(writtenWhen(at(21, 10, 26).toISOString(), now)).toMatch(/^yesterday at 9:10/i)
    expect(writtenWhen(at(9, 0, 20).toISOString(), now)).toMatch(/^on .*October 20/)
    expect(writtenWhen('not a time', now)).toBe('at a time this device could not read')
    expect(backupFileStatus(record({ writtenAt: at(14, 5).toISOString() }), now)).toMatch(
      /^garden\.json was last written today at 2:05/i,
    )
    expect(backupFileStatus(record(), now)).toBe('garden.json is written as soon as it can be.')
  })

  it('says when it could not be written, and why', () => {
    const written = at(9).toISOString()
    const lost = record({ writtenAt: written, problem: { kind: 'permission', at: at(14).toISOString() } })
    expect(backupFileStatus(lost, now)).toMatch(
      /^garden\.json could not be written today at 2:00.*: this browser needs your permission again\. It was last written today at 9:00/i,
    )
    expect(
      backupFileStatus(record({ problem: { kind: 'missing', at: at(14).toISOString() } }), now),
    ).toMatch(/it was moved, renamed or deleted\.$/)
    expect(
      backupFileStatus(record({ writtenAt: written, problem: { kind: 'full', at: at(14).toISOString() } }), now),
    ).toMatch(/no room left on the disk\. It will be tried again\./)
    expect(
      backupFileStatus(record({ problem: { kind: 'other', at: at(14).toISOString() } }), now),
    ).toMatch(/something went wrong\. It will be tried again\.$/)
    // A problem since put right by a write is not mentioned.
    expect(
      backupFileStatus(
        record({ writtenAt: at(14, 30).toISOString(), problem: { kind: 'full', at: at(14).toISOString() } }),
        now,
      ),
    ).toMatch(/^garden\.json was last written today/)
  })

  it('says what the last copy had to leave out', () => {
    expect(
      backupFileStatus(
        record({ writtenAt: at(14).toISOString(), leftOut: 'One photo could not be read, so it was left out.' }),
        now,
      ),
    ).toMatch(/One photo could not be read, so it was left out\.$/)
  })
})
