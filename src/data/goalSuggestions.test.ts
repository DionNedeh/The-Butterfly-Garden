import { describe, expect, it } from 'vitest'
import { GOAL_TITLE_LENGTH } from '../lib/gardenActions'
import { goalSuggestions, WELLBEING_TAGS } from './goalSuggestions'

describe('ideas for goals', () => {
  it('has a few for every part of wellbeing, and no part left out', () => {
    for (const tag of WELLBEING_TAGS) {
      expect(goalSuggestions.filter((idea) => idea.tag === tag)).toHaveLength(4)
    }
    expect(goalSuggestions.every((idea) => WELLBEING_TAGS.includes(idea.tag))).toBe(true)
  })

  it('offers each idea once, however it is written', () => {
    const titles = goalSuggestions.map((idea) => idea.title.trim().toLocaleLowerCase())
    expect(new Set(titles).size).toBe(goalSuggestions.length)
  })

  it('makes each two-minute version smaller than the goal, and different from it', () => {
    for (const idea of goalSuggestions) {
      if (idea.tinyTitle === undefined) continue
      expect(idea.tinyTitle.length, idea.title).toBeLessThan(idea.title.length)
      expect(idea.tinyTitle.toLocaleLowerCase()).not.toBe(idea.title.toLocaleLowerCase())
    }
  })

  it('gives most a two-minute version, and none to medication', () => {
    const withTiny = goalSuggestions.filter((idea) => idea.tinyTitle)
    expect(withTiny.length).toBeGreaterThanOrEqual(goalSuggestions.length * 0.75)
    expect(
      goalSuggestions.find((idea) => idea.title === 'Take prescribed medication')?.tinyTitle,
    ).toBeUndefined()
  })

  it('fits every idea in a goal title, written as a gardener would see it', () => {
    for (const idea of goalSuggestions) {
      for (const text of [idea.title, idea.tinyTitle ?? idea.title]) {
        expect(text).toBe(text.trim())
        expect(text.length).toBeLessThanOrEqual(GOAL_TITLE_LENGTH)
        // A plain sentence, without a full stop, starting with a capital.
        expect(text).toMatch(/^[A-Z][^.!?]*$/)
      }
    }
  })
})
