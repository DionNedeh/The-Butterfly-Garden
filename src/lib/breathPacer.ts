import {
  BREATH_IN_SECONDS,
  BREATH_OUT_SECONDS,
  breathPatterns,
  SESSION_MINUTES,
  type BreathPatternId,
  type BreathStep,
  type SessionMinutes,
} from '../data/breathing'

/**
 * The pacer for breathing with a butterfly (plan c.1), as plain functions of
 * the gardener's choices and the time since the session began.
 *
 * Everything on screen is worked out from one clock: the wings' animation is
 * built once from `wingFrames` and runs on the compositor, and the count
 * asks `phaseAt` once a second. Nothing here reads the clock itself, so a
 * page that was hidden, or a timer that fired late, is simply asked again
 * and is right.
 */

export interface BreathChoices {
  pattern: BreathPatternId
  /** The slow pattern's breath in, in whole seconds. */
  inSeconds: number
  /** Every pattern's long breath out, in whole seconds. */
  outSeconds: number
  minutes: SessionMinutes
  /**
   * A soft tone at each turn, once the gardener has said; until then it
   * follows the garden's sound (see `toneOn`).
   */
  tone?: boolean
}

/** Slow breathing, 4 in and 6 out, for one minute: the gentlest start. */
export const DEFAULT_BREATH_CHOICES: BreathChoices = {
  pattern: 'slow',
  inSeconds: 4,
  outSeconds: 6,
  minutes: 1,
}

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, Math.round(value)))

/**
 * Timings within the gentle bounds: whole seconds, in 3 to 6, out 4 to 8,
 * and out never shorter than in. Anything that is not a number falls back
 * to the default.
 */
export function gentleTimings(
  inSeconds: unknown,
  outSeconds: unknown,
): Pick<BreathChoices, 'inSeconds' | 'outSeconds'> {
  const given = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  const breathIn = clamp(given(inSeconds, DEFAULT_BREATH_CHOICES.inSeconds), BREATH_IN_SECONDS)
  const breathOut = clamp(given(outSeconds, DEFAULT_BREATH_CHOICES.outSeconds), BREATH_OUT_SECONDS)
  return { inSeconds: breathIn, outSeconds: Math.max(breathIn, breathOut) }
}

/** Whether the tone sounds: the gardener's say, or else whether the garden's sound is on. */
export function toneOn(choices: Pick<BreathChoices, 'tone'>, soundOn: boolean): boolean {
  return choices.tone ?? soundOn
}

/**
 * The choices kept between visits, read back from the draft they are kept
 * in (lib/drafts). A draft is the device's own note, never part of the
 * garden or its backup, so anything unreadable in it just means the
 * defaults.
 */
export function choicesFromDraft(text: string): BreathChoices {
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : undefined
  } catch {
    raw = undefined
  }
  if (typeof raw !== 'object' || raw === null) return DEFAULT_BREATH_CHOICES
  const kept = raw as Record<string, unknown>
  const pattern = breathPatterns.find((item) => item.id === kept.pattern)?.id
  const minutes = SESSION_MINUTES.find((item) => item === kept.minutes)
  return {
    pattern: pattern ?? DEFAULT_BREATH_CHOICES.pattern,
    ...gentleTimings(kept.inSeconds, kept.outSeconds),
    minutes: minutes ?? DEFAULT_BREATH_CHOICES.minutes,
    ...(typeof kept.tone === 'boolean' ? { tone: kept.tone } : {}),
  }
}

/** The draft for some choices: empty for the defaults, so none is kept for them. */
export function choicesToDraft(choices: BreathChoices): string {
  const { pattern, inSeconds, outSeconds, minutes, tone } = choices
  const usual = DEFAULT_BREATH_CHOICES
  if (
    pattern === usual.pattern &&
    inSeconds === usual.inSeconds &&
    outSeconds === usual.outSeconds &&
    minutes === usual.minutes &&
    tone === undefined
  )
    return ''
  return JSON.stringify({ pattern, inSeconds, outSeconds, minutes, tone })
}

/** A step of a session: its length in milliseconds, and where in a breath it starts. */
export interface PacedStep extends BreathStep {
  ms: number
  startMs: number
}

export interface BreathSession {
  /** One breath. */
  steps: readonly PacedStep[]
  /** How long one breath lasts. */
  cycleMs: number
  /** How many breaths: as near the chosen minutes as whole breaths allow. */
  breaths: number
  totalMs: number
}

/** A pattern by its id; slow breathing for any other. */
function patternOf(id: BreathPatternId) {
  return breathPatterns.find((pattern) => pattern.id === id) ?? breathPatterns[0]
}

/** One breath of a pattern, with the gardener's timings in place. */
export function stepsFor(choices: BreathChoices): PacedStep[] {
  const timings = gentleTimings(choices.inSeconds, choices.outSeconds)
  let startMs = 0
  return patternOf(choices.pattern).steps.map((step) => {
    const seconds =
      step.adjust === 'in'
        ? timings.inSeconds
        : step.adjust === 'out'
          ? timings.outSeconds
          : step.seconds
    const paced = { ...step, seconds, ms: seconds * 1000, startMs }
    startMs += paced.ms
    return paced
  })
}

/** "In… 4 · Out… 6": a breath as the count will say it. */
export function timingsLine(steps: readonly BreathStep[]): string {
  return steps.map((step) => `${step.cue}… ${step.seconds}`).join(' · ')
}

/**
 * A session: whole breaths, so it always ends at the end of a breath out
 * with the wings folded, never part way through one.
 */
export function planSession(choices: BreathChoices): BreathSession {
  const steps = stepsFor(choices)
  const last = steps[steps.length - 1]
  const cycleMs = last.startMs + last.ms
  const breaths = Math.max(1, Math.round((choices.minutes * 60_000) / cycleMs))
  return { steps, cycleMs, breaths, totalMs: breaths * cycleMs }
}

export interface BreathPhase {
  /** The session has run its course. */
  finished: boolean
  /** Which breath, from 0. */
  breath: number
  step: PacedStep
  /** Whole seconds into the step, counted from 1: "In… 1, 2, 3, 4". */
  count: number
}

/** Where a session is, `elapsedMs` after it began. */
export function phaseAt(session: BreathSession, elapsedMs: number): BreathPhase {
  const last = session.steps[session.steps.length - 1]
  if (elapsedMs >= session.totalMs) {
    return { finished: true, breath: session.breaths - 1, step: last, count: last.seconds }
  }
  const at = Math.max(0, elapsedMs)
  const breath = Math.floor(at / session.cycleMs)
  const within = at - breath * session.cycleMs
  const step = session.steps.findLast((item) => item.startMs <= within) ?? session.steps[0]
  const count = Math.min(step.seconds, Math.floor((within - step.startMs) / 1000) + 1)
  return { finished: false, breath, step, count }
}

/**
 * When what `phaseAt` says next changes after `elapsedMs`: the next second
 * of the count, the next step, or the end. The count waits for exactly this,
 * rather than asking every frame.
 */
export function nextChangeAt(session: BreathSession, elapsedMs: number): number {
  if (elapsedMs >= session.totalMs) return session.totalMs
  const at = Math.max(0, elapsedMs)
  const breathStart = Math.floor(at / session.cycleMs) * session.cycleMs
  const { step } = phaseAt(session, at)
  const stepStart = breathStart + step.startMs
  const nextSecond = stepStart + (Math.floor((at - stepStart) / 1000) + 1) * 1000
  return Math.min(nextSecond, stepStart + step.ms, session.totalMs)
}

/** A turn: the moment a step begins, when the tone sounds. */
export interface BreathTurn {
  atMs: number
  step: PacedStep
}

/** Every turn from `fromMs` up to, not including, `toMs`. */
export function turnsBetween(session: BreathSession, fromMs: number, toMs: number): BreathTurn[] {
  const turns: BreathTurn[] = []
  const end = Math.min(toMs, session.totalMs)
  for (
    let breathStart = Math.max(0, Math.floor(fromMs / session.cycleMs)) * session.cycleMs;
    breathStart < end;
    breathStart += session.cycleMs
  ) {
    for (const step of session.steps) {
      const atMs = breathStart + step.startMs
      if (atMs >= fromMs && atMs < end) turns.push({ atMs, step })
    }
  }
  return turns
}

/** How far the wings fold at the end of a breath out, as a share of their spread. */
export const FOLDED = 0.3
/** In Calm motion they travel less far. */
export const FOLDED_CALM = 0.6

/**
 * One breath of the wings, as Web Animations keyframes: folded, opening
 * through the breath in, folding through the breath out. Only a transform,
 * on each wing's own layer, so it runs on the compositor (see SpriteFrame).
 * Played for `breaths` iterations, it is the whole session.
 */
export function wingFrames(session: BreathSession, folded = FOLDED): Keyframe[] {
  const scale = (open: number) => Number((folded + (1 - folded) * open).toFixed(3))
  return [
    { offset: 0, transform: `scaleX(${scale(0)})`, easing: 'ease-in-out' },
    ...session.steps.map((step) => ({
      offset: Number(((step.startMs + step.ms) / session.cycleMs).toFixed(4)),
      transform: `scaleX(${scale(step.open)})`,
      easing: 'ease-in-out',
    })),
  ]
}
