import { describe, expect, it } from 'vitest'
import { freeWritingPrompt } from '../data/content'
import { reflectionPrompts, seasonalPrompts } from '../data/prompts'
import type { ReflectionPromptFamily } from '../types'
import { addDaysToLocalDate } from './date'
import { promptAfter, promptById, promptForDay } from './prompts'
import type { Season } from './seasons'

const DAY = '2026-10-27'

const families: ReadonlySet<ReflectionPromptFamily> = new Set<ReflectionPromptFamily>([
  'noticing',
  'savouring',
  'gratitude',
  'self-compassion',
  'processing',
  'rest',
  'connection',
  'nature',
  'free',
])

describe('finding a prompt by its id', () => {
  it('finds every reflection prompt by the id stored with it', () => {
    for (const prompt of reflectionPrompts) {
      expect(promptById(prompt.id)).toBe(prompt)
    }
  })

  it('finds the free-writing prompt', () => {
    expect(promptById(freeWritingPrompt.id)).toBe(freeWritingPrompt)
  })

  it('finds nothing for an id it does not know', () => {
    expect(promptById('no-such-prompt')).toBeUndefined()
    expect(promptById('')).toBeUndefined()
  })
})

describe('another prompt', () => {
  it('is the next one in the rotation, whichever prompt it starts from', () => {
    expect(promptAfter(promptForDay(DAY), DAY)).toBe(promptForDay(DAY, 1))
    expect(promptAfter(promptForDay(DAY, 1), DAY)).toBe(promptForDay(DAY, 2))
    const last = reflectionPrompts[reflectionPrompts.length - 1]
    expect(promptAfter(last, DAY)).toBe(reflectionPrompts[0])
  })

  it('is the day’s own from free writing, or from a prompt no longer offered', () => {
    expect(promptAfter(freeWritingPrompt, DAY)).toBe(promptForDay(DAY))
    expect(promptAfter({ ...freeWritingPrompt, id: 'retired' }, DAY)).toBe(promptForDay(DAY))
  })
})

describe('the day’s prompt', () => {
  it('gives the same prompt for a day however often it is asked', () => {
    expect(promptForDay(DAY)).toBe(promptForDay(DAY))
    expect(promptForDay(DAY, 0)).toBe(promptForDay(DAY))
    expect(reflectionPrompts).toContain(promptForDay(DAY))
  })

  it('offers a different prompt each time another is asked for', () => {
    const offered = reflectionPrompts.map((_, skipped) => promptForDay(DAY, skipped))
    // Every prompt comes round once before any comes round again.
    expect(new Set(offered).size).toBe(reflectionPrompts.length)
    expect(promptForDay(DAY, 1)).not.toBe(promptForDay(DAY))
  })

  it('comes back to the day’s own prompt after the last one', () => {
    const count = reflectionPrompts.length
    expect(promptForDay(DAY, count)).toBe(promptForDay(DAY))
    expect(promptForDay(DAY, count + 1)).toBe(promptForDay(DAY, 1))
  })

  it('starts each day somewhere new, across month and year ends', () => {
    const start = '2026-12-01'
    const days = reflectionPrompts.map((_, offset) =>
      promptForDay(addDaysToLocalDate(start, offset)),
    )
    expect(new Set(days).size).toBe(reflectionPrompts.length)
  })

  it('never offers free writing as the day’s prompt', () => {
    for (let skipped = 0; skipped <= reflectionPrompts.length; skipped += 1) {
      expect(promptForDay(DAY, skipped)).not.toBe(freeWritingPrompt)
    }
  })
})

describe('the prompts themselves', () => {
  const everyPrompt = [...reflectionPrompts, ...seasonalPrompts, freeWritingPrompt]

  it('gives every prompt its own id', () => {
    const ids = everyPrompt.map((prompt) => prompt.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never asks the same question twice', () => {
    const texts = everyPrompt.map((prompt) => prompt.text.trim().toLowerCase())
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('puts every prompt in a family', () => {
    for (const prompt of everyPrompt) {
      expect(families.has(prompt.family)).toBe(true)
      expect(prompt.text.trim()).not.toBe('')
    }
  })

  it('keeps free writing out of the daily rotation', () => {
    expect(freeWritingPrompt.family).toBe('free')
    expect(reflectionPrompts.map((prompt) => prompt.id)).not.toContain(freeWritingPrompt.id)
    expect(reflectionPrompts.some((prompt) => prompt.family === 'free')).toBe(false)
  })

  it('draws the daily rotation from every family but free writing', () => {
    const used = new Set(reflectionPrompts.map((prompt) => prompt.family))
    expect(used).toEqual(new Set([...families].filter((family) => family !== 'free')))
  })
})

describe('three good things in nature', () => {
  it('is a family of its own in the daily rotation, asking about real nature', () => {
    const nature = reflectionPrompts.filter((prompt) => prompt.family === 'nature')
    expect(nature.length).toBeGreaterThanOrEqual(3)
    expect(nature.map((prompt) => prompt.text)).toContain(
      'What were three good things you noticed in nature today?',
    )
    // Concrete "what" and "which" questions, never "why".
    for (const prompt of nature) expect(prompt.text).toMatch(/^(What|Which)\b.*\?$/)
    // Each comes round in the rotation like any other.
    const offered = reflectionPrompts.map((_, skipped) => promptForDay(DAY, skipped))
    for (const prompt of nature) expect(offered).toContain(prompt)
  })
})

describe('the season’s own prompts', () => {
  const seasons: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']
  const offeredIn = (season?: Season) => {
    const count = reflectionPrompts.length + (season ? 2 : 0)
    return Array.from({ length: count }, (_, skipped) => promptForDay(DAY, skipped, season))
  }

  it('gives every season a few, asking concretely, never why', () => {
    for (const season of seasons) {
      const own = seasonalPrompts.filter((prompt) => prompt.season === season)
      expect(own.length, season).toBeGreaterThanOrEqual(2)
      for (const prompt of own) expect(prompt.text).toMatch(/^(What|Which|Where|How)\b.*\?$/)
    }
  })

  it('come round only in their own season, and every one of them then', () => {
    for (const season of seasons) {
      const offered = offeredIn(season)
      for (const prompt of seasonalPrompts) {
        expect(offered.includes(prompt), `${prompt.id} in ${season}`).toBe(prompt.season === season)
      }
      // Every other prompt still comes round too, once.
      expect(new Set(offered).size).toBe(offered.length)
      for (const prompt of reflectionPrompts) expect(offered).toContain(prompt)
    }
  })

  it('stay out where the season is not known', () => {
    const offered = offeredIn(undefined)
    for (const prompt of seasonalPrompts) expect(offered).not.toContain(prompt)
    expect(promptForDay(DAY)).toBe(promptForDay(DAY, 0, undefined))
  })

  it('step on from one to the next with another prompt, in their season', () => {
    for (const prompt of offeredIn('autumn')) {
      expect(promptAfter(prompt, DAY, 'autumn')).not.toBe(prompt)
    }
    const [first, second] = seasonalPrompts.filter((prompt) => prompt.season === 'autumn')
    expect(promptAfter(first, DAY, 'autumn')).toBe(second)
    expect(promptAfter(second, DAY, 'autumn')).toBe(reflectionPrompts[0])
    // Out of its season, a prompt is not offered, so another is the day's own.
    expect(promptAfter(first, DAY, 'spring')).toBe(promptForDay(DAY, 0, 'spring'))
  })

  it('are found by the id stored with a reflection, in any season', () => {
    for (const prompt of seasonalPrompts) expect(promptById(prompt.id)).toBe(prompt)
  })
})
