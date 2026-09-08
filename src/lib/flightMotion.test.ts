import { describe, expect, it } from 'vitest'
import { flightPatterns } from '../data/flightPatterns'
import {
  FLIGHT_PATTERN_MOTION,
  generateFlightTrack,
  type FlightMotionInput,
} from './flightMotion'
import type { FlightPatternId } from '../types'

const SCENE: FlightMotionInput = {
  creatureId: 'creature-1',
  patternId: 'gentle-drift',
  bounds: { width: 900, height: 520 },
  sprite: { width: 64, height: 48 },
}

const PHONE: FlightMotionInput = {
  ...SCENE,
  bounds: { width: 360, height: 460 },
}

function track(overrides: Partial<FlightMotionInput> = {}) {
  return generateFlightTrack({ ...SCENE, ...overrides })
}

describe('flight motion generation', () => {
  it('describes every pattern in the catalog', () => {
    // A pattern that is buyable but has no motion would fly like the default
    // one while claiming to be distinct.
    for (const pattern of flightPatterns) {
      expect(FLIGHT_PATTERN_MOTION[pattern.id]).toBeDefined()
    }
    expect(Object.keys(FLIGHT_PATTERN_MOTION)).toHaveLength(flightPatterns.length)
  })

  it('is deterministic for the same creature and pattern', () => {
    expect(track()).toEqual(track())
  })

  it('seeds from the creature, not its position in the scene', () => {
    // Companions get reordered as they emerge; a butterfly must not change the
    // way it flies because another one appeared.
    const first = track({ densityIndex: 0 })
    const later = track({ densityIndex: 7 })
    expect(later.keyframes.map((frame) => [frame.x, frame.y])).toEqual(
      first.keyframes.map((frame) => [frame.x, frame.y]),
    )
    expect(later.scale).toBe(first.scale)
    // Only the starting phase is spread apart.
    expect(later.delayMs).not.toBe(first.delayMs)
  })

  it('gives different creatures different tracks', () => {
    const one = track({ creatureId: 'creature-1' })
    const two = track({ creatureId: 'creature-2' })
    expect(one.keyframes).not.toEqual(two.keyframes)
  })

  it('closes the loop exactly', () => {
    for (const pattern of flightPatterns) {
      const generated = track({ patternId: pattern.id })
      const first = generated.keyframes[0]
      const last = generated.keyframes[generated.keyframes.length - 1]
      expect(last.x).toBe(first.x)
      expect(last.y).toBe(first.y)
      expect(first.offset).toBe(0)
      expect(last.offset).toBe(1)
    }
  })

  it('closes heading and bank too, for every creature', () => {
    // Matching x and y is not enough. The last keyframe is the first one
    // again, so a heading that disagrees is a mirror flip and an inverted
    // bank on every lap -- which happened on about one track in forty before
    // the heading was settled ahead of emitting.
    let checked = 0
    for (let index = 0; index < 60; index += 1) {
      for (const pattern of flightPatterns) {
        const generated = track({
          creatureId: `creature-${index}`,
          patternId: pattern.id,
        })
        const first = generated.keyframes[0]
        const last = generated.keyframes[generated.keyframes.length - 1]
        expect(`${pattern.id}/${index}: ${last.facing}`).toBe(
          `${pattern.id}/${index}: ${first.facing}`,
        )
        expect(last.bank).toBe(first.bank)
        checked += 1
      }
    }
    expect(checked).toBe(60 * flightPatterns.length)
  })

  it('advances offsets without repeating or exceeding the loop', () => {
    const generated = track({ patternId: 'clover-meander' })
    const offsets = generated.keyframes.map((frame) => frame.offset)
    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]).toBeGreaterThan(offsets[index - 1])
    }
    expect(offsets[offsets.length - 1]).toBeLessThanOrEqual(1)
  })

  it('spends longer inside a hover window than outside it', () => {
    // Moonbeam Float advertises a long hover; the time budget has to show it.
    const generated = track({ patternId: 'moonbeam-float' })
    const spans = generated.keyframes
      .slice(1)
      .map((frame, index) => frame.offset - generated.keyframes[index].offset)
    expect(Math.max(...spans)).toBeGreaterThan(Math.min(...spans) * 1.5)
  })

  it('keeps the whole sprite and its aura inside the scene', () => {
    for (const pattern of flightPatterns) {
      for (const bounds of [SCENE, PHONE]) {
        const generated = generateFlightTrack({
          ...bounds,
          patternId: pattern.id,
          auraMargin: 14,
          safeTop: 40,
        })
        const halfWidth = (bounds.sprite.width * generated.scale) / 2 + 14
        const halfHeight = (bounds.sprite.height * generated.scale) / 2 + 14
        for (const frame of generated.keyframes) {
          expect(frame.x).toBeGreaterThanOrEqual(halfWidth - 0.01)
          expect(frame.x).toBeLessThanOrEqual(bounds.bounds.width - halfWidth + 0.01)
          expect(frame.y).toBeGreaterThanOrEqual(40 + halfHeight - 0.01)
          expect(frame.y).toBeLessThanOrEqual(bounds.bounds.height - halfHeight + 0.01)
        }
      }
    }
  })

  it('produces finite coordinates everywhere', () => {
    for (const pattern of flightPatterns) {
      for (const frame of track({ patternId: pattern.id }).keyframes) {
        expect(Number.isFinite(frame.x)).toBe(true)
        expect(Number.isFinite(frame.y)).toBe(true)
        expect(Number.isFinite(frame.bank)).toBe(true)
      }
    }
  })

  it('never interpolates facing through zero', () => {
    // The old CSS tweened scaleX between 1 and -1, which flattened the sprite
    // as it passed through zero. Facing is a discrete value per keyframe now.
    for (const pattern of flightPatterns) {
      for (const frame of track({ patternId: pattern.id }).keyframes) {
        expect([1, -1]).toContain(frame.facing)
      }
    }
  })

  it('keeps banking small and bounded', () => {
    for (const pattern of flightPatterns) {
      for (const frame of track({ patternId: pattern.id }).keyframes) {
        expect(Math.abs(frame.bank)).toBeLessThanOrEqual(7)
      }
    }
  })

  it('survives a container too small to hold the sprite', () => {
    const generated = track({ bounds: { width: 30, height: 20 } })
    expect(generated.keyframes).toHaveLength(2)
    for (const frame of generated.keyframes) {
      expect(Number.isFinite(frame.x)).toBe(true)
      expect(Number.isFinite(frame.y)).toBe(true)
    }
  })

  it('rests companions apart when motion is switched off', () => {
    const poses = [0, 1, 2, 3, 4].map(
      (densityIndex) => track({ densityIndex, reducedMotion: true }).staticPose,
    )
    const distinct = new Set(poses.map((pose) => `${pose.x},${pose.y}`))
    expect(distinct.size).toBe(poses.length)
  })

  it('gives each pattern a genuinely different path', () => {
    // Guards against a new pattern being a renamed copy of an existing one.
    const signatures = new Set<string>()
    for (const pattern of flightPatterns) {
      const generated = track({ patternId: pattern.id })
      signatures.add(generated.keyframes.map((frame) => `${frame.x}:${frame.y}`).join('|'))
    }
    expect(signatures.size).toBe(flightPatterns.length)
  })

  it('falls back to the starter pattern for an unknown id', () => {
    const generated = track({ patternId: 'not-a-pattern' as FlightPatternId })
    expect(generated.keyframes.length).toBeGreaterThan(2)
  })
})
