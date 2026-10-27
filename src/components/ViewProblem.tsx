import { useState } from 'react'
import { datedFileName, saveTextFile } from '../lib/download'
import { storedCopy } from '../lib/storedCopy'

/**
 * Shown in place of a single page that failed to draw.
 *
 * The rest of the app keeps working: the navigation stays, and the garden is
 * one tap away. A copy of everything stored is offered in case the problem is
 * in the data rather than the page.
 */
export function ViewProblem({ onHome }: { onHome: () => void }) {
  const [note, setNote] = useState<string>()

  const download = async () => {
    setNote(undefined)
    try {
      const outcome = await saveTextFile(
        datedFileName('everything-stored'),
        'application/json',
        await storedCopy(),
      )
      setNote(
        outcome === 'cancelled'
          ? 'Nothing was saved.'
          : 'Keep that file: it holds everything this app has stored.',
      )
    } catch {
      setNote('What is stored could not be read just now.')
    }
  }

  return (
    <section className="card view-problem" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1>This page could not be shown</h1>
      <p>
        The rest of your garden is fine and nothing has been deleted. You can go
        back to the garden, or keep a copy of everything stored first.
      </p>
      <div className="form-actions">
        <button className="primary-button" onClick={onHome}>
          Back to the garden
        </button>
        <button className="text-button" onClick={() => void download()}>
          Download what's stored
        </button>
      </div>
      {note && <p className="settings-note">{note}</p>}
    </section>
  )
}
