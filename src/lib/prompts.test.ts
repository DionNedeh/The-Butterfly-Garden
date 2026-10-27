import { describe, expect, it } from 'vitest'
import { freeWritingPrompt } from '../data/content'
import { reflectionPrompts } from '../data/prompts'
import type { ReflectionPromptFamily } from '../types'
import { addDaysToLocalDate } from './date'
import { promptAfter, promptById, promptForDay } from './prompts'

const DAY = '2026-10-27'

const families: ReadonlySet<ReflectionPromptFamily> = new Set<ReflectionPromptFamily>([
  'noticing',
  'savouring',
  'gratitude',
  'self-compassion',
  'processing',
  'rest',
  'connection',
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
  const everyPrompt = [...reflectionPrompts, freeWritingPrompt]

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
