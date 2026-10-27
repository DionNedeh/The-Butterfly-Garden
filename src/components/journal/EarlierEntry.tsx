import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { moodLevels } from '../../data/content'
import { addDaysToLocalDate, formatJournalDate } from '../../lib/date'
import { clearDraft, useDraft } from '../../lib/drafts'
import {
  earlierDayProblem,
  gardenStartDate,
  type EarlierDayProblem,
  type EarlierEntryKind,
} from '../../lib/earlierDay'
import { UNSURE_MOOD_NAME } from '../../lib/mood'
import type { AppState, MoodChoice } from '../../types'

/**
 * Drafts, so a reflection half-written for a missed day survives a reload
 * like any other (lib/drafts.ts). The day is a draft too, so the words are
 * never kept apart from the day they were meant for.
 */
const DATE_KEY = 'earlier-entry:date'
const NOTE_KEY = 'earlier-entry:note'
const BODY_KEY = 'earlier-entry:body'

function problemText(problem: EarlierDayProblem, date: string, start: string, kind: EarlierEntryKind) {
  switch (problem) {
    case 'not-a-day':
      return 'Choose a day from the calendar.'
    case 'not-yet-past':
      return 'Today has a page of its own. Choose a day before today.'
    case 'before-garden':
      return `Your garden began on ${formatJournalDate(start)}. Choose that day or a later one.`
    case 'already-written':
      return `${formatJournalDate(date)} already has a ${kind}. The journal keeps one each day.`
  }
}

/**
 * "Add an entry for an earlier day": a check-in or a reflection for a day
 * that has passed, kept with that day and marked as written later.
 *
 * Only days from the garden's first to yesterday can be chosen, and the
 * reducer checks the same again. It earns no Sunlight, which the form says
 * plainly: the care happened today, and the rhythm counts the days it
 * happens on.
 */
export function EarlierEntry({
  state,
  today,
  onAddMood,
  onAddReflection,
  onOpenDay,
}: {
  state: Pick<AppState, 'profile' | 'moods' | 'reflections'>
  /** The current local date, kept fresh across midnight by the caller. */
  today: string
  onAddMood: (localDate: string, choice: MoodChoice, note: string) => void
  onAddReflection: (localDate: string, body: string) => void
  /** Show a day in the timeline and give it focus. */
  onOpenDay: (localDate: string) => void
}) {
  const titleId = useId()
  const problemId = useId()
  const hintId = useId()
  const kindName = useId()
  const [date, setDate] = useDraft(DATE_KEY, '')
  const [note, setNote] = useDraft(NOTE_KEY, '')
  const [body, setBody] = useDraft(BODY_KEY, '')
  const [kind, setKind] = useState<EarlierEntryKind>(() =>
    body !== '' && note === '' ? 'reflection' : 'check-in',
  )
  // Nothing is chosen until the gardener chooses, as on Today.
  const [weather, setWeather] = useState<MoodChoice>()
  const [opened, setOpened] = useState(false)
  // Said once an entry is kept while the form stays open for the other kind.
  const [kept, setKept] = useState('')
  // A day or words left from before a reload keep the form open, so nothing
  // typed is ever hidden behind a button.
  const open = opened || date !== '' || note !== '' || body !== ''

  const openButton = useRef<HTMLButtonElement>(null)
  const dateField = useRef<HTMLInputElement>(null)
  // Where focus goes once the form has opened or closed: the control that
  // was pressed is gone by then, and focus must not fall to the page.
  const focusNext = useRef<'date' | 'open' | undefined>(undefined)
  // An entry just saved, opened in the timeline once the garden holds it.
  const written = useRef<{ date: string; kind: EarlierEntryKind } | undefined>(undefined)

  useEffect(() => {
    const target = focusNext.current
    focusNext.current = undefined
    if (target === 'date') dateField.current?.focus()
    else if (target === 'open') openButton.current?.focus()
  })

  useEffect(() => {
    const saved = written.current
    if (!saved) return
    const entries = saved.kind === 'check-in' ? state.moods : state.reflections
    if (!entries.some((entry) => entry.localDate === saved.date)) return
    written.current = undefined
    onOpenDay(saved.date)
  }, [state.moods, state.reflections, onOpenDay])

  const start = gardenStartDate(state.profile)
  const yesterday = addDaysToLocalDate(today, -1)
  // A garden planted today has no earlier day yet.
  if (start === undefined || start > yesterday) return null

  if (!open) {
    return (
      <div className="earlier-entry-start">
        <button
          ref={openButton}
          type="button"
          className="secondary-button"
          onClick={() => {
            focusNext.current = 'date'
            setOpened(true)
          }}
        >
          Add an entry for an earlier day
        </button>
      </div>
    )
  }

  const problem = date === '' ? undefined : earlierDayProblem(state, date, kind, today)
  const words = kind === 'check-in' ? weather !== undefined : body.trim() !== ''
  const ready = date !== '' && problem === undefined && words
  const hint =
    date === ''
      ? 'Choose a day first.'
      : kind === 'check-in'
        ? 'Choose a weather, or Not sure. Every answer is welcome.'
        : 'A few words are plenty.'

  const close = () => {
    clearDraft(DATE_KEY, NOTE_KEY, BODY_KEY)
    setWeather(undefined)
    setKept('')
    setOpened(false)
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    if (kind === 'check-in' && weather !== undefined) {
      onAddMood(date, weather, note)
      clearDraft(NOTE_KEY)
      setWeather(undefined)
    } else {
      onAddReflection(date, body)
      clearDraft(BODY_KEY)
    }
    // Words still waiting in the other kind stay, with their day, so a
    // check-in and a reflection can be written for the same day in turn;
    // the form says what was kept rather than taking focus away mid-task.
    const otherWords = kind === 'check-in' ? body.trim() !== '' : note.trim() !== ''
    if (otherWords) {
      setKind(kind === 'check-in' ? 'reflection' : 'check-in')
      setKept(`Your ${kind} is kept with ${formatJournalDate(date)}.`)
      return
    }
    // Otherwise the day opens in the timeline once the garden holds it. Its
    // button is back first, so focus never rests on the page meanwhile.
    written.current = { date, kind }
    focusNext.current = 'open'
    close()
  }

  return (
    <form className="card earlier-entry" aria-labelledby={titleId} onSubmit={save} noValidate>
      <h3 id={titleId}>Add an entry for an earlier day</h3>
      <p className="earlier-entry-explainer">
        It joins that day in your journal, marked as written later. Sunlight is
        for what you do on the day itself, so this earns none.
      </p>
      <label>
        Which day?
        <input
          ref={dateField}
          type="date"
          min={start}
          max={yesterday}
          value={date}
          onChange={(event) => {
            setDate(event.target.value)
            setKept('')
          }}
          aria-describedby={problem ? problemId : undefined}
        />
      </label>
      <p className="earlier-entry-kept" role="status">
        {kept}
      </p>
      <div className="earlier-entry-problem" aria-live="polite">
        {problem && (
          <p>
            <span id={problemId}>{problemText(problem, date, start, kind)}</span>
            {problem === 'already-written' && (
              <>
                {' '}
                <button type="button" className="text-button" onClick={() => onOpenDay(date)}>
                  Open that day
                </button>
              </>
            )}
          </p>
        )}
      </div>
      <fieldset className="earlier-entry-kinds">
        <legend>What would you like to add?</legend>
        <label className="earlier-entry-kind">
          <input
            type="radio"
            name={kindName}
            checked={kind === 'check-in'}
            onChange={() => setKind('check-in')}
          />
          A check-in
        </label>
        <label className="earlier-entry-kind">
          <input
            type="radio"
            name={kindName}
            checked={kind === 'reflection'}
            onChange={() => setKind('reflection')}
          />
          A reflection
        </label>
      </fieldset>
      {kind === 'check-in' ? (
        <>
          <label>
            Inner weather that day
            <select
              value={weather ?? ''}
              onChange={(event) => {
                const { value } = event.target
                setWeather(
                  value === '' ? undefined : value === 'unsure' ? 'unsure' : (Number(value) as MoodChoice),
                )
              }}
            >
              <option value="">Choose a weather</option>
              {moodLevels.map((item) => (
                <option key={item.level} value={item.level}>
                  {item.name}
                </option>
              ))}
              <option value="unsure">{UNSURE_MOOD_NAME}</option>
            </select>
          </label>
          <label>
            A note about that day, if you want
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} />
          </label>
        </>
      ) : (
        <label>
          What would you like to remember about that day?
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            rows={4}
          />
        </label>
      )}
      <div className="form-actions">
        <button
          type="submit"
          className="primary-button"
          disabled={!ready}
          aria-describedby={ready ? undefined : problem ? problemId : hintId}
        >
          Save entry
        </button>
        <button
          type="button"
          className="text-button earlier-entry-cancel"
          onClick={() => {
            focusNext.current = 'open'
            close()
          }}
        >
          Cancel
        </button>
      </div>
      {!ready && !problem && (
        <p className="subtle-copy" id={hintId}>
          {hint}
        </p>
      )}
    </form>
  )
}
