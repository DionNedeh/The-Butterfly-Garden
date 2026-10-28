import { useId, useMemo, useState } from 'react'
import type { GoalSuggestion } from '../data/goalSuggestions'
import { balancedSuggestions, openSuggestions } from '../lib/goalSuggestions'
import './goals/goals.css'

/** How many ideas Today offers at once. */
const IDEAS_SHOWN = 3

/**
 * A few ideas for a new goal, beside the form that adds one: a balanced mix
 * (lib/goalSuggestions), and "Other ideas" for the next. Choosing one fills
 * the form rather than adding the goal, so the gardener still says how often.
 */
export function GoalIdeas({
  activeGoalTitles,
  onChoose,
}: {
  /** The titles of goals not archived, which are never offered again. */
  activeGoalTitles: readonly string[]
  onChoose: (idea: GoalSuggestion) => void
}) {
  const labelId = useId()
  // A counter, so each press shows the next mix and a redraw changes nothing.
  const [round, setRound] = useState(0)
  // Said once for each press, so the new mix is heard without leaving the
  // button; not when a goal is added and the mix moves on by itself.
  const [heard, setHeard] = useState('')
  const ideas = useMemo(
    () => balancedSuggestions(activeGoalTitles, round, IDEAS_SHOWN),
    [activeGoalTitles, round],
  )
  const more = useMemo(
    () => openSuggestions(activeGoalTitles).length > IDEAS_SHOWN,
    [activeGoalTitles],
  )
  if (ideas.length === 0) return null
  return (
    <div className="goal-ideas" role="group" aria-labelledby={labelId}>
      <span className="goal-ideas-label" id={labelId}>
        Ideas
      </span>
      <ul>
        {ideas.map((idea) => (
          <li key={idea.title}>
            <button type="button" className="goal-idea" onClick={() => onChoose(idea)}>
              {idea.title}
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <button
          type="button"
          className="text-button goal-ideas-more"
          onClick={() => {
            const next = balancedSuggestions(activeGoalTitles, round + 1, IDEAS_SHOWN)
            setRound(round + 1)
            setHeard(`New ideas: ${next.map((idea) => idea.title).join(', ')}`)
          }}
        >
          Other ideas
        </button>
      )}
      {/* A live region without the status role, which Today's undo offer
          already speaks through. */}
      <p className="sr-only goal-ideas-heard" aria-live="polite">
        {heard}
      </p>
    </div>
  )
}
