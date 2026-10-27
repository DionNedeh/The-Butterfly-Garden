import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { formatDayInWords } from '../../lib/fieldNotes'
import {
  fieldBookActions,
  newestFirst,
  PHOTO_NOT_KEPT,
  subjectName,
  type ChangeSightings,
  type SightingInput,
} from '../../lib/sightings'
import type { AppState, Sighting } from '../../types'
import { UndoToast, type UndoOffer } from '../UndoToast'
import { LookForLine } from './LookForLine'
import { NatureProjects } from './NatureProjects'
import { PhotoImage } from './PhotoImage'
import './sightings.css'

const SightingForm = lazy(() => import('./SightingForm'))

/** The field book is paged, newest first, as the journal's timeline is. */
const PAGE_SIZE = 10

/**
 * "Seen in the wild": the Journal's field book of real butterflies and plants
 * (plan c.2). Log one, change it, or cross it out with a few seconds to undo.
 * Loaded when the field notes are opened.
 */
export default function FieldBook({
  state,
  today,
  onChangeSightings,
}: {
  state: AppState
  today: string
  onChangeSightings: ChangeSightings
}) {
  const actions = useMemo(() => fieldBookActions(onChangeSightings), [onChangeSightings])
  const region = state.profile?.region
  const ordered = useMemo(() => newestFirst(state.sightings), [state.sightings])
  const [pages, setPages] = useState(1)
  const [form, setForm] = useState<{ editing?: Sighting }>()
  const [offer, setOffer] = useState<UndoOffer>()
  const [status, setStatus] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  // A sighting to give focus to once it is drawn: one just saved, put back,
  // or the first of a page just shown. Each is a request of its own, so the
  // same sighting can be asked for twice.
  const [focusRequest, setFocusRequest] = useState<{ id: string; serial: number }>()
  const answered = useRef(0)
  const focusSighting = (id: string) =>
    setFocusRequest((previous) => ({ id, serial: (previous?.serial ?? 0) + 1 }))
  // Shown far enough down that the sighting asked for is drawn, wherever its
  // day puts it in the book.
  const wantedAt = focusRequest ? ordered.findIndex((item) => item.id === focusRequest.id) : -1
  const shownCount = Math.max(pages * PAGE_SIZE, wantedAt + 1)
  const shown = ordered.slice(0, shownCount)
  useEffect(() => {
    if (!focusRequest || answered.current === focusRequest.serial) return
    const entry = document.getElementById(`sighting-${focusRequest.id}`)
    if (!entry) return
    answered.current = focusRequest.serial
    entry.focus()
  }, [focusRequest, shown])

  const openForm = (button: HTMLElement, editing?: Sighting) => {
    opener.current = button
    setStatus('')
    setForm({ editing })
  }

  /**
   * Say a change is saved: at once, or, when it brought a new photo, once
   * the photo is stored, which a full device can refuse.
   */
  const sayWhenSaved = (words: string, photo?: Blob) => {
    setStatus(photo ? '' : words)
    if (photo) void actions.photoSaved(photo).then((kept) => setStatus(kept ? words : PHOTO_NOT_KEPT))
  }

  const save = (input: SightingInput, editing?: Sighting): boolean => {
    const newPhoto = input.photo !== editing?.photo ? input.photo : undefined
    if (editing) {
      const changed = actions.edit(editing.id, input)
      // Nothing changed is still a sighting kept as the gardener wants it.
      if (changed || state.sightings.some((item) => item.id === editing.id)) {
        focusSighting(editing.id)
        if (changed) sayWhenSaved('Your changes are saved.', newPhoto)
        else setStatus('Nothing needed changing.')
        return true
      }
      return false
    }
    const id = actions.log(input)
    if (!id) return false
    focusSighting(id)
    sayWhenSaved('Saved to your field book.', newPhoto)
    return true
  }

  const remove = (sighting: Sighting) => {
    const removed = actions.remove(sighting.id)
    if (!removed) return
    // The entry, and the button pressed, are going.
    heading.current?.focus()
    setStatus('')
    const name = subjectName(sighting) ?? 'A sighting'
    setOffer({
      message: `${name}, ${formatDayInWords(sighting.date)}, deleted.`,
      undo: () => {
        // The toast goes with its button: focus goes to the sighting put
        // back, or stays with the field book when there was no room.
        heading.current?.focus()
        if (actions.restore(removed)) focusSighting(removed.sighting.id)
        else setStatus('There is no room to put it back: the field book filled up meanwhile.')
      },
    })
  }

  return (
    <section className="field-book" aria-labelledby="field-book-title">
      <div className="field-book-heading">
        <div>
          <p className="eyebrow">Your field book</p>
          <h2 id="field-book-title" ref={heading} tabIndex={-1}>
            Seen in the wild
          </h2>
        </div>
        <button
          className="secondary-button sighting-log"
          onClick={(event) => openForm(event.currentTarget)}
        >
          Log a sighting
        </button>
      </div>
      <p>
        Real butterflies and plants you noticed out in the world. They earn
        nothing here: noticing is the point.
      </p>
      <LookForLine region={region} today={today} />
      <p className="subtle-copy" role="status">
        {status}
      </p>
      {ordered.length === 0 ? (
        <p className="field-book-empty">
          Nothing written down yet. The next butterfly or plant you stop to
          notice could be the first.
        </p>
      ) : (
        <ol className="field-book-list">
          {shown.map((sighting) => {
            const name = subjectName(sighting) ?? 'Unknown'
            const day = formatDayInWords(sighting.date)
            return (
              <li className="field-book-entry" key={sighting.id}>
                {sighting.photo && (
                  <PhotoImage
                    className="field-book-photo"
                    photo={sighting.photo}
                    alt={`Your photo of ${name}`}
                  />
                )}
                <div>
                  <h3 id={`sighting-${sighting.id}`} tabIndex={-1}>
                    {name}
                  </h3>
                  <p className="field-book-meta">
                    {sighting.kind === 'butterfly' ? 'A butterfly' : 'A plant'} ·{' '}
                    <time dateTime={sighting.date}>{day}</time>
                  </p>
                  {sighting.note && <p className="field-book-note">{sighting.note}</p>}
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      aria-label={`Edit ${name}, ${day}`}
                      onClick={(event) => openForm(event.currentTarget, sighting)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button danger-text"
                      aria-label={`Delete ${name}, ${day}`}
                      onClick={() => remove(sighting)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {shownCount < ordered.length && (
        <button
          className="secondary-button"
          onClick={() => {
            // The first newly shown takes focus, in case this button goes.
            const next = ordered[shownCount]
            setPages(Math.ceil(shownCount / PAGE_SIZE) + 1)
            focusSighting(next.id)
          }}
        >
          Show earlier sightings ({ordered.length - shownCount} more)
        </button>
      )}
      <NatureProjects region={region} />
      <UndoToast offer={offer} onDone={() => setOffer(undefined)} />
      {form && (
        <Suspense fallback={null}>
          <SightingForm
            sightings={state.sightings}
            region={region}
            today={today}
            editing={form.editing}
            onSave={(input) => save(input, form.editing)}
            onClose={(saved) => {
              setForm(undefined)
              // Saved, focus goes to the sighting; otherwise, back where it came from.
              if (!saved) opener.current?.focus()
            }}
          />
        </Suspense>
      )}
    </section>
  )
}
