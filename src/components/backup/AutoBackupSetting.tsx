import { useEffect, useRef, useState } from 'react'
import { useLockState } from '../../hooks/useLockState'
import { backupFileStatus, type BackupFileRecord } from '../../lib/autoBackup'
import {
  askToKeepWriting,
  chooseBackupFile,
  forgetBackupFile,
  loadBackupFile,
  useBackupFile,
  writeBackupFile,
  type WriteResult,
} from '../../lib/autoBackupFile'
import type { FileCopy } from '../../lib/sightingPhotos'
import './keep.css'

/** Said whenever the lock is on: the file would hold the journal in the clear. */
const PAUSED_WHILE_LOCKED =
  'Automatic backups pause while your garden is locked, because the file would not be.'

/**
 * Settings → Backup and restore → a backup file kept up to date, where the
 * browser can keep a file (lib/autoBackupFile): choose it, see when it was
 * last written and when it could not be, give the browser's permission again
 * with a tap, or stop. Writing it from then on is AutoBackupKeeper's.
 */
export function AutoBackupSetting({
  readOnly,
  onExportGarden,
  onBackupMade,
}: {
  readOnly: boolean
  onExportGarden: () => FileCopy | undefined | Promise<FileCopy | undefined>
  /** A copy reached the file at the gardener's tap: a backup kept. */
  onBackupMade?: (madeAt: Date) => void
}) {
  const { record, loaded } = useBackupFile()
  const locked = useLockState() !== 'none'
  /** The browser's answer about writing the file, for the record it was asked of. */
  const [permission, setPermission] = useState<{ of: BackupFileRecord; answer: PermissionState }>()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  /** When "today" is, for the words: set as the page opens and after each write here. */
  const [now, setNow] = useState(() => new Date())
  const heading = useRef<HTMLHeadingElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const choose = useRef<HTMLButtonElement>(null)
  /** Where focus goes once the control that held it has gone. */
  const focusNext = useRef<'status' | 'choose'>(undefined)

  useEffect(() => {
    void loadBackupFile()
  }, [])

  useEffect(() => {
    if (!record) return
    let active = true
    record.handle.queryPermission({ mode: 'readwrite' }).then(
      (answer) => {
        if (active) setPermission({ of: record, answer })
      },
      () => {
        if (active) setPermission({ of: record, answer: 'prompt' })
      },
    )
    return () => {
      active = false
    }
  }, [record])

  useEffect(() => {
    const wanted = focusNext.current
    const target =
      wanted === 'status' ? status.current : wanted === 'choose' ? (choose.current ?? heading.current) : null
    if (!target) return
    focusNext.current = undefined
    target.focus()
  })

  const run = async (work: () => Promise<WriteResult>) => {
    setBusy(true)
    setNote('')
    let result: WriteResult
    try {
      result = await work()
    } catch {
      result = { outcome: 'other' }
    }
    if (result.outcome === 'written' && result.madeAt) onBackupMade?.(result.madeAt)
    if (result.outcome === 'permission')
      setNote('The browser did not give permission, so the file was not written.')
    else if (result.outcome === 'paused' && !locked)
      setNote('Saving is paused, so the file was not written.')
    setNow(new Date())
    setBusy(false)
    focusNext.current = 'status'
  }

  const chooseFile = async () => {
    if (busy) return
    setNote('')
    let chosen: 'chosen' | 'cancelled'
    try {
      chosen = await chooseBackupFile()
    } catch {
      setNote('This browser would not open its save screen.')
      return
    }
    if (chosen === 'cancelled') return
    // The button goes as the file is chosen: its status takes the focus.
    focusNext.current = 'status'
    await run(() => writeBackupFile(onExportGarden))
  }

  const stop = async () => {
    const name = record?.handle.name ?? 'The file'
    try {
      await forgetBackupFile()
      setNote(`${name} stays as it was last written, and is no longer updated.`)
    } catch {
      setNote('The file could not be forgotten just now. Please try again.')
    }
    focusNext.current = 'choose'
  }

  const problem =
    record?.problem && (!record.writtenAt || record.problem.at > record.writtenAt)
      ? record.problem.kind
      : undefined
  // Asked only on a tap: the browser's answer when it has one, the record's when not.
  const needsPermission =
    record &&
    (permission?.of === record ? permission.answer !== 'granted' : problem === 'permission')
  const canAct = !locked && !readOnly

  return (
    <div className="auto-backup">
      <h3 ref={heading} tabIndex={-1}>
        Keep a backup file up to date
      </h3>
      {record ? (
        <p className="settings-note" ref={status} tabIndex={-1}>
          {backupFileStatus(record, now)}
        </p>
      ) : (
        <p className="subtle-copy">
          Choose a file once, and the garden writes a fresh backup to it after each
          day’s changes and as you leave. It writes only while the garden is open in
          this browser.
        </p>
      )}
      {locked && <p className="settings-note">{PAUSED_WHILE_LOCKED}</p>}
      {loaded && (
        <div className="form-actions">
          {!record && !locked && (
            <button
              ref={choose}
              className="secondary-button"
              disabled={readOnly}
              aria-disabled={busy || undefined}
              onClick={() => void chooseFile()}
            >
              Choose a backup file…
            </button>
          )}
          {needsPermission && canAct && (
            <button
              className="secondary-button"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) void run(() => askToKeepWriting(onExportGarden))
              }}
            >
              Keep updating my backup file
            </button>
          )}
          {problem === 'missing' && canAct && (
            <button
              className="secondary-button"
              aria-disabled={busy || undefined}
              onClick={() => void chooseFile()}
            >
              Choose the file again…
            </button>
          )}
          {record && (
            <button className="text-button" onClick={() => void stop()}>
              Stop updating this file
            </button>
          )}
        </div>
      )}
      <p className="settings-note" role="status">
        {note}
      </p>
    </div>
  )
}
