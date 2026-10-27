import { useEffect, useId, useRef, useState } from 'react'
import { useSwipe } from '../hooks/useSwipe'
import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
  formatJournalDate,
  isLocalDate,
  LATEST_LOCAL_DATE,
} from '../lib/date'
import { listed } from '../lib/plural'
import type { Goal } from '../types'
import { Icon } from './Icons'
import './goals/goals.css'

/** The snooze lengths offered before "pick a date". */
const SNOOZE_CHOICES: ReadonlyArray<[label: string, days: number]> = [
  ['Tomorrow', 1],
  ['3 days', 3],
  ['Next week', 7],
]

function scheduleLabel(goal: Goal): string {
  if (goal.schedule === 'once')
    return goal.scheduledDate ? `Planned · ${formatJournalDate(goal.scheduledDate)}` : 'One time'
  if (goal.schedule === 'daily') return 'Every day'
  return 'Selected days'
}

/**
 * One goal on Today, in a single row: a large check target, the title and
 * schedule, and a ⋯ menu for everything else. A dozen goals used to stack
 * four buttons each and run Today to fifteen thousand pixels on a phone.
 * On a touch screen, swiping right completes and swiping left skips.
 *
 * Snoozing and archiving take the row away, so the page decides where focus
 * goes after them (`onSnooze`, `onArchive`); everything else that keeps the
 * row hands focus back to the ⋯ button it came from.
 *
 * On a gentle day, a goal with a two-minute version shows that version, with
 * the full goal beneath it in quieter text. Caring for it is caring for the
 * goal. On other days the row stays one line: the two-minute version lives
 * in the editor.
 *
 * A goal that companions are grown alongside names them in a small badge at
 * the end of its quieter line, which keeps to that line (goals.css).
 */
export function GoalRow({
  goal,
  today,
  complete,
  skipped,
  gentle = false,
  companions = [],
  onComplete,
  onSkip,
  onSnooze,
  onEdit,
  onArchive,
}: {
  goal: Goal
  today: string
  complete: boolean
  skipped: boolean
  /** Today is a gentle day: show the two-minute version, if there is one. */
  gentle?: boolean
  /** The names of the companions grown alongside this goal (plan c.3). */
  companions?: readonly string[]
  onComplete: () => void
  onSkip: () => void
  onSnooze: (days: number) => void
  onEdit: () => void
  onArchive: () => void
}) {
  const [open, setOpen] = useState(false)
  const [snoozing, setSnoozing] = useState(false)
  const [pickedDate, setPickedDate] = useState('')
  const menuId = useId()
  const menu = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const settled = complete || skipped
  const tiny = gentle ? goal.tinyTitle : undefined
  const shownTitle = tiny ?? goal.title
  const swipe = useSwipe({
    onRight: settled ? undefined : onComplete,
    onLeft: settled ? undefined : onSkip,
  })
  const pickedDays =
    isLocalDate(pickedDate) && pickedDate > today ? daysBetweenLocalDates(today, pickedDate) : 0

  const close = (returnFocus = false) => {
    setOpen(false)
    setSnoozing(false)
    setPickedDate('')
    if (returnFocus) toggle.current?.focus()
  }

  // A menu left open closes when the gardener clicks anywhere else.
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false)
        setSnoozing(false)
        setPickedDate('')
      }
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // "Snooze…" gives way to its choices; the first of them takes its focus.
  useEffect(() => {
    if (snoozing) menu.current?.querySelector<HTMLElement>('.snooze-choices button')?.focus()
  }, [snoozing])

  return (
    <article
      className={[
        'goal-row',
        complete && 'complete',
        skipped && 'skipped',
        open && 'menu-open',
        swipe.dragging && 'swiping',
      ]
        .filter(Boolean)
        .join(' ')}
      data-goal-id={goal.id}
      style={swipe.offset ? { transform: `translateX(${swipe.offset}px)` } : undefined}
      {...swipe.handlers}
    >
      <button
        className="goal-check"
        onClick={onComplete}
        disabled={settled}
        // The visible word first, so "tap Care" works by voice.
        aria-label={complete ? `Done: ${shownTitle}` : `Care for ${shownTitle}`}
      >
        {complete ? 'Done' : 'Care'}
      </button>
      <div className="goal-copy">
        <strong>{shownTitle}</strong>
        {companions.length > 0 ? (
          <small className="with-companions">
            <span className="goal-schedule">
              {tiny ? goal.title : scheduleLabel(goal)}
              {skipped && ' · skipped today'}
            </span>
            <span className="goal-companions">
              <Icon name="leaf" size={12} />
              <span className="sr-only">, growing alongside </span>
              {listed(companions)}
            </span>
          </small>
        ) : (
          <small>
            {tiny ? goal.title : scheduleLabel(goal)}
            {skipped && ' · skipped today'}
          </small>
        )}
      </div>
      <div
        className="goal-menu"
        ref={menu}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            close(true)
          }
        }}
        // Tabbing on past the menu closes it, or it would sit over the rows
        // below while focus moves through them unseen. A press on something
        // that takes no focus (null) is left to the pointer listener above.
        onBlur={(event) => {
          const next = event.relatedTarget
          if (open && next && !menu.current?.contains(next)) close()
        }}
      >
        <button
          ref={toggle}
          className="goal-menu-button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`More for ${goal.title}`}
          onClick={() => (open ? close() : setOpen(true))}
        >
          ⋯
        </button>
        {open && (
          <div
            className="goal-menu-panel"
            id={menuId}
            role="group"
            aria-label={`${goal.title} options`}
            // Android's back gesture closes this before it leaves the page.
            data-dismiss-on-back=""
          >
            {!complete && (
              <button
                className="text-button"
                onClick={() => {
                  onSkip()
                  close(true)
                }}
              >
                {skipped ? 'Bring back today' : 'Skip today'}
              </button>
            )}
            {!settled &&
              (snoozing ? (
                <div className="snooze-choices" role="group" aria-label="Snooze until">
                  {SNOOZE_CHOICES.map(([label, days]) => (
                    <button
                      key={days}
                      className="text-button"
                      onClick={() => {
                        onSnooze(days)
                        close()
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  {/* Changing the date does nothing by itself: stepping through
                      months with the arrow keys passes dates nobody chose. */}
                  <label>
                    Pick a date
                    <input
                      type="date"
                      min={addDaysToLocalDate(today, 1)}
                      max={LATEST_LOCAL_DATE}
                      value={pickedDate}
                      onChange={(event) => setPickedDate(event.target.value)}
                    />
                  </label>
                  <button
                    className="text-button"
                    disabled={pickedDays === 0}
                    onClick={() => {
                      onSnooze(pickedDays)
                      close()
                    }}
                  >
                    Snooze until {pickedDays ? formatJournalDate(pickedDate) : 'that day'}
                  </button>
                </div>
              ) : (
                <button className="text-button" onClick={() => setSnoozing(true)}>
                  Snooze…
                </button>
              ))}
            <button
              className="text-button"
              onClick={() => {
                // The editor takes focus itself when it opens.
                onEdit()
                close()
              }}
            >
              Edit
            </button>
            <button
              className="text-button"
              onClick={() => {
                onArchive()
                close()
              }}
            >
              Archive
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
