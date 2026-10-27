import { useId } from 'react'
import type { NextStep } from '../../lib/nextStep'
import type { MoodEntry } from '../../types'
import './checkin.css'

const STEP_NAMES: Readonly<Record<NextStep, string>> = {
  'gentle-day': 'Make today a gentle day',
  'write-one-line': 'Write one line',
  'visit-companion': 'Visit your companion',
  reflection: 'Try today’s reflection',
}

/** A line that meets the day where it is, without weighing it. */
function leadFor(checkIn: Pick<MoodEntry, 'level' | 'unsure' | 'energy'>): string {
  if (checkIn.unsure !== true && checkIn.level <= 2) {
    return 'Heavy weather can make everything harder. One small thing, if it helps:'
  }
  if (checkIn.energy === 'low') {
    return 'A low-energy day can ask for less. One small thing, if it helps:'
  }
  return 'One small thing next, if you like:'
}

/**
 * One gentle next step under a saved check-in: an offer in the page, never a
 * dialog, and it never takes focus. "Not now" puts it away; so does taking a
 * step. Which steps it holds is decided by `nextStepsAfter`.
 */
export function NextStepOffer({
  checkIn,
  steps,
  onChoose,
  onDismiss,
}: {
  checkIn: Pick<MoodEntry, 'level' | 'unsure' | 'energy'>
  steps: readonly NextStep[]
  onChoose: (step: NextStep) => void
  onDismiss: () => void
}) {
  const leadId = useId()
  return (
    <div className="next-step" role="group" aria-labelledby={leadId}>
      <p id={leadId} className="next-step-lead">
        {leadFor(checkIn)}
      </p>
      <div className="next-step-actions">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            className="secondary-button"
            onClick={() => onChoose(step)}
          >
            {STEP_NAMES[step]}
          </button>
        ))}
        <button type="button" className="text-button next-step-dismiss" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
