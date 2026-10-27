import { useId, useRef, useState } from 'react'
import { energyLevels, feelings } from '../../data/feelings'
import { describeCheckInDetails, MAX_FEELINGS, toggleFeeling } from '../../lib/feelings'
import { countedInWords } from '../../lib/plural'
import type { EnergyLevel } from '../../types'
import './checkin.css'

const UP_TO = countedInWords(MAX_FEELINGS, 'word', 'words')

/**
 * The check-in's two optional extras, shown once a weather is chosen: words
 * for how the day feels, and a three-step energy.
 *
 * Both sit behind one button, so a phone's check-in does not grow tall; while
 * folded, what was chosen is said beside it. Nothing is chosen for the
 * gardener, every word looks the same, and neither answer changes the
 * Sunlight a check-in earns.
 */
export function CheckInExtras({
  feelings: chosen,
  energy,
  onFeelingsChange,
  onEnergyChange,
}: {
  /** Feeling ids, as `lib/feelings` keeps them. */
  feelings: readonly string[]
  energy?: EnergyLevel
  onFeelingsChange: (feelings: readonly string[]) => void
  /** Undefined clears the answer: the question stays optional once answered. */
  onEnergyChange: (energy: EnergyLevel | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const firstEnergy = useRef<HTMLInputElement>(null)
  const full = chosen.length >= MAX_FEELINGS
  const summary = describeCheckInDetails({ feelings: [...chosen], energy })

  return (
    <div className="check-in-extras">
      <p className="weather-welcome">All weather is welcome.</p>
      <button
        type="button"
        className="text-button check-in-extras-toggle"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((value) => !value)}
      >
        Add feelings or energy
        <span className="check-in-extras-chevron" aria-hidden="true" />
      </button>
      {!open && summary && <p className="check-in-extras-summary">{summary}</p>}
      <div id={`${id}-panel`} className="check-in-extras-panel" hidden={!open}>
        <fieldset className="check-in-choice" aria-describedby={`${id}-limit`}>
          <legend>Feelings</legend>
          <div className="feeling-chips">
            {feelings.map((feeling) => {
              const pressed = chosen.includes(feeling.id)
              // Still focusable and still named, so the reason beside the
              // chips is found; pressing it changes nothing.
              const refused = full && !pressed
              return (
                <button
                  key={feeling.id}
                  type="button"
                  className="feeling-chip"
                  aria-pressed={pressed}
                  aria-disabled={refused || undefined}
                  onClick={() => {
                    if (!refused) onFeelingsChange(toggleFeeling(chosen, feeling.id))
                  }}
                >
                  <span className="feeling-chip-check" aria-hidden="true" />
                  {feeling.name}
                </button>
              )
            })}
          </div>
          {/* Polite, so reaching the limit is said aloud, never a silent refusal. */}
          <p id={`${id}-limit`} className="feeling-limit" aria-live="polite">
            {full
              ? `That’s ${UP_TO}, as many as one check-in holds. Unchoose one to choose another.`
              : `Choose up to ${UP_TO}, or none.`}
          </p>
        </fieldset>
        <fieldset className="check-in-choice">
          <legend>Energy</legend>
          <div className="energy-options">
            {energyLevels.map((level, index) => (
              <label
                key={level.id}
                className={`energy-option ${energy === level.id ? 'selected' : ''}`}
              >
                <input
                  ref={index === 0 ? firstEnergy : undefined}
                  type="radio"
                  name={`${id}-energy`}
                  value={level.id}
                  checked={energy === level.id}
                  onChange={() => onEnergyChange(level.id)}
                />
                {level.name}
              </label>
            ))}
            {energy && (
              <button
                type="button"
                className="text-button energy-clear"
                onClick={() => {
                  // The button goes with the answer; focus stays in the question.
                  firstEnergy.current?.focus()
                  onEnergyChange(undefined)
                }}
              >
                Clear energy
              </button>
            )}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
