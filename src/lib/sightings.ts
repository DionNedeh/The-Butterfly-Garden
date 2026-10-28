import { plants, species } from '../data/content'
import type { Sighting, SightingSubject } from '../types'
import { isLocalDate, toLocalDate } from './date'
import { createId } from './id'
import {
  isSightingPhoto,
  MAX_SIGHTING_PHOTOS,
  MAX_SIGHTINGS,
  photosIn,
} from './customBackdrops'

/*
 * The field book: real butterflies and plants the gardener noticed out in the
 * world (plan c.2). Its rules work on the sightings alone, so writing one
 * down can never touch what is earned: no Sunlight, Nectar or Stardust.
 * Noticing is the point.
 *
 * Loaded with the pages that log or show a sighting, never with the garden's
 * first load; the limits checking a stored garden needs are kept with the
 * personal images' (lib/customBackdrops).
 */

/** "A few words": as long as a check-in's note. */
export const SIGHTING_NOTE_LENGTH = 280

/** What the form hands over: what was seen, when, a few words, perhaps a photo. */
export type SightingInput = SightingSubject & {
  date: string
  note: string
  photo?: Blob
}

/** A sighting just crossed out, with where it was, so Undo can put it back. */
export interface RemovedSighting {
  sighting: Sighting
  index: number
}

/**
 * How the garden lets the field book change (useGardenState's
 * changeSightings): `change` maps the sightings to new ones, as of `now`,
 * or hands back the same list to change nothing. True when the garden took it.
 */
export interface ChangeSightings {
  (change: (sightings: Sighting[], now: Date) => Sighting[]): boolean
  /**
   * Once a photo the last change brought is stored: ok, or not, when it
   * would not go in, and the garden has taken it back out (usePersistence),
   * so the rest of the garden still saves. Where it is missing (a stand-in
   * garden), a change is taken as kept as soon as it is made.
   */
  photoSaved?: (photo: Blob) => Promise<{ ok: boolean; message?: string }>
}

/** What the field book says of a new photo that could not be stored. */
export const PHOTO_NOT_KEPT = 'The photo could not be stored on this device, so it was not kept.'

/** What the Journal and the Guide can do with the field book. */
export interface FieldBookActions {
  /** Write a sighting down: its id, or undefined when it was refused. */
  log: (input: SightingInput) => string | undefined
  edit: (id: string, input: SightingInput) => boolean
  /** Cross one out: what Undo needs, or undefined when it was not there. */
  remove: (id: string) => RemovedSighting | undefined
  restore: (removed: RemovedSighting) => boolean
  /** Whether a new photo just logged or added reached storage (ChangeSightings). */
  photoSaved: (photo: Blob) => Promise<boolean>
}

const SPECIES_NAMES = new Map(species.map((item) => [item.id, item.commonName]))
const PLANT_NAMES = new Map(plants.map((item) => [item.id, item.name]))

/** The name the field guide gives what was seen, or undefined for one it does not know. */
export function subjectName(subject: SightingSubject): string | undefined {
  return subject.kind === 'butterfly'
    ? SPECIES_NAMES.get(subject.speciesId)
    : PLANT_NAMES.get(subject.plantId)
}

/** Just what was seen, from a sighting or anything else that names it. */
export function subjectOf(subject: SightingSubject): SightingSubject {
  return subject.kind === 'butterfly'
    ? { kind: 'butterfly', speciesId: subject.speciesId }
    : { kind: 'plant', plantId: subject.plantId }
}

/** One key for a butterfly or plant, the same for every sighting of it: "plant:milkweed". */
export function subjectKey(subject: SightingSubject): string {
  return subject.kind === 'butterfly'
    ? `butterfly:${subject.speciesId}`
    : `plant:${subject.plantId}`
}

/**
 * Why a sighting cannot be kept as it is, in words, or undefined when it
 * can: `editing` names the one it would replace. The form asks first, so it
 * can say why; the changes below ask again and change nothing on an answer.
 */
export function sightingProblem(
  sightings: readonly Sighting[],
  input: SightingInput,
  today: string,
  editing?: string,
): string | undefined {
  if (!subjectName(input)) return 'Choose a butterfly or a plant from the list.'
  if (!isLocalDate(input.date)) return 'Choose the day you saw it.'
  if (input.date > today) return 'Choose today or an earlier day: the field book keeps what has been seen.'
  if (input.photo !== undefined && !isSightingPhoto(input.photo))
    return 'That photo could not be kept. Try choosing it again.'
  const existing = editing ? sightings.find((item) => item.id === editing) : undefined
  if (editing && !existing) return 'That sighting is no longer in your field book.'
  if (!existing && sightings.length >= MAX_SIGHTINGS)
    return `Your field book is full: it keeps ${MAX_SIGHTINGS.toLocaleString()} sightings. Delete one to make room for another.`
  if (input.photo && !existing?.photo && photosIn(sightings).count >= MAX_SIGHTING_PHOTOS)
    return `Your field book already keeps ${MAX_SIGHTING_PHOTOS} photos, as many as it can. Remove one to add another, or save this without its photo.`
  return undefined
}

/** A sighting as it is stored: a short note trimmed, and no empty one. */
function written(input: SightingInput, id: string, createdAt: string): Sighting {
  const note = input.note.trim().slice(0, SIGHTING_NOTE_LENGTH)
  return {
    id,
    date: input.date,
    ...subjectOf(input),
    ...(note ? { note } : {}),
    ...(input.photo ? { photo: input.photo } : {}),
    createdAt,
  }
}

/** Whether two sightings say the same thing, the photo compared as the same Blob. */
function sameSighting(a: Sighting, b: Sighting): boolean {
  return (
    a.date === b.date &&
    subjectKey(a) === subjectKey(b) &&
    a.note === b.note &&
    a.photo === b.photo
  )
}

/** Write a sighting down, as of `now`. The same list when it cannot be kept. */
export function logSighting(
  sightings: Sighting[],
  input: SightingInput,
  now: Date,
  id: string = createId(),
): Sighting[] {
  if (sightingProblem(sightings, input, toLocalDate(now))) return sightings
  if (sightings.some((item) => item.id === id)) return sightings
  return [...sightings, written(input, id, now.toISOString())]
}

/** Change what a sighting says, keeping its place and when it was first written. */
export function editSighting(
  sightings: Sighting[],
  id: string,
  input: SightingInput,
  now: Date,
): Sighting[] {
  const index = sightings.findIndex((item) => item.id === id)
  if (index === -1 || sightingProblem(sightings, input, toLocalDate(now), id)) return sightings
  const before = sightings[index]
  const after = written(input, id, before.createdAt)
  if (sameSighting(before, after)) return sightings
  return sightings.map((item, at) => (at === index ? after : item))
}

/** Cross a sighting out, photo and all. */
export function deleteSighting(sightings: Sighting[], id: string): Sighting[] {
  if (!sightings.some((item) => item.id === id)) return sightings
  return sightings.filter((item) => item.id !== id)
}

/**
 * Put back a sighting just crossed out, where it was: Undo. Not when it is
 * already there, nor when the field book has filled up meanwhile.
 */
export function restoreSighting(
  sightings: Sighting[],
  { sighting, index }: RemovedSighting,
): Sighting[] {
  if (sightings.some((item) => item.id === sighting.id)) return sightings
  if (sightings.length >= MAX_SIGHTINGS) return sightings
  if (sighting.photo && photosIn(sightings).count >= MAX_SIGHTING_PHOTOS) return sightings
  const restored = [...sightings]
  restored.splice(Math.min(Math.max(index, 0), restored.length), 0, sighting)
  return restored
}

/** The field book's actions, each made through the garden's `change`. */
export function fieldBookActions(change: ChangeSightings): FieldBookActions {
  return {
    log: (input) => {
      const id = createId()
      return change((sightings, now) => logSighting(sightings, input, now, id)) ? id : undefined
    },
    edit: (id, input) => change((sightings, now) => editSighting(sightings, id, input, now)),
    remove: (id) => {
      // Taken from the list the change is first worked out on.
      let removed: RemovedSighting | undefined
      const crossedOut = change((sightings) => {
        const index = sightings.findIndex((item) => item.id === id)
        if (index !== -1) removed ??= { sighting: sightings[index], index }
        return deleteSighting(sightings, id)
      })
      return crossedOut ? removed : undefined
    },
    restore: (removed) => change((sightings) => restoreSighting(sightings, removed)),
    photoSaved: async (photo) => (await change.photoSaved?.(photo))?.ok ?? true,
  }
}

/** When a butterfly or plant was last seen in the wild, and how often. */
export interface WildRecord {
  /** The latest day it was seen (YYYY-MM-DD). */
  latest: string
  count: number
}

/** Every butterfly and plant seen in the wild, by subjectKey. */
export function seenInTheWild(sightings: readonly Sighting[]): Map<string, WildRecord> {
  const seen = new Map<string, WildRecord>()
  for (const sighting of sightings) {
    const key = subjectKey(sighting)
    const known = seen.get(key)
    seen.set(
      key,
      known
        ? {
            latest: sighting.date > known.latest ? sighting.date : known.latest,
            count: known.count + 1,
          }
        : { latest: sighting.date, count: 1 },
    )
  }
  return seen
}

/**
 * The field book newest first: by the day seen, and on one day, by when each
 * was written down.
 */
export function newestFirst(sightings: readonly Sighting[]): Sighting[] {
  return [...sightings].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}
