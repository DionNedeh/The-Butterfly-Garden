import { useEffect, useMemo, useState } from 'react'
import { reflectionPrompts, species } from '../data/content'
import { formatJournalDate, toLocalDate } from '../lib/date'
import { calculateSunlightStreak } from '../lib/streak'
import type { AppState, MoodEntry, ReflectionEntry } from '../types'
import { Butterfly } from './Butterfly'
import { Icon } from './Icons'

const moodNames = ['Stormy', 'Rainy', 'Overcast', 'Bright', 'Radiant']

export function JournalView({
  state,
  onUpdateMood,
  onDeleteMood,
  onUpdateReflection,
  onDeleteReflection,
}: {
  state: AppState
  onUpdateMood: (entry: MoodEntry) => void
  onDeleteMood: (id: string) => void
  onUpdateReflection: (entry: ReflectionEntry) => void
  onDeleteReflection: (id: string) => void
}) {
  const [editingReflection, setEditingReflection] = useState<ReflectionEntry>()
  const [editingMood, setEditingMood] = useState<MoodEntry>()
  const [today, setToday] = useState(toLocalDate)
  useEffect(() => {
    const refreshDate = () => setToday(toLocalDate())
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshDate()
    }
    const interval = window.setInterval(refreshDate, 60_000)
    window.addEventListener('focus', refreshDate)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshDate)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])
  const dates = useMemo(
    () =>
      Array.from(
        new Set([
          ...state.moods.map((entry) => entry.localDate),
          ...state.reflections.map((entry) => entry.localDate),
        ]),
      ).sort((a, b) => b.localeCompare(a)),
    [state.moods, state.reflections],
  )
  const emerged = state.creatures.filter((creature) => creature.stage === 'emerged')
  const streak = useMemo(
    () => calculateSunlightStreak(state.sunlight, today),
    [state.sunlight, today],
  )

  return (
    <div className="view journal-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Private to this device</p>
          <h1>Journal</h1>
          <p>Your words are kept as you wrote them, without scores or analysis.</p>
        </div>
      </header>

      <details className="card field-notes">
        <summary>
          <span>
            <span className="eyebrow">Field notes</span>
            <strong id="species-journal-title">Butterflies welcomed</strong>
          </span>
          <span className="count-badge">{emerged.length} / {species.length}</span>
        </summary>
        <div className="species-grid" aria-labelledby="species-journal-title">
          {species.map((definition) => {
            const creature = emerged.find(
              (item) => item.speciesId === definition.id,
            )
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
                  <div className="unknown-butterfly" aria-label="Not yet discovered">
                    <span className="unknown-wing unknown-wing-left" />
                    <span className="unknown-wing unknown-wing-right" />
                    <span className="unknown-body" />
                  </div>
                )}
                <div>
                  <strong>{definition.commonName}</strong>
                  <em>{creature ? definition.scientificName : 'Not yet welcomed'}</em>
                  {creature && <small>Welcomed as {creature.name}</small>}
                  {creature && <p>{definition.fact}</p>}
                </div>
              </article>
            )
          })}
        </div>
      </details>

      <section className="card streak-card" aria-labelledby="streak-title">
        <div className="streak-icon">
          <Icon name="sun" size={30} />
        </div>
        <div className="streak-copy">
          <p className="eyebrow">Daily care</p>
          <h2 id="streak-title">Sunlight streak</h2>
          <p>
            One Sunlight keeps your streak growing. Miss a full local calendar
            day and it begins again.
          </p>
        </div>
        <div className="streak-count" aria-label={`${streak.days} day streak`}>
          <strong>{streak.days}</strong>
          <span>{streak.days === 1 ? 'day' : 'days'}</span>
          <small>
            {streak.completedToday
              ? 'Today is counted'
              : streak.days > 0
                ? 'Earn Sunlight today'
                : 'Begin with one Sunlight'}
          </small>
        </div>
      </section>

      <section aria-labelledby="timeline-title">
        <div className="section-heading timeline-heading">
          <div>
            <p className="eyebrow">Your days</p>
            <h2 id="timeline-title">Journal timeline</h2>
          </div>
        </div>
        {dates.length === 0 ? (
          <div className="card empty-state">
            <p>Your first check-in or reflection will appear here.</p>
          </div>
        ) : (
          <div className="timeline">
            {dates.map((date) => {
              const mood = state.moods.find((entry) => entry.localDate === date)
              const reflection = state.reflections.find(
                (entry) => entry.localDate === date,
              )
              const prompt = reflectionPrompts.find(
                (item) => item.id === reflection?.promptId,
              )
              return (
                <article className="card timeline-entry" key={date}>
                  <time dateTime={date}>{formatJournalDate(date)}</time>
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
                              value={editingMood.level}
                              onChange={(event) =>
                                setEditingMood({
                                  ...editingMood,
                                  level: Number(event.target.value) as MoodEntry['level'],
                                })
                              }
                            >
                              {moodNames.map((name, index) => (
                                <option key={name} value={index + 1}>{name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Note
                            <input
                              value={editingMood.note}
                              onChange={(event) =>
                                setEditingMood({ ...editingMood, note: event.target.value })
                              }
                            />
                          </label>
                          <div className="form-actions">
                            <button className="secondary-button" type="submit">Save</button>
                            <button className="text-button" type="button" onClick={() => setEditingMood(undefined)}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <span className={`weather small weather-${mood.level}`} aria-hidden="true" />
                            <div>
                              <strong>{moodNames[mood.level - 1]}</strong>
                              {mood.note && <p>{mood.note}</p>}
                            </div>
                          </div>
                          <div className="inline-actions">
                            <button className="text-button" onClick={() => setEditingMood(mood)}>Edit</button>
                            <button className="text-button danger-text" onClick={() => onDeleteMood(mood.id)}>Delete</button>
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
                              rows={4}
                              required
                            />
                          </label>
                          <div className="form-actions">
                            <button className="secondary-button" type="submit">Save</button>
                            <button className="text-button" type="button" onClick={() => setEditingReflection(undefined)}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <div>
                              <small>{prompt?.text}</small>
                              <p>{reflection.body}</p>
                            </div>
                          </div>
                          <div className="inline-actions">
                            <button className="text-button" onClick={() => setEditingReflection(reflection)}>Edit</button>
                            <button className="text-button danger-text" onClick={() => onDeleteReflection(reflection.id)}>Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
