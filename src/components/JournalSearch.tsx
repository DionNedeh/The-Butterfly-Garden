import { useId, useRef, useState } from 'react'
import { moodLevels } from '../data/content'
import {
  EMPTY_FILTER,
  isFilterActive,
  JOURNAL_KINDS,
  type JournalFilter,
  type JournalKind,
} from '../lib/journalSearch'
import { UNSURE_MOOD_NAME } from '../lib/mood'
import { counted } from '../lib/plural'
import type { MoodChoice } from '../types'

const KIND_LABELS: Record<JournalKind, string> = {
  'check-in': 'Check-ins',
  reflection: 'Reflections',
  recap: 'Recaps',
}

/** The filter with one kind switched, keeping the kinds in timeline order. */
function withKindToggled(filter: JournalFilter, kind: JournalKind): JournalFilter {
  const on = filter.kinds.includes(kind)
  return {
    ...filter,
    kinds: JOURNAL_KINDS.filter((each) => (each === kind ? !on : filter.kinds.includes(each))),
  }
}

/** The filter with a weather chosen from the select, or with none. */
function withWeather(filter: JournalFilter, value: string): JournalFilter {
  const next: JournalFilter = { ...filter }
  if (value === '') delete next.weather
  else next.weather = value === 'unsure' ? 'unsure' : (Number(value) as MoodChoice)
  return next
}

/**
 * Find things in the journal: words, kinds of entry, and the day's weather.
 *
 * Controlled, and deliberately does no searching of its own. It reports each
 * change as it happens and leaves the matching to the Journal, which defers
 * it, so a keystroke here is never held up by years of entries.
 */
export function JournalSearch({
  filter,
  onChange,
  matches,
  total,
}: {
  filter: JournalFilter
  onChange: (filter: JournalFilter) => void
  /**
   * Days the filter keeps, or undefined while the search is catching up.
   * Only shown while a filter is active.
   */
  matches: number | undefined
  /** Days in the journal. With none, and no filter to clear, nothing shows. */
  total: number
}) {
  const hintId = useId()
  const field = useRef<HTMLInputElement>(null)
  const active = isFilterActive(filter)

  // While the count is still being worked out, the last one stays: the
  // region is polite, and a count for the wrong search would be read out.
  const [status, setStatus] = useState('')
  const nextStatus = !active
    ? ''
    : matches === undefined
      ? status
      : counted(matches, 'day matches', 'days match')
  if (nextStatus !== status) setStatus(nextStatus)

  // An empty journal has nothing to find. Once shown, though, the search
  // stays, so clearing it after the last entry goes keeps focus in it.
  const [shownOnce, setShownOnce] = useState(false)
  const visible = total > 0 || active
  if (visible && !shownOnce) setShownOnce(true)
  if (!visible && !shownOnce) return null

  return (
    <div className="card journal-search" role="search" aria-label="Find things in your journal">
      <div className="journal-search-field">
        <label>
          Search your journal
          <input
            ref={field}
            type="search"
            value={filter.query}
            onChange={(event) => onChange({ ...filter, query: event.target.value })}
            onKeyDown={(event) => {
              // While an input method is composing, Escape belongs to it: it
              // cancels the word being built, not the whole search.
              if (event.nativeEvent.isComposing) return
              if (event.key === 'Escape' && filter.query !== '') {
                // Ours rather than the browser's, so a search field clears the
                // same way in every engine, and the key goes no further.
                event.preventDefault()
                event.stopPropagation()
                onChange({ ...filter, query: '' })
              }
            }}
            aria-describedby={hintId}
            // A journal search is nobody's business: keep it out of the
            // browser's saved form history.
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        {/* Outside the label, so the field's name stays what it shows. */}
        <small className="journal-search-hint" id={hintId}>
          Searched here on this device. Nothing you type is sent anywhere.
        </small>
      </div>

      <div className="journal-search-filters">
        <fieldset className="journal-search-kinds">
          <legend>Show only</legend>
          <div className="journal-search-kind-list">
            {JOURNAL_KINDS.map((kind) => {
              const pressed = filter.kinds.includes(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  className="journal-search-kind"
                  aria-pressed={pressed}
                  onClick={() => onChange(withKindToggled(filter, kind))}
                >
                  {/* A tick as well as a colour, so the state reads without
                      telling colours apart. */}
                  <span className="journal-search-check" aria-hidden="true" />
                  {KIND_LABELS[kind]}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className="journal-search-weather">
          Weather that day
          <select
            value={filter.weather ?? ''}
            onChange={(event) => onChange(withWeather(filter, event.target.value))}
          >
            <option value="">Any weather</option>
            {moodLevels.map((item) => (
              <option key={item.level} value={item.level}>
                {item.name}
              </option>
            ))}
            <option value="unsure">{UNSURE_MOOD_NAME}</option>
          </select>
        </label>
      </div>

      <div className="journal-search-summary">
        {/* Always in the page, so a screen reader is already listening when
            the count first appears. */}
        <p className="journal-search-status" role="status" aria-live="polite">
          {status}
        </p>
        {active && (
          <button
            type="button"
            className="text-button journal-search-clear"
            onClick={() => {
              onChange(EMPTY_FILTER)
              // The button leaves with the filter; without this, focus would
              // fall back to the top of the page.
              field.current?.focus()
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
