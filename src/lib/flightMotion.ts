import type { FlightPatternId } from '../types'
import { DEFAULT_FLIGHT_PATTERN_ID } from './flightPatterns'

/**
 * One sine term of a flight path.
 *
 * Frequencies are whole numbers on purpose. A sum of sines whose periods all
 * divide the loop is closed by construction -- position and velocity at t=1
 * are exactly those at t=0 -- so a path can never seam or jump when it wraps.
 * Hand-listed waypoints have to be checked for that; these cannot fail it.
 */
interface Harmonic {
  freq: number
  ampX: number
  ampY: number
  phaseX: number
  phaseY: number
}

/** A slow window: the sprite covers less ground per unit time around `at`. */
interface Hover {
  at: number
  width: number
  weight: number
}

interface PatternMotion {
  /** Where the loop sits in the usable region, 0..1 with y increasing down. */
  center: { x: number; y: number }
  harmonics: Harmonic[]
  baseDurationMs: number
  hovers: Hover[]
}

const TAU = Math.PI * 2

/**
 * Motion for every flight pattern, in normalised space.
 *
 * This is the single source of truth for what a pattern looks like: the garden,
 * the shop preview and the pattern gallery all read it, so a preview cannot
 * drift away from the behaviour it is advertising.
 */
export const FLIGHT_PATTERN_MOTION: Record<FlightPatternId, PatternMotion> = {
  'gentle-drift': {
    center: { x: 0.5, y: 0.48 },
    harmonics: [
      { freq: 1, ampX: 0.34, ampY: 0.17, phaseX: 0, phaseY: Math.PI / 2 },
      { freq: 2, ampX: 0.05, ampY: 0.06, phaseX: 1.1, phaseY: 0.4 },
    ],
    baseDurationMs: 19_000,
    hovers: [{ at: 0.24, width: 0.1, weight: 1.8 }, { at: 0.74, width: 0.1, weight: 1.6 }],
  },
  'petal-hop': {
    center: { x: 0.5, y: 0.62 },
    harmonics: [
      { freq: 1, ampX: 0.33, ampY: 0.04, phaseX: 0, phaseY: 0 },
      { freq: 4, ampX: 0.03, ampY: 0.15, phaseX: 0.6, phaseY: Math.PI / 2 },
    ],
    baseDurationMs: 15_000,
    hovers: [
      { at: 0.12, width: 0.07, weight: 2.4 },
      { at: 0.37, width: 0.07, weight: 2.4 },
      { at: 0.62, width: 0.07, weight: 2.4 },
      { at: 0.87, width: 0.07, weight: 2.4 },
    ],
  },
  'figure-eight': {
    center: { x: 0.5, y: 0.5 },
    harmonics: [
      { freq: 1, ampX: 0.35, ampY: 0, phaseX: 0, phaseY: 0 },
      { freq: 2, ampX: 0, ampY: 0.21, phaseX: 0, phaseY: 0 },
    ],
    baseDurationMs: 18_000,
    hovers: [{ at: 0.5, width: 0.09, weight: 1.7 }, { at: 1, width: 0.09, weight: 1.7 }],
  },
  'sunbeam-swoop': {
    center: { x: 0.5, y: 0.5 },
    harmonics: [
      { freq: 1, ampX: 0.36, ampY: 0.26, phaseX: 0, phaseY: Math.PI / 2 },
      { freq: 3, ampX: 0.02, ampY: 0.05, phaseX: 0.9, phaseY: 1.4 },
    ],
    baseDurationMs: 16_500,
    hovers: [{ at: 0.5, width: 0.13, weight: 2.6 }],
  },
  'spiral-rise': {
    center: { x: 0.5, y: 0.5 },
    harmonics: [
      { freq: 1, ampX: 0.3, ampY: 0.3, phaseX: 0, phaseY: Math.PI / 2 },
      { freq: 2, ampX: 0.12, ampY: 0.09, phaseX: Math.PI / 2, phaseY: 0 },
    ],
    baseDurationMs: 20_000,
    hovers: [{ at: 0.78, width: 0.12, weight: 2.1 }],
  },
  'garden-waltz': {
    center: { x: 0.5, y: 0.5 },
    harmonics: [
      { freq: 1, ampX: 0.36, ampY: 0.12, phaseX: 0, phaseY: 0 },
      { freq: 3, ampX: 0.07, ampY: 0.17, phaseX: 0.3, phaseY: Math.PI / 2 },
    ],
    baseDurationMs: 21_000,
    hovers: [
      { at: 0.18, width: 0.08, weight: 2 },
      { at: 0.5, width: 0.08, weight: 2 },
      { at: 0.82, width: 0.08, weight: 2 },
    ],
  },
  'clover-meander': {
    center: { x: 0.5, y: 0.68 },
    harmonics: [
      { freq: 1, ampX: 0.3, ampY: 0.07, phaseX: 0, phaseY: 1.1 },
      { freq: 2, ampX: 0.11, ampY: 0.1, phaseX: 2.2, phaseY: 0.3 },
      { freq: 3, ampX: 0.05, ampY: 0.05, phaseX: 0.7, phaseY: 2.6 },
    ],
    baseDurationMs: 22_000,
    // Deliberately uneven: the wandering reads as aimless rather than metronomic.
    hovers: [
      { at: 0.16, width: 0.06, weight: 2.7 },
      { at: 0.44, width: 0.11, weight: 1.5 },
      { at: 0.79, width: 0.05, weight: 3 },
    ],
  },
  'breeze-glide': {
    center: { x: 0.5, y: 0.44 },
    harmonics: [
      { freq: 1, ampX: 0.4, ampY: 0.09, phaseX: 0, phaseY: Math.PI / 2 },
      { freq: 2, ampX: 0.03, ampY: 0.03, phaseX: 1.6, phaseY: 0.8 },
    ],
    baseDurationMs: 24_000,
    hovers: [{ at: 0.5, width: 0.16, weight: 1.4 }],
  },
  'blossom-bounce': {
    center: { x: 0.5, y: 0.66 },
    harmonics: [
      { freq: 1, ampX: 0.31, ampY: 0.03, phaseX: 0, phaseY: 0 },
      { freq: 3, ampX: 0.04, ampY: 0.19, phaseX: 0.4, phaseY: Math.PI / 2 },
    ],
    baseDurationMs: 14_500,
    hovers: [
      { at: 0.17, width: 0.08, weight: 2.8 },
      { at: 0.5, width: 0.08, weight: 2.8 },
      { at: 0.83, width: 0.08, weight: 2.8 },
    ],
  },
  'ribbon-loop': {
    center: { x: 0.5, y: 0.5 },
    harmonics: [
      { freq: 1, ampX: 0.37, ampY: 0.14, phaseX: 0, phaseY: 0.5 },
      { freq: 2, ampX: 0.06, ampY: 0.2, phaseX: 1.9, phaseY: 0 },
      // The third term is what walks the crossing point around the loop.
      { freq: 3, ampX: 0.08, ampY: 0.04, phaseX: 0.2, phaseY: 1.3 },
    ],
    baseDurationMs: 20_500,
    hovers: [{ at: 0.33, width: 0.1, weight: 1.6 }, { at: 0.83, width: 0.1, weight: 1.6 }],
  },
  'moonbeam-float': {
    center: { x: 0.5, y: 0.42 },
    harmonics: [
      { freq: 1, ampX: 0.17, ampY: 0.28, phaseX: 0, phaseY: Math.PI / 2 },
      { freq: 2, ampX: 0.05, ampY: 0.07, phaseX: 2.4, phaseY: 1.2 },
    ],
    baseDurationMs: 26_000,
    hovers: [{ at: 0.25, width: 0.18, weight: 3.2 }],
  },
  'canopy-dance': {
    center: { x: 0.5, y: 0.4 },
    harmonics: [
      { freq: 1, ampX: 0.38, ampY: 0.22, phaseX: 0, phaseY: Math.PI / 2 },
      { freq: 2, ampX: 0.05, ampY: 0.13, phaseX: 1.2, phaseY: 0 },
    ],
    baseDurationMs: 23_000,
    hovers: [{ at: 0.62, width: 0.12, weight: 2.3 }],
  },
}

export interface FlightSceneBounds {
  width: number
  height: number
}

export interface FlightSpriteSize {
  width: number
  height: number
}

export interface FlightMotionInput {
  /** Seeds every per-creature choice. Never the visible index: reordering
   *  companions must not change how any of them fly. */
  creatureId: string
  patternId: FlightPatternId
  bounds: FlightSceneBounds
  sprite: FlightSpriteSize
  /** Used only to spread starting phase and static rest slots apart. */
  densityIndex?: number
  /** Extra clearance for an aura, so decoration stays inside the scene too. */
  auraMargin?: number
  /** Pixels to keep clear at the top for the title and controls. */
  safeTop?: number
  reducedMotion?: boolean
  /** Number of emitted keyframes. Enough to read as smooth, few enough to
   *  hand to the animation API without cost. */
  samples?: number
}

export interface FlightKeyframe {
  /** 0..1 through the loop. Non-uniform: hovers take more time per distance. */
  offset: number
  x: number
  y: number
  /** Discrete. Facing is never interpolated -- crossing zero would flatten
   *  the sprite mid-turn, which is what the old scaleX keyframes did. */
  facing: 1 | -1
  /** Degrees, small and bounded. */
  bank: number
}

export interface FlightTrack {
  patternId: FlightPatternId
  keyframes: FlightKeyframe[]
  durationMs: number
  /** Negative, so companions are already spread through their loops. */
  delayMs: number
  scale: number
  /** Where this creature rests when motion is switched off. */
  staticPose: { x: number; y: number; facing: 1 | -1 }
}

const DEFAULT_SAMPLES = 24
const MAX_BANK_DEGREES = 7
/** Below this horizontal movement the previous facing is kept, so a sprite
 *  hovering near a turn does not flicker between headings. */
const FACING_HYSTERESIS = 0.004

function stableHash(input: string): number {
  let hash = 2166136261
  for (const char of input) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Deterministic 0..1 draws from one seed. */
function seededDraws(seed: number, count: number): number[] {
  const draws: number[] = []
  let state = seed || 1
  for (let index = 0; index < count; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    draws.push(state / 4294967296)
  }
  return draws
}

function motionFor(patternId: FlightPatternId): PatternMotion {
  return (
    FLIGHT_PATTERN_MOTION[patternId] ??
    FLIGHT_PATTERN_MOTION[DEFAULT_FLIGHT_PATTERN_ID]
  )
}

/** Normalised position at t, in the pattern's own 0..1 space. */
function sampleAt(motion: PatternMotion, t: number, phaseShift: number) {
  let x = motion.center.x
  let y = motion.center.y
  for (const harmonic of motion.harmonics) {
    const angle = TAU * harmonic.freq * t + phaseShift * harmonic.freq
    x += harmonic.ampX * Math.sin(angle + harmonic.phaseX)
    y += harmonic.ampY * Math.sin(angle + harmonic.phaseY)
  }
  return { x, y }
}

/**
 * Shrink a path about its centre until it fits 0..1 on both axes.
 *
 * Amplitudes are authored for a roomy scene; a narrow one would otherwise push
 * part of the loop outside the region and the sprite would clip the edge.
 * Scaling about the centre keeps each pattern's vertical character -- a low
 * meander stays low -- where refitting to the full box would flatten them all
 * into the same shape.
 */
function fitFactor(points: Array<{ x: number; y: number }>, center: { x: number; y: number }) {
  let factor = 1
  for (const point of points) {
    for (const [value, middle] of [
      [point.x, center.x],
      [point.y, center.y],
    ]) {
      const reach = value - middle
      if (reach > 0) {
        const room = 1 - middle
        if (reach > room) factor = Math.min(factor, room / reach)
      } else if (reach < 0) {
        if (-reach > middle) factor = Math.min(factor, middle / -reach)
      }
    }
  }
  return Math.max(0, factor)
}

/** Time offsets that linger inside each hover window. */
function hoverOffsets(motion: PatternMotion, samples: number): number[] {
  const weights: number[] = []
  for (let index = 0; index < samples; index += 1) {
    const t = (index + 0.5) / samples
    let weight = 1
    for (const hover of motion.hovers) {
      // Distance around the loop, so a window at 1 also covers 0.
      const raw = Math.abs(t - hover.at)
      const distance = Math.min(raw, 1 - raw)
      if (distance < hover.width) {
        const nearness = 1 - distance / hover.width
        weight += (hover.weight - 1) * nearness
      }
    }
    weights.push(weight)
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const offsets: number[] = [0]
  let running = 0
  for (let index = 0; index < samples; index += 1) {
    running += weights[index]
    offsets.push(running / total)
  }
  // Guard the endpoint against accumulated floating point drift.
  offsets[offsets.length - 1] = 1
  return offsets
}

/**
 * A closed, bounded flight track for one creature.
 *
 * Pure and deterministic: the same inputs always produce the same track, which
 * is what lets a preview show exactly what the garden will do.
 */
export function generateFlightTrack(input: FlightMotionInput): FlightTrack {
  const {
    creatureId,
    patternId,
    bounds,
    sprite,
    densityIndex = 0,
    auraMargin = 0,
    safeTop = 0,
    reducedMotion = false,
    samples = DEFAULT_SAMPLES,
  } = input

  const motion = motionFor(patternId)
  const seed = stableHash(`${creatureId}:${patternId}`)
  const [drawScale, drawDuration, drawDelay, drawPhase, drawFacing] = seededDraws(seed, 5)

  const scale = Number((0.74 + drawScale * 0.22).toFixed(3))
  const halfWidth = (sprite.width * scale) / 2 + auraMargin
  const halfHeight = (sprite.height * scale) / 2 + auraMargin

  const left = halfWidth
  const right = bounds.width - halfWidth
  const top = safeTop + halfHeight
  const bottom = bounds.height - halfHeight
  const usableWidth = right - left
  const usableHeight = bottom - top

  // A container too small to hold the sprite has no room for a path. Resting at
  // the middle keeps every creature visible instead of animating off-scene.
  if (!(usableWidth > 0) || !(usableHeight > 0)) {
    const restX = bounds.width / 2
    const restY = Math.max(safeTop, bounds.height / 2)
    return {
      patternId,
      keyframes: [
        { offset: 0, x: restX, y: restY, facing: 1, bank: 0 },
        { offset: 1, x: restX, y: restY, facing: 1, bank: 0 },
      ],
      durationMs: motion.baseDurationMs,
      delayMs: 0,
      scale,
      staticPose: { x: restX, y: restY, facing: 1 },
    }
  }

  const phaseShift = drawPhase * TAU
  const raw: Array<{ x: number; y: number }> = []
  for (let index = 0; index < samples; index += 1) {
    raw.push(sampleAt(motion, index / samples, phaseShift))
  }

  const factor = fitFactor(raw, motion.center)
  const toScene = (point: { x: number; y: number }) => ({
    x: left + (motion.center.x + (point.x - motion.center.x) * factor) * usableWidth,
    y: top + (motion.center.y + (point.y - motion.center.y) * factor) * usableHeight,
  })

  const scenePoints = raw.map(toScene)
  const offsets = hoverOffsets(motion, samples)

  const facingAt = (index: number) => {
    const point = scenePoints[index % samples]
    const next = scenePoints[(index + 1) % samples]
    return next.x - point.x
  }

  // Settle the heading before emitting anything.
  //
  // Facing carries over between keyframes so a sprite hovering near a turn
  // does not flicker, which means the value at any point depends on where the
  // walk started. Starting from a seed left the first and last keyframes
  // disagreeing on roughly one track in forty -- and since the last keyframe
  // is the first one again, that is a mirror flip and an inverted bank on
  // every lap. One warm-up pass reaches the steady state the loop settles
  // into, so the emitted walk begins where it will end.
  let facing: 1 | -1 = drawFacing < 0.5 ? 1 : -1
  for (let index = 0; index < samples; index += 1) {
    const dx = facingAt(index)
    if (Math.abs(dx) > FACING_HYSTERESIS * usableWidth) {
      facing = dx >= 0 ? 1 : -1
    }
  }

  const keyframes: FlightKeyframe[] = []
  for (let index = 0; index <= samples; index += 1) {
    // The final keyframe repeats the first, which is what closes the loop.
    const point = scenePoints[index % samples]
    const next = scenePoints[(index + 1) % samples]
    const dx = next.x - point.x
    const dy = next.y - point.y
    if (Math.abs(dx) > FACING_HYSTERESIS * usableWidth) {
      facing = dx >= 0 ? 1 : -1
    }
    const slope = Math.abs(dx) < 1e-6 ? 0 : dy / dx
    const bank = Math.max(
      -MAX_BANK_DEGREES,
      Math.min(MAX_BANK_DEGREES, slope * facing * MAX_BANK_DEGREES),
    )
    keyframes.push({
      offset: offsets[index],
      x: Number(point.x.toFixed(2)),
      y: Number(point.y.toFixed(2)),
      facing,
      bank: Number(bank.toFixed(2)),
    })
  }

  const durationMs = Math.round(motion.baseDurationMs * (0.88 + drawDuration * 0.28))
  const delayMs = -Math.round(
    (drawDelay * durationMs + densityIndex * (durationMs / 12)) % durationMs,
  )

  return {
    patternId,
    keyframes,
    durationMs,
    delayMs,
    scale,
    staticPose: reducedMotion
      ? restingPose(densityIndex, left, top, usableWidth, usableHeight, facing)
      : { x: keyframes[0].x, y: keyframes[0].y, facing: keyframes[0].facing },
  }
}

/**
 * Where a creature waits when decorative motion is off.
 *
 * Spread across a coarse grid rather than left wherever its loop happened to
 * start, so switching motion off does not pile several butterflies on one spot.
 */
function restingPose(
  densityIndex: number,
  left: number,
  top: number,
  usableWidth: number,
  usableHeight: number,
  facing: 1 | -1,
) {
  const columns = 4
  const column = densityIndex % columns
  const row = Math.floor(densityIndex / columns)
  const x = left + ((column + 0.5) / columns) * usableWidth
  const y = top + (((row % 3) + 0.5) / 3) * usableHeight
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), facing }
}
