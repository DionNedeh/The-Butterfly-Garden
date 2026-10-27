import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { prepareSightingPhoto } from '../../lib/imageImport'
import { counted } from '../../lib/plural'
import { searchWords } from '../../lib/searchText'
import { matchingChoices, subjectChoices } from '../../lib/sightingChoices'
import { MAX_SIGHTING_PHOTOS, MAX_SIGHTINGS, photosIn } from '../../lib/customBackdrops'
import {
  SIGHTING_NOTE_LENGTH,
  sightingProblem,
  subjectKey,
  subjectOf,
  type SightingInput,
} from '../../lib/sightings'
import type { RegionId, Sighting, SightingSubject } from '../../types'
import { LookForLine } from './LookForLine'
import { PhotoImage } from './PhotoImage'
import './sightings.css'

type Kind = SightingSubject['kind']

/** How the form speaks of each kind of thing seen. */
const KIND_WORDS: Record<Kind, { one: string; many: string }> = {
  butterfly: { one: 'butterfly', many: 'butterflies' },
  plant: { one: 'plant', many: 'plants' },
}

/**
 * Bring the choice made into sight within its own scrolling list, as little
 * as it takes, or start the list at its top when none is made. Measured and
 * scrolled by hand, because scrollIntoView would move the dialog and the page
 * too, taking the focused heading out of view on a short screen.
 */
function showChoiceIn(list: HTMLElement | null) {
  if (!list) return
  const row = list.querySelector('input:checked')?.closest('label')
  if (!row) {
    list.scrollTop = 0
    return
  }
  // The list's own window onto its rows: inside its border.
  const top = list.getBoundingClientRect().top + list.clientTop
  const bottom = top + list.clientHeight
  const box = row.getBoundingClientRect()
  if (box.top < top) list.scrollTop -= top - box.top
  // On until its foot is in sight, though never past its head, so a row
  // taller than the list (a long name at the largest text) shows its name.
  else if (box.bottom > bottom) list.scrollTop += Math.min(box.bottom - bottom, box.top - top)
}

/**
 * Log a sighting, or change one: what was seen, from the field guide, the
 * day, a few words, and a photo if the gardener likes. A modal dialog, so
 * Escape and Android's back gesture put it away like any other (through its
 * cancel event; see lib/backNavigation), except while a photo is being
 * prepared. Loaded only when it is opened.
 */
export default function SightingForm({
  sightings,
  region,
  today,
  editing,
  subject,
  onSave,
  onClose,
}: {
  /** The field book as it is, for its limits. */
  sightings: readonly Sighting[]
  region?: RegionId
  today: string
  /** The sighting being changed; without it, a new one is logged. */
  editing?: Sighting
  /** What a new one starts on: the butterfly or plant whose card opened the form. */
  subject?: SightingSubject
  /** Keep it: false when the garden would not. */
  onSave: (input: SightingInput) => boolean
  /** The form has closed: `saved` when what it held was kept. */
  onClose: (saved: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const choiceList = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const ids = useId()
  const start = editing ?? subject
  const [kind, setKind] = useState<Kind>(start?.kind ?? 'butterfly')
  // What is chosen, kept for each kind, so a look at the plants loses no butterfly.
  const [chosen, setChosen] = useState<Partial<Record<Kind, SightingSubject>>>(
    start ? { [start.kind]: subjectOf(start) } : {},
  )
  const [query, setQuery] = useState('')
  const [date, setDate] = useState(editing?.date ?? today)
  const [note, setNote] = useState(editing?.note ?? '')
  const [photo, setPhoto] = useState<Blob | undefined>(editing?.photo)
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState('')
  // Only a photo being prepared keeps the form open: saving is at once.
  const busy = preparing
  // A photo chosen after the form has gone is let go of, not shown.
  const sequence = useRef(0)

  useEffect(() => {
    dialog.current?.showModal()
    heading.current?.focus()
    const token = sequence
    return () => {
      token.current += 1
    }
  }, [])

  // Opened on a butterfly or plant, from its card or a sighting being
  // changed, the list shows it checked, wherever it sorts; and again when the
  // kind changes. After the effect above, so the dialog is open to measure.
  useEffect(() => {
    showChoiceIn(choiceList.current)
  }, [kind])

  const choices = useMemo(() => subjectChoices(kind, region), [kind, region])
  const words = searchWords(query)
  const current = chosen[kind]
  const currentKey = current && subjectKey(current)
  const matches = matchingChoices(choices, words)
  // The choice already made stays in view whatever the search hides.
  const chosenChoice = choices.find((item) => item.key === currentKey)
  const shown =
    chosenChoice && !matches.includes(chosenChoice) ? [chosenChoice, ...matches] : matches
  const kindWords = KIND_WORDS[kind]

  const photoCount = photosIn(sightings).count
  const roomForPhoto = editing?.photo !== undefined || photoCount < MAX_SIGHTING_PHOTOS
  const full = !editing && sightings.length >= MAX_SIGHTINGS

  const close = (saved = false) => {
    if (busy) return
    dialog.current?.close()
    onClose(saved)
  }

  const choosePhoto = async (file: File) => {
    const ticket = ++sequence.current
    setPreparing(true)
    setProblem('')
    try {
      const prepared = await prepareSightingPhoto(file)
      if (ticket === sequence.current) setPhoto(prepared)
    } catch (cause) {
      if (ticket === sequence.current)
        setProblem(cause instanceof Error ? cause.message : 'That photo could not be read.')
    } finally {
      if (ticket === sequence.current) setPreparing(false)
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!current) {
      setProblem(`Choose a ${kindWords.one} from the list.`)
      return
    }
    const input: SightingInput = { ...current, date, note, ...(photo ? { photo } : {}) }
    const why = sightingProblem(sightings, input, today, editing?.id)
    if (why) {
      setProblem(why)
      return
    }
    if (onSave(input)) close(true)
    else setProblem('That sighting could not be saved just now. Please try again.')
  }

  return (
    <dialog
      ref={dialog}
      className="garden-dialog sighting-form"
      aria-labelledby={`${ids}-title`}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      {/* Its own words for what is missing, rather than the browser's. */}
      <form onSubmit={save} noValidate>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">Seen in the wild</p>
            <h2 id={`${ids}-title`} ref={heading} tabIndex={-1}>
              {editing ? 'Change this sighting' : 'Log a sighting'}
            </h2>
          </div>
        </div>
        <LookForLine region={region} today={today} />
        <p className="sighting-gently">
          Watch from a little way off: nothing needs to be caught or touched to
          be noted here.
        </p>
        {full && (
          <p className="settings-note">
            Your field book is full: it keeps {MAX_SIGHTINGS.toLocaleString()} sightings.
            Delete one in the Journal to make room for another.
          </p>
        )}

        <fieldset className="sighting-kinds">
          <legend>What did you see?</legend>
          {(['butterfly', 'plant'] as const).map((option) => (
            <label key={option}>
              <input
                type="radio"
                name={`${ids}-kind`}
                value={option}
                checked={kind === option}
                onChange={() => {
                  setKind(option)
                  setQuery('')
                  setProblem('')
                }}
              />
              {option === 'butterfly' ? 'A butterfly' : 'A plant'}
            </label>
          ))}
        </fieldset>

        <label className="sighting-search">
          Find a {kindWords.one}
          <input
            type="search"
            value={query}
            placeholder={kind === 'butterfly' ? 'Try Monarch or Lady…' : 'Try Milkweed or Violet…'}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <fieldset className="sighting-choices">
          <legend>Which {kindWords.one}?</legend>
          {region && region !== 'elsewhere' && (
            <p className="subtle-copy">Those that live where you garden come first.</p>
          )}
          <div className="sighting-choice-list" ref={choiceList}>
            {shown.map((item) => (
              <label key={item.key} className="sighting-choice">
                <input
                  type="radio"
                  name={`${ids}-subject`}
                  value={item.key}
                  checked={item.key === currentKey}
                  onChange={() => {
                    setChosen((before) => ({ ...before, [kind]: item.subject }))
                    setProblem('')
                  }}
                />
                <span>
                  {item.name}
                  {item.mark && (
                    <>
                      {' '}
                      <small>{item.mark.label}</small>
                    </>
                  )}
                </span>
              </label>
            ))}
          </div>
          <p className="subtle-copy" role="status">
            {words.length === 0
              ? ''
              : matches.length
                ? `${counted(matches.length, kindWords.one, kindWords.many)} found.`
                : `No ${kindWords.one} by that name. Try another word.`}
          </p>
        </fieldset>

        <label>
          The day you saw it
          <input
            type="date"
            value={date}
            max={today}
            required
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          A few words, if you like
          <input
            value={note}
            maxLength={SIGHTING_NOTE_LENGTH}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <div className="sighting-photo">
          {photo && (
            <div className="sighting-photo-preview">
              <PhotoImage photo={photo} alt="Your photo for this sighting" />
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setPhoto(undefined)
                  // The button goes with the photo; the way to add one stays.
                  fileInput.current?.focus()
                }}
              >
                Remove photo
              </button>
            </div>
          )}
          {roomForPhoto ? (
            <label className="image-upload">
              {photo ? 'Choose a different photo' : 'Add a photo, if you like'}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void choosePhoto(file)
                }}
              />
            </label>
          ) : (
            <p className="subtle-copy">
              Your field book keeps {MAX_SIGHTING_PHOTOS} photos, and has them
              all. Remove one from another sighting to add one here.
            </p>
          )}
          <p className="subtle-copy">
            A smaller copy stays on this device and in your backups. Nothing
            about where it was taken is kept.
          </p>
          <p className="subtle-copy" role="status">
            {preparing ? 'Preparing your photo…' : ''}
          </p>
        </div>

        <p className="sighting-problem" role="alert">
          {problem}
        </p>
        <div className="form-actions">
          <button className="primary-button" type="submit" aria-disabled={busy}>
            {editing ? 'Save changes' : 'Save sighting'}
          </button>
          <button
            className="secondary-button"
            type="button"
            aria-disabled={busy}
            onClick={() => close()}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
