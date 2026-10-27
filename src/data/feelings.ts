import type { EnergyLevel } from '../types'

/**
 * Words for how a day feels, offered beside the check-in's weather.
 *
 * Naming a feeling is a mild help in itself, and accepting a difficult one
 * goes with feeling better over time, so the list holds as many difficult
 * words as comfortable ones: nine of each. They are in alphabetical order, so
 * neither kind comes first, and every one is shown the same way. No feeling
 * is a better answer than another.
 *
 * A check-in stores the id, never the wording, so a word can be reworded (or
 * one day translated) without touching the journal. Never reuse an id for a
 * different word: a stored id this build does not know is dropped on load.
 */
export interface Feeling {
  id: string
  /** The word as the chip, the journal and the exports show it. */
  name: string
}

export const feelings: readonly Feeling[] = [
  { id: 'anxious', name: 'anxious' },
  { id: 'calm', name: 'calm' },
  { id: 'content', name: 'content' },
  { id: 'curious', name: 'curious' },
  { id: 'frustrated', name: 'frustrated' },
  { id: 'grateful', name: 'grateful' },
  { id: 'hopeful', name: 'hopeful' },
  { id: 'joyful', name: 'joyful' },
  { id: 'lonely', name: 'lonely' },
  { id: 'numb', name: 'numb' },
  { id: 'overwhelmed', name: 'overwhelmed' },
  { id: 'peaceful', name: 'peaceful' },
  { id: 'proud', name: 'proud' },
  { id: 'relieved', name: 'relieved' },
  { id: 'restless', name: 'restless' },
  { id: 'sad', name: 'sad' },
  { id: 'tender', name: 'tender' },
  { id: 'tired', name: 'tired' },
]

/** The energy question's three steps, lowest first. */
export const energyLevels: ReadonlyArray<{ id: EnergyLevel; name: string }> = [
  { id: 'low', name: 'low' },
  { id: 'steady', name: 'steady' },
  { id: 'bright', name: 'bright' },
]
