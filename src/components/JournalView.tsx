import { useMemo, useState } from 'react'
import { reflectionPrompts, species } from '../data/content'
import { formatJournalDate } from '../lib/date'
import type { AppState, MoodEntry, ReflectionEntry } from '../types'
import { Butterfly } from './Butterfly'

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

  return (
    <div className="view journal-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Private to this device</p>
          <h1>Journal</h1>
          <p>Your words are kept as you wrote them, without scores or analysis.</p>
        </div>
      </header>

      <section className="card field-notes" aria-labelledby="species-journal-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Field notes</p>
            <h2 id="species-journal-title">Butterflies welcomed</h2>
          </div>
          <span className="count-badge">{emerged.length} / {species.length}</span>
        </div>
        <div className="species-grid">
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
                  {creature && <p>{definition.fact}</p>}
                </div>
              </article>
            )
          })}
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
