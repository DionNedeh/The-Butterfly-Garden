import { useEffect, useMemo, useRef, useState } from 'react'
import { clearDraft, useDraft } from '../lib/drafts'
import { moodLevels } from '../data/content'
import { addDaysToLocalDate, formatWeekday } from '../lib/date'
import {
  DAILY_SUNLIGHT_CAP,
  MOONLIGHT_STARDUST_REWARD,
  sunlightForDate,
} from '../lib/progression'
import { describeDay } from '../lib/daySummary'
import { pacerFor } from '../lib/breathing'
import { TOMORROW_NOTE_LENGTH, TOMORROW_NOTES, type TomorrowNote } from '../lib/gardenActions'
import type { AppState, MoodEntry } from '../types'
import { GuideLink } from './GuideLink'
import { Icon } from './Icons'
import './recap.css'

/**
 * The draft for tomorrow as notes, a line each. A draft left by an older
 * build was one free text box with any number of lines; rather than drop
 * what was written after the third, the rest is kept in the last note.
 */
function notesOf(draft: string): string[] {
  const lines = draft.split('\n')
  if (lines.length <= TOMORROW_NOTES) return lines
  const kept = lines.filter((line) => line.trim())
  return [
    ...kept.slice(0, TOMORROW_NOTES - 1),
    kept.slice(TOMORROW_NOTES - 1).join(' '),
  ]
}

export interface RecapSubmission {
  level?: MoodEntry['level']
  wentWell: string
  settingDown: string
  /** Up to three notes for tomorrow, each of which can become a goal. */
  tomorrow: TomorrowNote[]
}

/** Enough of a step to render its heading; the body is chosen per index. */
const steps: Array<{ eyebrow?: string; heading: string; helper?: string }> = [
  { eyebrow: 'Where the day got to', heading: 'Here is your day.' },
  {
    eyebrow: 'No right answer',
    heading: 'How did the day end up?',
    helper: 'Mornings and evenings do not always agree.',
  },
  {
    eyebrow: 'However small',
    heading: 'What went well today?',
    helper: 'It does not have to be an achievement.',
  },
  {
    eyebrow: 'You can leave it here',
    heading: 'What are you setting down?',
    helper: 'Something you would rather not carry into tomorrow.',
  },
  {
    eyebrow: 'Just a note to yourself',
    heading: 'Anything for tomorrow?',
    helper: 'A reminder, not a promise.',
  },
  { heading: 'The day is rounded out.' },
]

/**
 * The end-of-day recap: one question at a time, every one of them skippable.
 *
 * Deliberately not shaped like Today. Today is a form you fill in; this is a
 * short conversation before closing the laptop, so it asks one thing per
 * screen and never requires an answer -- reaching the end having said nothing
 * still collects the Moonlight.
 */
export function MoonlightRecap({
  state,
  targetDate,
  today,
  onCollect,
  onClose,
  onFadeToNight,
  onOpenGuide,
  onBreathe,
}: {
  state: AppState
  /** The day being closed out, which after midnight is yesterday. */
  targetDate: string
  today: string
  onCollect: (submission: RecapSubmission) => void
  onClose: () => void
  /**
   * The other way to finish: once the night is collected, turn the garden to
   * night, let the sound fade, and go back to the garden. Offered only when
   * given.
   */
  onFadeToNight?: () => void
  /** Open the Guide at a section, from a "What does this do?" link. */
  onOpenGuide?: (section: string) => void
  /**
   * A last, optional step: once the night is collected, breathe with a
   * butterfly before bed. Offered only when given.
   */
  onBreathe?: () => void
}) {
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<MoodEntry['level']>()
  // Kept as drafts until the night is collected, so a recap survives a change
  // of page, a reload or a closed tab -- keyed by the day it closes, so a
  // draft can never be collected against the wrong night.
  const [wentWell, setWentWell] = useDraft(`recap:${targetDate}:wentWell`, '')
  const [settingDown, setSettingDown] = useDraft(
    `recap:${targetDate}:settingDown`,
    '',
  )
  const [forTomorrow, setForTomorrow] = useDraft(
    `recap:${targetDate}:forTomorrow`,
    '',
  )
  // The notes are one draft, a line each, so they survive a reload together.
  const notes = notesOf(forTomorrow)
  const [planned, setPlanned] = useState<boolean[]>([])
  const notesRef = useRef<HTMLDivElement>(null)
  // "Add another" hides once used, so the note it added takes its focus.
  const focusNote = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (focusNote.current === undefined) return
    notesRef.current?.querySelectorAll('input')[focusNote.current]?.focus()
    focusNote.current = undefined
  }, [notes.length])
  const setNote = (index: number, text: string) => {
    const next = [...notes]
    next[index] = text.replace(/\n/g, ' ')
    setForTomorrow(next.join('\n'))
  }
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Each step replaces the last in place, so without this the reader is left
  // wherever the previous question's control was.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const closingAnotherDay = targetDate !== today
  const sunlight = sunlightForDate(state, targetDate)
  const dayInWords = useMemo(() => describeDay(state, targetDate), [state, targetDate])

  const last = steps.length - 1
  const current = steps[step]
  const back = () => setStep((value) => Math.max(0, value - 1))
  const next = () => setStep((value) => Math.min(last, value + 1))

  /**
   * Skipping withdraws the answer as well as moving on.
   *
   * Otherwise Skip and Continue do exactly the same thing, and something typed
   * and then thought better of is kept anyway -- which is the opposite of what
   * the button says, in the one place the app promises nothing is required.
   */
  const skip = () => {
    if (step === 1) setLevel(undefined)
    if (step === 2) setWentWell('')
    if (step === 3) setSettingDown('')
    if (step === 4) {
      setForTomorrow('')
      setPlanned([])
    }
    next()
  }

  /** Collect the night, then leave the way the gardener chose. */
  const collect = (leave: () => void) => {
    onCollect({
      level,
      wentWell,
      settingDown,
      // A note emptied again after it was marked is not planned.
      tomorrow: notes.map((text, index) => ({
        text,
        plan: planned[index] === true && text.trim() !== '',
      })),
    })
    clearDraft(
      `recap:${targetDate}:wentWell`,
      `recap:${targetDate}:settingDown`,
      `recap:${targetDate}:forTomorrow`,
    )
    leave()
  }

  return (
    <div className="view recap-view">
      <header className="page-header recap-header">
        <div>
          <p className="eyebrow">
            <Icon name="moon" size={18} />
            {closingAnotherDay
              ? `Rounding out ${formatWeekday(targetDate)}`
              : 'Rounding out the day'}
          </p>
          <h1>Moonlight</h1>
        </div>
        <button className="text-button" onClick={onClose}>
          Not now
        </button>
      </header>

      <p className="recap-progress" role="status">
        Step {step + 1} of {steps.length}
      </p>

      <section className="card recap-step" aria-labelledby="recap-step-title">
        {current.eyebrow && <p className="eyebrow">{current.eyebrow}</p>}
        <h2 id="recap-step-title" tabIndex={-1} ref={headingRef}>
          {current.heading}
        </h2>
        {current.helper && <p className="recap-helper">{current.helper}</p>}

        {step === 0 && (
          <>
            <p className="recap-day-words">{dayInWords}</p>
            <ul className="recap-summary">
              <li>
                <Icon name="sun" size={20} />
                <span>
                  <strong>
                    {sunlight} / {DAILY_SUNLIGHT_CAP}
                  </strong>
                  Sunlight earned
                </span>
              </li>
            </ul>
            {/* Only here, before any answer: the recap's step and weather are
                not drafts, so leaving from a later step would lose them. */}
            {onOpenGuide && (
              <GuideLink section="moonlight" topic="Moonlight" onOpen={onOpenGuide} />
            )}
          </>
        )}

        {step === 1 && (
          <div className="mood-grid">
            {moodLevels.map((item) => (
              <button
                key={item.level}
                className={`mood-button ${level === item.level ? 'selected' : ''}`}
                aria-pressed={level === item.level}
                onClick={() => setLevel(item.level)}
              >
                <span
                  className={`weather weather-${item.level}`}
                  aria-hidden="true"
                />
                <strong>{item.name}</strong>
                <small>{item.weather}</small>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <textarea
            className="recap-field"
            // The step heading is the question; labelling the field with a
            // hidden copy of it would just read the same sentence twice.
            aria-labelledby="recap-step-title"
            value={wentWell}
            onChange={(event) => setWentWell(event.target.value)}
            placeholder="A few words are plenty"
            rows={3}
            maxLength={400}
          />
        )}

        {step === 3 && (
          <textarea
            className="recap-field"
            // The step heading is the question; labelling the field with a
            // hidden copy of it would just read the same sentence twice.
            aria-labelledby="recap-step-title"
            value={settingDown}
            onChange={(event) => setSettingDown(event.target.value)}
            placeholder="You can leave it here"
            rows={3}
            maxLength={400}
          />
        )}

        {step === 4 && (
          <>
            <div className="tomorrow-notes" ref={notesRef}>
              {notes.map((note, index) => (
                <div className="tomorrow-note" key={index}>
                  <input
                    className="recap-field"
                    aria-label={`Note ${index + 1} for tomorrow`}
                    value={note}
                    onChange={(event) => setNote(index, event.target.value)}
                    placeholder={index === 0 ? 'A note to yourself' : 'Another, if you like'}
                    maxLength={TOMORROW_NOTE_LENGTH}
                  />
                  {note.trim() && (
                    <button
                      className={`recap-plan-toggle ${planned[index] ? 'selected' : ''}`}
                      aria-pressed={planned[index] === true}
                      // One name whatever its state, which aria-pressed carries; the
                      // visible words first, so a voice user can say what they see.
                      aria-label={`Add to tomorrow’s goals: ${note.trim()}`}
                      onClick={() =>
                        setPlanned((current) => {
                          const next = [...current]
                          next[index] = !next[index]
                          return next
                        })
                      }
                    >
                      <Icon name="today" size={18} />
                      {/* Pressed shows in more than colour. */}
                      {planned[index] && <span aria-hidden="true">✓</span>}
                      Add to tomorrow’s goals
                    </button>
                  )}
                </div>
              ))}
            </div>
            {notes.length < TOMORROW_NOTES && notes[notes.length - 1]?.trim() && (
              <button
                className="text-button tomorrow-add"
                onClick={() => {
                  focusNote.current = notes.length
                  setForTomorrow(`${notes.join('\n')}\n`)
                }}
              >
                Add another
              </button>
            )}
            {notes.some((note, index) => note.trim() && planned[index]) && (
              <p className="recap-helper">
                They will be waiting on {formatWeekday(addDaysToLocalDate(targetDate, 1))}.
              </p>
            )}
          </>
        )}

        {step === last && (
          <p className="recap-helper">
            {MOONLIGHT_STARDUST_REWARD} Stardust for closing the day, and the
            recap is kept in your journal.
          </p>
        )}
      </section>

      <div className="recap-actions">
        {step > 0 && (
          <button className="text-button" onClick={back}>
            Back
          </button>
        )}
        {step > 0 && step < last && (
          <button className="text-button" onClick={skip}>
            Skip this one
          </button>
        )}
        {step < last ? (
          <button className="primary-button" onClick={next}>
            Continue
          </button>
        ) : (
          // The ordinary finish comes first; putting the phone down is the
          // quieter second choice, collected exactly the same way.
          <div className="recap-finish">
            <button className="primary-button" onClick={() => collect(onClose)}>
              Collect Moonlight
            </button>
            {onFadeToNight && (
              <button className="secondary-button" onClick={() => collect(onFadeToNight)}>
                Fade the garden to night and close
              </button>
            )}
            {/* Collected the same way first: the answers here are not drafts,
                so leaving before collecting would lose them. */}
            {onBreathe && (
              <button className="text-button recap-breathe" onClick={() => collect(onBreathe)}>
                Collect Moonlight and breathe with {pacerFor(state).name}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
