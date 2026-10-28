import { describe, expect, it } from 'vitest'
import { BREATH_IN_SECONDS, BREATH_OUT_SECONDS, breathPatterns } from '../data/breathing'
import {
  choicesFromDraft,
  choicesToDraft,
  DEFAULT_BREATH_CHOICES,
  FOLDED,
  FOLDED_CALM,
  gentleTimings,
  nextChangeAt,
  phaseAt,
  planSession,
  stepsFor,
  timingsLine,
  toneOn,
  turnsBetween,
  wingFrames,
  type BreathChoices,
} from './breathPacer'

const choices = (overrides: Partial<BreathChoices> = {}): BreathChoices => ({
  ...DEFAULT_BREATH_CHOICES,
  ...overrides,
})

/** Where a session stands at a time, in words: "In 3", "Out 1". */
const said = (session: ReturnType<typeof planSession>, ms: number) => {
  const phase = phaseAt(session, ms)
  return phase.finished ? 'done' : `${phase.step.cue} ${phase.count}`
}

describe('the patterns', () => {
  it('are slow, never breathe out for less than in, and hold nothing', () => {
    for (const pattern of breathPatterns) {
      const breathIn = pattern.steps.filter((step) => step.kind === 'in')
      const breathOut = pattern.steps.filter((step) => step.kind === 'out')
      const seconds = (steps: typeof pattern.steps) =>
        steps.reduce((sum, step) => sum + step.seconds, 0)
      expect(seconds(breathOut)).toBeGreaterThanOrEqual(seconds(breathIn))
      // Every step is a breath in or out: there is no kind for a hold.
      expect(pattern.steps.every((step) => step.kind === 'in' || step.kind === 'out')).toBe(true)
      // Whole seconds, so the count and every turn fall on the second.
      expect(pattern.steps.every((step) => Number.isInteger(step.seconds))).toBe(true)
      // One breath ends folded, where the next begins.
      expect(pattern.steps.at(-1)?.open).toBe(0)
      // Nothing faster than about ten breaths a minute.
      expect(seconds(pattern.steps)).toBeGreaterThanOrEqual(6)
    }
  })

  it('start on slow breathing, 4 in and 6 out, for a minute', () => {
    expect(DEFAULT_BREATH_CHOICES).toEqual({
      pattern: 'slow',
      inSeconds: 4,
      outSeconds: 6,
      minutes: 1,
    })
    const slow = breathPatterns.find((pattern) => pattern.id === 'slow')
    expect(slow?.steps.map((step) => step.seconds)).toEqual([4, 6])
    expect(timingsLine(stepsFor(DEFAULT_BREATH_CHOICES))).toBe('In… 4 · Out… 6')
  })
})

describe('gentle timings', () => {
  it('keep in to 3–6 seconds and out to 4–8, in whole seconds', () => {
    expect(gentleTimings(2, 3)).toEqual({ inSeconds: 3, outSeconds: 4 })
    expect(gentleTimings(9, 12)).toEqual({ inSeconds: 6, outSeconds: 8 })
    expect(gentleTimings(4.4, 6.6)).toEqual({ inSeconds: 4, outSeconds: 7 })
    expect(BREATH_IN_SECONDS).toEqual({ min: 3, max: 6 })
    expect(BREATH_OUT_SECONDS).toEqual({ min: 4, max: 8 })
  })

  it('never let the breath out be shorter than the breath in', () => {
    expect(gentleTimings(6, 4)).toEqual({ inSeconds: 6, outSeconds: 6 })
    expect(gentleTimings(5, 5)).toEqual({ inSeconds: 5, outSeconds: 5 })
  })

  it('fall back to the defaults for anything that is not a number', () => {
    expect(gentleTimings('5', undefined)).toEqual({ inSeconds: 4, outSeconds: 6 })
    expect(gentleTimings(Number.NaN, Infinity)).toEqual({ inSeconds: 4, outSeconds: 6 })
  })
})

describe('slow breathing', () => {
  it('counts each second of the breath in and the breath out', () => {
    const session = planSession(choices())
    expect(session.cycleMs).toBe(10_000)
    expect(said(session, 0)).toBe('In 1')
    expect(said(session, 999)).toBe('In 1')
    expect(said(session, 1000)).toBe('In 2')
    expect(said(session, 3999)).toBe('In 4')
    expect(said(session, 4000)).toBe('Out 1')
    expect(said(session, 9999)).toBe('Out 6')
    expect(said(session, 10_000)).toBe('In 1')
    expect(phaseAt(session, 25_000).breath).toBe(2)
  })

  it('follows the timings chosen', () => {
    const session = planSession(choices({ inSeconds: 5, outSeconds: 8 }))
    expect(session.cycleMs).toBe(13_000)
    expect(said(session, 4999)).toBe('In 5')
    expect(said(session, 5000)).toBe('Out 1')
    expect(said(session, 12_999)).toBe('Out 8')
    expect(timingsLine(session.steps)).toBe('In… 5 · Out… 8')
  })

  it('keeps chosen timings within bounds however they arrive', () => {
    const session = planSession(choices({ inSeconds: 10, outSeconds: 2 }))
    expect(session.steps.map((step) => step.seconds)).toEqual([6, 6])
  })
})

describe('the cyclic sigh', () => {
  it('breathes in twice, the second a short top-up, then out for long', () => {
    const session = planSession(choices({ pattern: 'sigh' }))
    expect(timingsLine(session.steps)).toBe('In… 2 · In again… 1 · Out… 6')
    expect(said(session, 0)).toBe('In 1')
    expect(said(session, 1500)).toBe('In 2')
    expect(said(session, 2000)).toBe('In again 1')
    expect(said(session, 3000)).toBe('Out 1')
    expect(said(session, 8999)).toBe('Out 6')
    expect(said(session, 9000)).toBe('In 1')
  })

  it('takes its breath out from the gardener, and ignores the breath in', () => {
    const session = planSession(choices({ pattern: 'sigh', inSeconds: 6, outSeconds: 8 }))
    expect(session.steps.map((step) => step.seconds)).toEqual([2, 1, 8])
  })
})

describe('a session', () => {
  it('is whole breaths, as near the minutes chosen as they allow', () => {
    expect(planSession(choices()).breaths).toBe(6)
    expect(planSession(choices()).totalMs).toBe(60_000)
    expect(planSession(choices({ minutes: 3 })).totalMs).toBe(180_000)
    expect(planSession(choices({ minutes: 5 })).breaths).toBe(30)
    // 3 in and 4 out: nine breaths of seven seconds is nearest a minute.
    const quick = planSession(choices({ inSeconds: 3, outSeconds: 4 }))
    expect(quick.breaths).toBe(9)
    expect(quick.totalMs).toBe(63_000)
  })

  it('ends at its end, folded after a breath out, and not before', () => {
    const session = planSession(choices())
    expect(phaseAt(session, 59_999).finished).toBe(false)
    expect(said(session, 59_999)).toBe('Out 6')
    expect(phaseAt(session, 60_000)).toMatchObject({ finished: true, breath: 5 })
    expect(phaseAt(session, 90_000).finished).toBe(true)
  })

  it('reads a time before it began as its start', () => {
    expect(said(planSession(choices()), -50)).toBe('In 1')
  })

  it('says when the count next changes: each second, each step, and the end', () => {
    const session = planSession(choices())
    expect(nextChangeAt(session, 0)).toBe(1000)
    expect(nextChangeAt(session, 1500)).toBe(2000)
    expect(nextChangeAt(session, 3999)).toBe(4000)
    expect(nextChangeAt(session, 59_500)).toBe(60_000)
    expect(nextChangeAt(session, 61_000)).toBe(60_000)
  })
})

describe('the turns', () => {
  it('fall at the start of every step, for the tone', () => {
    const session = planSession(choices())
    const turns = turnsBetween(session, 0, 20_000)
    expect(turns.map((turn) => [turn.atMs, turn.step.kind])).toEqual([
      [0, 'in'],
      [4000, 'out'],
      [10_000, 'in'],
      [14_000, 'out'],
    ])
  })

  it('come once each, from a window to the next', () => {
    const session = planSession(choices({ pattern: 'sigh' }))
    const early = turnsBetween(session, 0, 2000).map((turn) => turn.atMs)
    const later = turnsBetween(session, 2000, 9000).map((turn) => turn.atMs)
    expect(early).toEqual([0])
    expect(later).toEqual([2000, 3000])
  })

  it('stop where the session does', () => {
    const session = planSession(choices())
    expect(turnsBetween(session, 55_000, 70_000).map((turn) => turn.atMs)).toEqual([])
    expect(turnsBetween(session, 50_000, 70_000).map((turn) => turn.atMs)).toEqual([50_000, 54_000])
  })
})

describe('the wings', () => {
  it('open through the breath in and fold through the breath out, a transform only', () => {
    const frames = wingFrames(planSession(choices()))
    expect(frames).toEqual([
      { offset: 0, transform: `scaleX(${FOLDED})`, easing: 'ease-in-out' },
      { offset: 0.4, transform: 'scaleX(1)', easing: 'ease-in-out' },
      { offset: 1, transform: `scaleX(${FOLDED})`, easing: 'ease-in-out' },
    ])
    for (const frame of frames) expect(Object.keys(frame).sort()).toEqual(['easing', 'offset', 'transform'])
  })

  it('open most of the way on the first breath of a sigh, and fully on its top-up', () => {
    const frames = wingFrames(planSession(choices({ pattern: 'sigh' })))
    expect(frames.map((frame) => frame.offset)).toEqual([0, 0.2222, 0.3333, 1])
    expect(frames[1].transform).toBe('scaleX(0.825)')
    expect(frames[2].transform).toBe('scaleX(1)')
  })

  it('travel less far in Calm motion', () => {
    const frames = wingFrames(planSession(choices()), FOLDED_CALM)
    expect(frames[0].transform).toBe(`scaleX(${FOLDED_CALM})`)
    expect(FOLDED_CALM).toBeGreaterThan(FOLDED)
  })
})

describe('the choices kept between visits', () => {
  it('keep nothing for the defaults', () => {
    expect(choicesToDraft(DEFAULT_BREATH_CHOICES)).toBe('')
    expect(choicesFromDraft('')).toBe(DEFAULT_BREATH_CHOICES)
  })

  it('read back what they wrote', () => {
    const chosen = choices({ pattern: 'sigh', inSeconds: 5, outSeconds: 7, minutes: 5, tone: false })
    expect(choicesFromDraft(choicesToDraft(chosen))).toEqual(chosen)
    const toneOnly = choices({ tone: true })
    expect(choicesFromDraft(choicesToDraft(toneOnly))).toEqual(toneOnly)
  })

  it('make the best of anything unreadable', () => {
    expect(choicesFromDraft('{not json')).toBe(DEFAULT_BREATH_CHOICES)
    expect(choicesFromDraft('null')).toBe(DEFAULT_BREATH_CHOICES)
    expect(
      choicesFromDraft(
        JSON.stringify({ pattern: 'hold', inSeconds: 1, outSeconds: 'long', minutes: 4, tone: 'yes' }),
      ),
    ).toEqual({ pattern: 'slow', inSeconds: 3, outSeconds: 6, minutes: 1 })
  })

  it('sound the tone as the gardener chose, or with the garden’s sound until they do', () => {
    expect(toneOn({}, true)).toBe(true)
    expect(toneOn({}, false)).toBe(false)
    expect(toneOn({ tone: false }, true)).toBe(false)
    expect(toneOn({ tone: true }, false)).toBe(true)
  })
})
