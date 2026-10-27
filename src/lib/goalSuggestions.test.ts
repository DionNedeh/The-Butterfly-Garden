import { describe, expect, it } from 'vitest'
import { goalSuggestions, WELLBEING_TAGS, type GoalSuggestion } from '../data/goalSuggestions'
import { balancedSuggestions, openSuggestions } from './goalSuggestions'

const tags = (ideas: readonly GoalSuggestion[]) => ideas.map((idea) => idea.tag)
const titlesOf = (tag: GoalSuggestion['tag']) =>
  goalSuggestions.filter((idea) => idea.tag === tag).map((idea) => idea.title)

describe('the ideas still open', () => {
  it('leaves out ideas already among the goals, whatever their case or spacing', () => {
    const open = openSuggestions(['  drink A GLASS of water ', 'Something of my own'])
    expect(open.map((idea) => idea.title)).not.toContain('Drink a glass of water')
    expect(open).toHaveLength(goalSuggestions.length - 1)
  })
})

describe('a balanced mix of ideas', () => {
  it('starts a new garden with one idea from each of the first parts', () => {
    expect(tags(balancedSuggestions([], 0, 3))).toEqual(WELLBEING_TAGS.slice(0, 3))
    expect(tags(balancedSuggestions([], 0, 6))).toEqual([...WELLBEING_TAGS])
  })

  it('offers the parts the goals do not touch yet first', () => {
    const ideas = balancedSuggestions(
      [titlesOf('rest')[0], titlesOf('notice')[1], 'My own goal'],
      0,
      3,
    )
    expect(tags(ideas)).toEqual(['active', 'connect', 'learn'])
  })

  it('never offers what is already a goal', () => {
    const goals = [...titlesOf('rest'), ...titlesOf('notice').slice(0, 3)]
    for (let round = 0; round < 12; round += 1) {
      for (const idea of balancedSuggestions(goals, round, 3)) {
        expect(goals).not.toContain(idea.title)
      }
    }
  })

  it('keeps each round to different parts while there are enough of them', () => {
    for (let round = 0; round < 16; round += 1) {
      const ideas = balancedSuggestions([], round, 3)
      expect(new Set(tags(ideas)).size).toBe(3)
    }
  })

  it('shows every idea, round by round, before showing one again', () => {
    const seen: string[] = []
    const rounds = goalSuggestions.length / 3
    for (let round = 0; round < rounds; round += 1) {
      seen.push(...balancedSuggestions([], round, 3).map((idea) => idea.title))
    }
    expect(new Set(seen).size).toBe(goalSuggestions.length)
    // And then it comes back round to the start.
    expect(balancedSuggestions([], rounds, 3)).toEqual(balancedSuggestions([], 0, 3))
  })

  it('is the same for the same round, every time', () => {
    expect(balancedSuggestions(['Send a kind message'], 5, 3)).toEqual(
      balancedSuggestions(['Send a kind message'], 5, 3),
    )
    expect(balancedSuggestions([], 1, 3)).not.toEqual(balancedSuggestions([], 0, 3))
  })

  it('takes a second idea from a part rather than repeating one, when few parts are left', () => {
    // Only rest and notice have ideas left.
    const goals = goalSuggestions
      .filter((idea) => idea.tag !== 'rest' && idea.tag !== 'notice')
      .map((idea) => idea.title)
    const ideas = balancedSuggestions(goals, 0, 3)
    expect(ideas).toHaveLength(3)
    expect(new Set(ideas).size).toBe(3)
    expect(new Set(tags(ideas))).toEqual(new Set(['rest', 'notice']))
  })

  it('offers what is left when that is fewer than asked, and nothing when nothing is', () => {
    const all = goalSuggestions.map((idea) => idea.title)
    expect(balancedSuggestions(all.slice(1), 0, 3)).toEqual([goalSuggestions[0]])
    expect(balancedSuggestions(all.slice(1), 7, 3)).toEqual([goalSuggestions[0]])
    expect(balancedSuggestions(all, 0, 3)).toEqual([])
  })

  it('treats a round or count that makes no sense as the first round, or none', () => {
    expect(balancedSuggestions([], -2, 3)).toEqual(balancedSuggestions([], 0, 3))
    expect(balancedSuggestions([], Number.NaN, 3)).toEqual(balancedSuggestions([], 0, 3))
    expect(balancedSuggestions([], 0, 0)).toEqual([])
    expect(balancedSuggestions([], 0, -1)).toEqual([])
  })
})
