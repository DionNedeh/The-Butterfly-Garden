import { useEffect, useMemo, useRef, useState } from 'react'
import { moodLevels } from '../data/content'
import { addDaysToLocalDate, formatWeekday } from '../lib/date'
import {
  DAILY_SUNLIGHT_CAP,
  MOONLIGHT_STARDUST_REWARD,
  sunlightForDate,
} from '../lib/progression'
import { calculateSunlightStreak } from '../lib/streak'
import type { AppState, MoodEntry } from '../types'
import { Icon } from './Icons'

export interface RecapSubmission {
  level?: MoodEntry['level']
  wentWell: string
  settingDown: string
  forTomorrow: string
  planForTomorrow: boolean
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
}: {
  state: AppState
  /** The day being closed out, which after midnight is yesterday. */
  targetDate: string
  today: string
  onCollect: (submission: RecapSubmission) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<MoodEntry['level']>()
  const [wentWell, setWentWell] = useState('')
  const [settingDown, setSettingDown] = useState('')
  const [forTomorrow, setForTomorrow] = useState('')
  const [planForTomorrow, setPlanForTomorrow] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Each step replaces the last in place, so without this the reader is left
  // wherever the previous question's control was.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const closingAnotherDay = targetDate !== today
  const sunlight = sunlightForDate(state, targetDate)
  const streak = useMemo(
    () => calculateSunlightStreak(state.sunlight, targetDate),
    [state.sunlight, targetDate],
  )
  const goalsCaredFor = useMemo(
    () =>
      state.completions.filter(
        (completion) => completion.localDate === targetDate,
      ).length,
    [state.completions, targetDate],
  )

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
      setPlanForTomorrow(false)
    }
    next()
  }

  const collect = () => {
    onCollect({
      level,
      wentWell,
      settingDown,
      forTomorrow,
      planForTomorrow: planForTomorrow && forTomorrow.trim().length > 0,
    })
    onClose()
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
            <li>
              <Icon name="leaf" size={20} />
              <span>
                <strong>{goalsCaredFor}</strong>
                {goalsCaredFor === 1 ? 'act of care' : 'acts of care'}
              </span>
            </li>
            <li>
              <Icon name="sparkle" size={20} />
              <span>
                <strong>{streak.days}</strong>
                {streak.days === 1 ? 'day streak' : 'days in a row'}
              </span>
            </li>
          </ul>
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
            <textarea
              className="recap-field"
              aria-labelledby="recap-step-title"
              value={forTomorrow}
              onChange={(event) => setForTomorrow(event.target.value)}
              placeholder="A note to yourself"
              rows={3}
              maxLength={280}
            />
            {forTomorrow.trim() && (
              <button
                className={`recap-plan-toggle ${planForTomorrow ? 'selected' : ''}`}
                aria-pressed={planForTomorrow}
                onClick={() => setPlanForTomorrow((value) => !value)}
              >
                <Icon name="today" size={18} />
                {planForTomorrow
                  ? 'Added to tomorrow’s goals'
                  : 'Add to tomorrow’s goals'}
              </button>
            )}
            {planForTomorrow && forTomorrow.trim() && (
              <p className="recap-helper">
                It will be waiting on {formatWeekday(addDaysToLocalDate(targetDate, 1))}.
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
          <button className="primary-button" onClick={collect}>
            Collect Moonlight
          </button>
        )}
      </div>
    </div>
  )
}
