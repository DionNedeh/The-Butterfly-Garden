import { describe, expect, it } from 'vitest'
import { toLocalDate } from './date'
import { saveMood, saveReflection, updateMood } from './gardenActions'
import { createInitialState } from './progression'
import { setStarred } from './letters'

const NOW = new Date(2026, 9, 21, 18)
const today = toLocalDate(NOW)

function written() {
  const garden = createInitialState('Tester', 'Test Garden', new Date(2026, 8, 1, 9))
  const once = saveReflection(saveMood(garden, 4, 'The light on the river', NOW), 'notice', 'A kind word', NOW)
  const mood = once.moods.find((entry) => entry.localDate === today)!
  const reflection = once.reflections.find((entry) => entry.localDate === today)!
  return setStarred(setStarred(once, 'check-in', mood.id, true), 'reflection', reflection.id, true)
}

describe('a star through a rewrite on Today', () => {
  it('stays while the words do', () => {
    const later = new Date(2026, 9, 21, 20)
    // The weather changed; the note did not.
    const again = saveReflection(saveMood(written(), 2, 'The light on the river ', later), 'notice', 'A kind word', later)
    expect(again.moods.find((entry) => entry.localDate === today)?.starred).toBe(true)
    expect(again.reflections.find((entry) => entry.localDate === today)?.starred).toBe(true)
  })

  it('goes with the words: new words were not the ones chosen', () => {
    const later = new Date(2026, 9, 21, 20)
    const again = saveReflection(saveMood(written(), 4, 'A hard evening', later), 'notice', 'Something else', later)
    expect(again.moods.find((entry) => entry.localDate === today)).not.toHaveProperty('starred')
    expect(again.reflections.find((entry) => entry.localDate === today)).not.toHaveProperty('starred')
  })

  it('stays through an edit in the Journal, where the star is shown beside the words', () => {
    const garden = written()
    const mood = garden.moods.find((entry) => entry.localDate === today)!
    const edited = updateMood(garden, { ...mood, note: 'The light on the river, again' }, NOW)
    expect(edited.moods.find((entry) => entry.id === mood.id)?.starred).toBe(true)
  })
})
