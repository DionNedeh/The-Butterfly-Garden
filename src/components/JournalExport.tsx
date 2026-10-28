import { useId, useState } from 'react'
import { datedFileName, saveTextFile, type SaveOutcome } from '../lib/download'
import type { AppState } from '../types'

type ExportFormat = 'markdown' | 'html' | 'csv'

/** The file builders, loaded with the first copy asked for and not before. */
type Builders = typeof import('../lib/journalExport')

interface FormatDefinition {
  label: string
  /** The middle of the file name: `butterfly-garden-<what>-2026-10-27.<extension>`. */
  what: 'journal' | 'check-ins'
  extension: 'md' | 'html' | 'csv'
  mimeType: string
  text: (build: Builders, state: AppState, now: Date) => string
}

const FORMATS: Readonly<Record<ExportFormat, FormatDefinition>> = {
  markdown: {
    label: 'Journal as Markdown',
    what: 'journal',
    extension: 'md',
    mimeType: 'text/markdown',
    text: (build, state, now) => build.journalMarkdown(state, now),
  },
  html: {
    label: 'Printable journal (HTML)',
    what: 'journal',
    extension: 'html',
    mimeType: 'text/html',
    text: (build, state, now) => build.journalHtml(state, now),
  },
  csv: {
    label: 'Check-ins as CSV',
    what: 'check-ins',
    extension: 'csv',
    mimeType: 'text/csv',
    text: (build, state) => build.checkInsCsv(state),
  },
}

/**
 * Only what each outcome lets the app know. Android reports a file written;
 * a browser only lets us see that a download began, so it is never called
 * saved (see SaveOutcome).
 */
const OUTCOME_NOTES: Readonly<Record<SaveOutcome, string>> = {
  saved: 'Saved.',
  started: 'Your download has started.',
  cancelled: 'Nothing was saved.',
}

/**
 * "Take your words with you": the journal as Markdown or a printable page,
 * and the check-ins as a spreadsheet.
 *
 * Each file is built only when its button is pressed, never while the
 * Journal renders, and the code that builds it is loaded then too, so years
 * of entries cost nothing until a copy is asked for. These copies are for reading; restoring a garden is the backup's job.
 */
export function JournalExport({ state }: { state: AppState }) {
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState('')

  const hasCheckIns = state.moods.length > 0
  const isEmpty = !hasCheckIns && state.reflections.length === 0 && state.recaps.length === 0
  // A spreadsheet of no check-ins would be a header row and nothing else.
  const formats: readonly ExportFormat[] = hasCheckIns
    ? ['markdown', 'html', 'csv']
    : ['markdown', 'html']

  const save = async (format: ExportFormat) => {
    // The buttons stay pressable while a save is open (see below), so a
    // second press arrives here and is turned away.
    if (saving) return
    const { what, extension, mimeType, text } = FORMATS[format]
    setSaving(true)
    // Cleared first, so the same outcome twice is still announced twice.
    setNote('')
    setProblem('')
    try {
      const build = await import('../lib/journalExport')
      // One moment for the file's name and the date written inside it.
      const now = new Date()
      const outcome = await saveTextFile(
        datedFileName(what, extension, now),
        mimeType,
        text(build, state, now),
      )
      setNote(OUTCOME_NOTES[outcome])
    } catch {
      setProblem(
        'That file could not be saved. Nothing in your journal has changed, so you can try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card journal-export" aria-labelledby={titleId}>
      <p className="eyebrow">Readable copies</p>
      <h2 id={titleId}>Take your words with you</h2>
      {isEmpty ? (
        <p className="empty-copy">
          There is nothing in your journal yet. Once you check in, reflect or round out a day, you
          can download it here to read, print or keep.
        </p>
      ) : (
        <>
          <p className="journal-export-intro">
            Markdown opens in most notes apps, the printable page in any browser, and the CSV in a
            spreadsheet. Anyone who opens these files can read them, so keep them somewhere
            private. They are for reading, not restoring: the backup in Settings does that.
          </p>
          <div className="journal-export-actions">
            {formats.map((format) => (
              // aria-disabled rather than disabled: a focused button that
              // becomes disabled drops keyboard focus, which would send the
              // gardener back to the top of the page after every press.
              <button
                key={format}
                type="button"
                className="secondary-button"
                aria-disabled={saving ? true : undefined}
                onClick={() => void save(format)}
              >
                {FORMATS[format].label}
              </button>
            ))}
          </div>
          {!hasCheckIns && (
            <p className="settings-note">
              Your check-ins can be downloaded as a spreadsheet once you have made one.
            </p>
          )}
          <p className="settings-note" role="status">
            {note}
          </p>
          {problem && (
            <p className="settings-note error" role="alert">
              {problem}
            </p>
          )}
        </>
      )}
    </section>
  )
}
