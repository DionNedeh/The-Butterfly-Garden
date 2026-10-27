import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  moodLevels,
  moodNames,
  species,
} from '../data/content'
import { formatJournalDate } from '../lib/date'
import { useLocalDate } from '../hooks/useLocalDate'
import { describeCheckInDetails } from '../lib/feelings'
import { useDraft } from '../lib/drafts'
import { gardenStartDate } from '../lib/earlierDay'
import { fieldNotesBySpecies, formatWelcomedOn } from '../lib/fieldNotes'
import { bondLevel } from '../lib/lifecycle'
import { moodChoiceOf, moodName, UNSURE_MOOD_NAME, withMoodChoice } from '../lib/mood'
import { counted, listed } from '../lib/plural'
import { TOMORROW_TEXT_LENGTH } from '../lib/gardenActions'
import {
  EMPTY_FILTER,
  filterJournalDates,
  indexJournalText,
  isFilterActive,
  type JournalFilter,
} from '../lib/journalSearch'
import { onThisDay } from '../lib/onThisDay'
import { promptById } from '../lib/prompts'
import { careRhythm } from '../lib/rhythm'
import { seenInTheWild, subjectKey, type ChangeSightings } from '../lib/sightings'
import type {
  AppState,
  MoodChoice,
  MoodEntry,
  RecapEntry,
  ReflectionEntry,
} from '../types'
import { Butterfly } from './Butterfly'
import { Icon } from './Icons'
import { JournalExport } from './JournalExport'
import { JournalSearch } from './JournalSearch'
import { FieldFacts } from './FieldFacts'
import { WeatherCalendar } from './WeatherCalendar'
import { EarlierEntry } from './journal/EarlierEntry'
import { Letters } from './journal/Letters'
import { OnThisDayCard } from './journal/OnThisDayCard'
import { StarToggle } from './journal/StarToggle'
import { SeenInTheWild } from './sightings/SeenInTheWild'
import { YearLink } from './year/YearLink'
import type { StarredKind } from '../lib/letters'
import './journal/journal.css'

// The field book of sightings, with its form, arrives when the field notes open.
const FieldBook = lazy(() => import('./sightings/FieldBook'))

/** The timeline grows for as long as the garden is kept, so it is paged. */
const TIMELINE_PAGE_SIZE = 30

export function JournalView({
  state,
  onUpdateMood,
  onDeleteMood,
  onUpdateReflection,
  onDeleteReflection,
  onUpdateRecap,
  onDeleteRecap,
  onAddEarlierMood,
  onAddEarlierReflection,
  openLetter,
  onReadLetter,
  onSetStarred,
  onChangeSightings,
  onOpenYear,
  returnedFromYear,
}: {
  state: AppState
  onUpdateMood: (entry: MoodEntry) => void
  onDeleteMood: (id: string) => void
  onUpdateReflection: (entry: ReflectionEntry) => void
  onDeleteReflection: (id: string) => void
  onUpdateRecap: (entry: RecapEntry) => void
  onDeleteRecap: (id: string) => void
  /** A check-in for a day that has passed, written later. Without both, it is not offered. */
  onAddEarlierMood?: (localDate: string, choice: MoodChoice, note: string) => void
  /** A reflection for a day that has passed, written later. */
  onAddEarlierReflection?: (localDate: string, body: string) => void
  /** Arrived from the garden's card: open Marigold's newest letter. */
  openLetter?: boolean
  /** A letter was read (lib/letters). Without it, the letters are not shown. */
  onReadLetter?: (sunday: string) => void
  /** Star a line for letters to quote, or not. Without it, no star is offered. */
  onSetStarred?: (kind: StarredKind, id: string, starred: boolean) => void
  /** Log, change and cross out sightings. Without it, the field book is not offered. */
  onChangeSightings?: ChangeSightings
  /** Open "Your garden's year", at a year or this one. Without it, not offered. */
  onOpenYear?: (year?: number) => void
  /** Back from the year's page: focus returns to the link that opened it. */
  returnedFromYear?: boolean
}) {
  const [editingRecap, setEditingRecap] = useState<RecapEntry>()
  const [editingReflection, setEditingReflection] = useState<ReflectionEntry>()
  const [editingMood, setEditingMood] = useState<MoodEntry>()
  const [pendingDelete, setPendingDelete] = useState<string>()
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE)
  const [fieldNotesOpen, setFieldNotesOpen] = useState(false)
  const today = useLocalDate()

  // Index once per data change; the timeline used to re-scan every entry for
  // every row it drew, which is quadratic once a garden has a year of days.
  const moodByDate = useMemo(
    () => new Map(state.moods.map((entry) => [entry.localDate, entry])),
    [state.moods],
  )
  const reflectionByDate = useMemo(
    () => new Map(state.reflections.map((entry) => [entry.localDate, entry])),
    [state.reflections],
  )
  const recapByDate = useMemo(
    () => new Map(state.recaps.map((entry) => [entry.localDate, entry])),
    [state.recaps],
  )
  const goalTitleById = useMemo(
    () => new Map(state.goals.map((goal) => [goal.id, goal.title])),
    [state.goals],
  )
  const dates = useMemo(
    () =>
      Array.from(
        new Set([
          ...moodByDate.keys(),
          ...reflectionByDate.keys(),
          // A day closed out with nothing else recorded is still a day the
          // gardener showed up for, and belongs in the timeline.
          ...recapByDate.keys(),
        ]),
      ).sort((a, b) => b.localeCompare(a)),
    [moodByDate, reflectionByDate, recapByDate],
  )
  // Searching happens over the garden in memory, never anywhere else. The
  // text is normalised once per change to the entries, and the filter is
  // deferred, so typing stays quick in a journal years long.
  const [filter, setFilter] = useState<JournalFilter>(EMPTY_FILTER)
  const deferredFilter = useDeferredValue(filter)
  const textIndex = useMemo(
    () => indexJournalText({ moodByDate, reflectionByDate, recapByDate }),
    [moodByDate, reflectionByDate, recapByDate],
  )
  const filtering = isFilterActive(deferredFilter)
  const shownDates = useMemo(
    () =>
      filtering
        ? filterJournalDates(
            dates,
            { moodByDate, reflectionByDate, recapByDate },
            deferredFilter,
            textIndex,
          )
        : dates,
    [filtering, dates, moodByDate, reflectionByDate, recapByDate, deferredFilter, textIndex],
  )
  const visibleDates = useMemo(
    () => shownDates.slice(0, visibleCount),
    [shownDates, visibleCount],
  )
  const hasEntry = useCallback(
    (localDate: string) =>
      moodByDate.has(localDate) || reflectionByDate.has(localDate) || recapByDate.has(localDate),
    [moodByDate, reflectionByDate, recapByDate],
  )
  // A day chosen in the calendar: shown in the timeline, then given focus.
  // Each choice is a new request, so choosing a day already in view still
  // redraws and is answered at once, never on some later, unrelated redraw.
  const [openRequest, setOpenRequest] = useState<{ day: string; serial: number }>()
  const answeredRequest = useRef(0)
  const openDay = useCallback(
    (localDate: string) => {
      const index = dates.indexOf(localDate)
      if (index === -1) return
      // The whole journal, so the day cannot be hidden by a search.
      setFilter(EMPTY_FILTER)
      setVisibleCount((count) =>
        Math.max(count, Math.ceil((index + 1) / TIMELINE_PAGE_SIZE) * TIMELINE_PAGE_SIZE),
      )
      setOpenRequest((previous) => ({ day: localDate, serial: (previous?.serial ?? 0) + 1 }))
    },
    [dates],
  )
  useEffect(() => {
    if (!openRequest || answeredRequest.current === openRequest.serial) return
    // A search being cleared shows the day a moment later; this runs again then.
    const entry = document.getElementById(`day-${openRequest.day}`)
    if (!entry) return
    answeredRequest.current = openRequest.serial
    entry.querySelector<HTMLElement>('time')?.focus()
  }, [openRequest, visibleDates])
  // Counted by species, not by creature (a.4 A4), with the companions said
  // alongside; each card names the first of its species to arrive.
  const fieldNotes = useMemo(() => fieldNotesBySpecies(state.creatures), [state.creatures])
  const butterfliesWelcomed = useMemo(
    () => Array.from(fieldNotes.values()).reduce((sum, note) => sum + note.count, 0),
    [fieldNotes],
  )
  // Each butterfly's latest sighting in the wild, for its card's stamp.
  const seen = useMemo(() => seenInTheWild(state.sightings), [state.sightings])
  // A day from a month or a year ago, unless it was put away for today.
  const gardenStart = gardenStartDate(state.profile)
  const offered = useMemo(
    () =>
      dates.length === 0
        ? undefined
        : onThisDay({ moodByDate, reflectionByDate, recapByDate }, today, gardenStart),
    [dates, moodByDate, reflectionByDate, recapByDate, today, gardenStart],
  )
  const [putAway, setPutAway] = useDraft(`on-this-day:${today}`, '')
  const pageHeading = useRef<HTMLHeadingElement>(null)
  const rhythm = useMemo(() => careRhythm(state.sunlight, today), [state.sunlight, today])
  const hideCounts = state.profile?.hideDayCounts === true

  return (
    <div className="view journal-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Private to this device</p>
          {/* Focusable from code alone, for when the card below is put away. */}
          <h1 ref={pageHeading} tabIndex={-1}>
            Journal
          </h1>
          <p>
            Your words are kept as you wrote them, without scores or analysis.
            {onOpenYear && (
              <YearLink
                state={state}
                today={today}
                onOpen={onOpenYear}
                focusOnArrival={returnedFromYear}
              />
            )}
          </p>
        </div>
      </header>

      {onReadLetter && (
        <Letters state={state} openOnArrival={openLetter} onRead={onReadLetter} />
      )}

      {offered && putAway === '' && (
        <OnThisDayCard
          day={offered}
          onOpenDay={openDay}
          onPutAway={() => {
            // The card leaves with its button; focus goes to the page's top.
            pageHeading.current?.focus()
            setPutAway('put-away')
          }}
        />
      )}

      <details
        className="card field-notes"
        open={fieldNotesOpen}
        onToggle={(event) => setFieldNotesOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            <span className="eyebrow">Field notes</span>
            <strong id="species-journal-title">Butterflies welcomed</strong>
            {butterfliesWelcomed > 0 && (
              <small className="field-notes-counts">
                {counted(fieldNotes.size, 'species', 'species')} ·{' '}
                {counted(butterfliesWelcomed, 'companion', 'companions')}
              </small>
            )}
          </span>
          <span className="count-badge">
            {fieldNotes.size} / {species.length}
          </span>
        </summary>
        <div className="species-grid" aria-labelledby="species-journal-title">
          {fieldNotesOpen &&
            species.map((definition) => {
              const note = fieldNotes.get(definition.id)
              const creature = note?.first
              const welcomedOn = creature && formatWelcomedOn(creature)
              const wild = seen.get(subjectKey({ kind: 'butterfly', speciesId: definition.id }))
              return (
                <article
                  className={`species-card ${creature ? '' : 'undiscovered'}`}
                  key={definition.id}
                >
                  {creature ? (
                    <Butterfly
                      speciesId={definition.id}
                      label={definition.commonName}
                    />
                  ) : (
                    <div
                      className="unknown-butterfly"
                      aria-label="Not yet discovered"
                    >
                      <span className="unknown-wing unknown-wing-left" />
                      <span className="unknown-wing unknown-wing-right" />
                      <span className="unknown-body" />
                    </div>
                  )}
                  <div>
                    <strong>{definition.commonName}</strong>
                    <em>
                      {creature
                        ? definition.scientificName
                        : 'Not yet welcomed'}
                    </em>
                    {welcomedOn && <small>Welcomed in your garden on {welcomedOn}</small>}
                    {creature && note && (
                      <small>
                        {note.count > 1
                          ? `Welcomed as ${creature.name}, the first of ${note.count}`
                          : `Welcomed as ${creature.name}`}
                      </small>
                    )}
                    <SeenInTheWild seen={wild} />
                    {note && <FieldFacts speciesId={definition.id} level={bondLevel(note.bond)} />}
                  </div>
                </article>
              )
            })}
        </div>
        {fieldNotesOpen && onChangeSightings && (
          <Suspense
            fallback={
              <p className="subtle-copy" role="status">
                Opening your field book…
              </p>
            }
          >
            <FieldBook state={state} today={today} onChangeSightings={onChangeSightings} />
          </Suspense>
        )}
      </details>

      {/* A rhythm rather than a streak: nothing here falls back to zero after
          a missed day (lib/rhythm.ts). */}
      <section className="card streak-card" aria-labelledby="rhythm-title">
        <div className="streak-icon">
          <Icon name="sun" size={30} />
        </div>
        <div className="streak-copy">
          <p className="eyebrow">Daily care</p>
          <h2 id="rhythm-title">Your rhythm</h2>
          {hideCounts ? (
            <p>
              Day counts are hidden, as you chose. Every act of care still
              grows your garden.
            </p>
          ) : (
            <p>
              Days you cared for yourself: {rhythm.lastSeven} of the last 7 ·{' '}
              {rhythm.thisMonth} this month. A missed day never sets this back.
              {rhythm.longestRun > 1 &&
                ` Your longest run so far is ${counted(rhythm.longestRun, 'day', 'days')}.`}
            </p>
          )}
        </div>
        {!hideCounts && (
          <div
            className="streak-count"
            aria-label={`${rhythm.lastSeven} of the last 7 days cared for`}
          >
            <strong>{rhythm.lastSeven}</strong>
            <span>of the last 7</span>
            <small>{counted(rhythm.thisMonth, 'day', 'days')} this month</small>
          </div>
        )}
      </section>

      <WeatherCalendar
        moodByDate={moodByDate}
        hasEntry={hasEntry}
        today={today}
        firstDate={dates.at(-1)}
        onOpenDay={openDay}
      />

      <section aria-labelledby="timeline-title">
        <div className="section-heading timeline-heading">
          <div>
            <p className="eyebrow">Your days</p>
            <h2 id="timeline-title">Journal timeline</h2>
          </div>
        </div>
        {onAddEarlierMood && onAddEarlierReflection && (
          <EarlierEntry
            state={state}
            today={today}
            onAddMood={onAddEarlierMood}
            onAddReflection={onAddEarlierReflection}
            onOpenDay={openDay}
          />
        )}
        <JournalSearch
          filter={filter}
          onChange={(next) => {
            setFilter(next)
            setVisibleCount(TIMELINE_PAGE_SIZE)
          }}
          // Unknown until the deferred search has caught up, so a count for
          // the whole journal is never announced in passing.
          matches={filter === deferredFilter ? shownDates.length : undefined}
          total={dates.length}
        />
        {dates.length === 0 ? (
          <div className="card empty-state">
            <p>Your first check-in or reflection will appear here.</p>
          </div>
        ) : shownDates.length === 0 ? (
          <div className="card empty-state">
            <p>Nothing in the journal matches that yet.</p>
          </div>
        ) : (
          <div className="timeline">
            {visibleDates.map((date) => {
              const mood = moodByDate.get(date)
              // "Feeling tired, hopeful · Energy low", or nothing when not answered.
              const moodDetails = mood ? describeCheckInDetails(mood) : ''
              const reflection = reflectionByDate.get(date)
              const recap = recapByDate.get(date)
              // Every note planned as a goal; an older recap names only one.
              const plannedGoalTitles = (
                recap?.plannedGoalIds ?? (recap?.plannedGoalId ? [recap.plannedGoalId] : [])
              )
                .map((id) => goalTitleById.get(id))
                .filter((title): title is string => Boolean(title))
              const tomorrowNotes = recap?.forTomorrow
                ? recap.forTomorrow.split('\n').filter((note) => note.trim())
                : []
              const prompt = reflection ? promptById(reflection.promptId) : undefined
              return (
                <article className="card timeline-entry" key={date} id={`day-${date}`}>
                  <span className="timeline-dot" aria-hidden="true" />
                  {/* Focusable from code alone, for a day opened from the calendar. */}
                  <time dateTime={date} tabIndex={-1}>
                    {formatJournalDate(date)}
                  </time>
                  {mood && (
                    <div className="journal-block">
                      {editingMood?.id === mood.id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault()
                            onUpdateMood(editingMood)
                            setEditingMood(undefined)
                          }}
                        >
                          <label>
                            Inner weather
                            <select
                              value={moodChoiceOf(editingMood)}
                              onChange={(event) =>
                                setEditingMood(
                                  withMoodChoice(
                                    editingMood,
                                    event.target.value === 'unsure'
                                      ? 'unsure'
                                      : (Number(event.target.value) as MoodChoice),
                                  ),
                                )
                              }
                            >
                              {moodNames.map((name, index) => (
                                <option key={name} value={index + 1}>
                                  {name}
                                </option>
                              ))}
                              <option value="unsure">{UNSURE_MOOD_NAME}</option>
                            </select>
                          </label>
                          <label>
                            Note
                            <input
                              value={editingMood.note}
                              onChange={(event) =>
                                setEditingMood({
                                  ...editingMood,
                                  note: event.target.value,
                                })
                              }
                              maxLength={280}
                            />
                          </label>
                          <div className="form-actions">
                            <button className="secondary-button" type="submit">
                              Save
                            </button>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => setEditingMood(undefined)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <span
                              className={`weather small weather-${moodChoiceOf(mood)}`}
                              aria-hidden="true"
                            />
                            <div>
                              <strong>{moodName(moodChoiceOf(mood))}</strong>
                              {mood.writtenLater && (
                                <small className="written-later">Written later</small>
                              )}
                              {moodDetails && (
                                <p>
                                  <small>{moodDetails}</small>
                                </p>
                              )}
                              {mood.note && <p>{mood.note}</p>}
                            </div>
                          </div>
                          <div className="inline-actions">
                            {onSetStarred && mood.note && (
                              <StarToggle
                                starred={mood.starred === true}
                                onChange={(starred) => onSetStarred('check-in', mood.id, starred)}
                              />
                            )}
                            <button
                              className="text-button"
                              onClick={() => setEditingMood(mood)}
                            >
                              Edit
                            </button>
                            {pendingDelete === mood.id ? (
                              <>
                                <span className="delete-prompt" role="alert">
                                  Delete this check-in for good?
                                </span>
                                <button
                                  className="text-button danger-text"
                                  onClick={() => {
                                    onDeleteMood(mood.id)
                                    setPendingDelete(undefined)
                                  }}
                                >
                                  Yes, delete
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => setPendingDelete(undefined)}
                                >
                                  Keep
                                </button>
                              </>
                            ) : (
                              <button
                                className="text-button danger-text"
                                onClick={() => setPendingDelete(mood.id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {reflection && (
                    <div className="journal-block reflection-entry">
                      {editingReflection?.id === reflection.id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault()
                            onUpdateReflection(editingReflection)
                            setEditingReflection(undefined)
                          }}
                        >
                          <label>
                            Reflection
                            <textarea
                              value={editingReflection.body}
                              onChange={(event) =>
                                setEditingReflection({
                                  ...editingReflection,
                                  body: event.target.value,
                                })
                              }
                              maxLength={4000}
                              rows={4}
                              required
                            />
                          </label>
                          <div className="form-actions">
                            <button className="secondary-button" type="submit">
                              Save
                            </button>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => setEditingReflection(undefined)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <div>
                              <small>{prompt?.family === 'free' ? 'Written freely' : prompt?.text}</small>
                              {reflection.writtenLater && (
                                <small className="written-later">Written later</small>
                              )}
                              <p>{reflection.body}</p>
                            </div>
                          </div>
                          <div className="inline-actions">
                            {onSetStarred && reflection.body && (
                              <StarToggle
                                starred={reflection.starred === true}
                                onChange={(starred) =>
                                  onSetStarred('reflection', reflection.id, starred)
                                }
                              />
                            )}
                            <button
                              className="text-button"
                              onClick={() => setEditingReflection(reflection)}
                            >
                              Edit
                            </button>
                            {pendingDelete === reflection.id ? (
                              <>
                                <span className="delete-prompt" role="alert">
                                  Delete this reflection for good?
                                </span>
                                <button
                                  className="text-button danger-text"
                                  onClick={() => {
                                    onDeleteReflection(reflection.id)
                                    setPendingDelete(undefined)
                                  }}
                                >
                                  Yes, delete
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => setPendingDelete(undefined)}
                                >
                                  Keep
                                </button>
                              </>
                            ) : (
                              <button
                                className="text-button danger-text"
                                onClick={() => setPendingDelete(reflection.id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {recap && (
                    <div className="journal-block recap-entry">
                      {editingRecap?.id === recap.id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault()
                            onUpdateRecap(editingRecap)
                            setEditingRecap(undefined)
                          }}
                        >
                          <label>
                            How the day ended up
                            <select
                              value={editingRecap.level ?? ''}
                              onChange={(event) =>
                                setEditingRecap({
                                  ...editingRecap,
                                  level: event.target.value
                                    ? (Number(
                                        event.target.value,
                                      ) as RecapEntry['level'])
                                    : undefined,
                                })
                              }
                            >
                              <option value="">Not said</option>
                              {moodLevels.map((item) => (
                                <option key={item.level} value={item.level}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            What went well
                            <textarea
                              value={editingRecap.wentWell}
                              onChange={(event) =>
                                setEditingRecap({
                                  ...editingRecap,
                                  wentWell: event.target.value,
                                })
                              }
                              maxLength={400}
                              rows={2}
                            />
                          </label>
                          <label>
                            Set down
                            <textarea
                              value={editingRecap.settingDown}
                              onChange={(event) =>
                                setEditingRecap({
                                  ...editingRecap,
                                  settingDown: event.target.value,
                                })
                              }
                              maxLength={400}
                              rows={2}
                            />
                          </label>
                          <label>
                            For tomorrow
                            <textarea
                              value={editingRecap.forTomorrow}
                              onChange={(event) =>
                                setEditingRecap({
                                  ...editingRecap,
                                  forTomorrow: event.target.value,
                                })
                              }
                              maxLength={TOMORROW_TEXT_LENGTH}
                              rows={3}
                            />
                          </label>
                          <div className="form-actions">
                            <button className="secondary-button" type="submit">
                              Save
                            </button>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => setEditingRecap(undefined)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <Icon name="moon" size={20} />
                            <div>
                              <strong>
                                Rounded out the day
                                {recap.level
                                  ? ` — ${moodNames[recap.level - 1]}`
                                  : ''}
                              </strong>
                              {recap.wentWell && (
                                <p>
                                  <small>What went well</small>
                                  {recap.wentWell}
                                </p>
                              )}
                              {recap.settingDown && (
                                <p>
                                  <small>Set down</small>
                                  {recap.settingDown}
                                </p>
                              )}
                              {tomorrowNotes.length === 1 && (
                                <p>
                                  <small>For tomorrow</small>
                                  {tomorrowNotes[0]}
                                </p>
                              )}
                              {tomorrowNotes.length > 1 && (
                                <div>
                                  <small>For tomorrow</small>
                                  <ul className="tomorrow-list">
                                    {tomorrowNotes.map((note, index) => (
                                      <li key={index}>{note}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {plannedGoalTitles.length > 0 && (
                                <p className="recap-planned">
                                  <Icon name="today" size={16} />
                                  {plannedGoalTitles.length === 1 ? 'Became a goal' : 'Became goals'}:{' '}
                                  {listed(plannedGoalTitles)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="inline-actions">
                            <button
                              className="text-button"
                              onClick={() => setEditingRecap(recap)}
                            >
                              Edit
                            </button>
                            {pendingDelete === recap.id ? (
                              <>
                                <span className="delete-prompt" role="alert">
                                  Delete this recap for good?
                                </span>
                                <button
                                  className="text-button danger-text"
                                  onClick={() => {
                                    onDeleteRecap(recap.id)
                                    setPendingDelete(undefined)
                                  }}
                                >
                                  Yes, delete
                                </button>
                                <button
                                  className="text-button"
                                  onClick={() => setPendingDelete(undefined)}
                                >
                                  Keep
                                </button>
                              </>
                            ) : (
                              <button
                                className="text-button danger-text"
                                onClick={() => setPendingDelete(recap.id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
            {visibleCount < shownDates.length && (
              <button
                className="secondary-button"
                onClick={() =>
                  setVisibleCount((count) => count + TIMELINE_PAGE_SIZE)
                }
              >
                Show earlier days ({shownDates.length - visibleCount} more)
              </button>
            )}
          </div>
        )}
      </section>

      <JournalExport state={state} />
    </div>
  )
}
