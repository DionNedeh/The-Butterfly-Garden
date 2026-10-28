import { describe, expect, it } from 'vitest'
import { flightPatterns } from '../data/flightPatterns'
import {
  FLIGHT_PATTERN_MOTION,
  generateFlightTrack,
  type FlightMotionInput,
  type FlightTrack,
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
    // way it flies because another one appeared. Its place among those aloft
    // moves the loop to another lane and another starting point, and nothing
    // else: the same shape, size, pace, heading and banking.
    const first = track({ densityIndex: 0, aloft: 12 })
    const later = track({ densityIndex: 7, aloft: 12 })
    const shape = (generated: FlightTrack) =>
      generated.keyframes.map((frame) => ({
        x: frame.x - generated.keyframes[0].x,
        y: frame.y - generated.keyframes[0].y,
      }))
    const moved = shape(later)
    shape(first).forEach((point, index) => {
      expect(moved[index].x).toBeCloseTo(point.x, 1)
      expect(moved[index].y).toBeCloseTo(point.y, 1)
    })
    for (const key of ['offset', 'facing', 'bank'] as const) {
      expect(later.keyframes.map((frame) => frame[key])).toEqual(
        first.keyframes.map((frame) => frame[key]),
      )
    }
    expect(later.scale).toBe(first.scale)
    expect(later.durationMs).toBe(first.durationMs)
    expect(later.keyframes[0].x).not.toBe(first.keyframes[0].x)
    expect(later.delayMs).not.toBe(first.delayMs)
  })

  it('flies a lone butterfly exactly as the pattern is drawn', () => {
    // One aloft is the preview, the gallery and a young garden: no lanes.
    expect(track({ aloft: 1 })).toEqual(track())
    expect(track({ aloft: 0 })).toEqual(track())
    expect(track({ aloft: Number.NaN })).toEqual(track())
    const centre = FLIGHT_PATTERN_MOTION['gentle-drift'].center.x
    const usable = { left: 0, width: 0 }
    const generated = track()
    usable.left = (SCENE.sprite.width * generated.scale) / 2
    usable.width = SCENE.bounds.width - usable.left * 2
    const xs = generated.keyframes.map((frame) => frame.x)
    const middle = (Math.max(...xs) + Math.min(...xs)) / 2
    expect(Math.abs(middle - (usable.left + centre * usable.width))).toBeLessThan(
      usable.width * 0.05,
    )
  })

  it('starts each track somewhere inside its own loop', () => {
    for (const densityIndex of [0, 3, 11]) {
      const generated = track({ densityIndex, aloft: 12 })
      expect(generated.delayMs).toBeLessThanOrEqual(0)
      expect(generated.delayMs).toBeGreaterThan(-generated.durationMs)
    }
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

describe('calm motion', () => {
  const extent = (frames: Array<{ x: number; y: number }>) => ({
    width: Math.max(...frames.map((f) => f.x)) - Math.min(...frames.map((f) => f.x)),
    height: Math.max(...frames.map((f) => f.y)) - Math.min(...frames.map((f) => f.y)),
  })

  it.each(flightPatterns.map((pattern) => pattern.id))(
    'flies %s smaller, slower and with softer banking',
    (patternId) => {
      const full = track({ patternId })
      const calm = track({ patternId, calm: true })
      expect(calm.durationMs).toBeGreaterThan(full.durationMs * 1.5)
      const fullExtent = extent(full.keyframes)
      const calmExtent = extent(calm.keyframes)
      expect(calmExtent.width).toBeLessThan(fullExtent.width)
      expect(calmExtent.height).toBeLessThanOrEqual(fullExtent.height)
      for (const key of calm.keyframes) {
        expect(Math.abs(key.bank)).toBeLessThanOrEqual(3.5)
      }
    },
  )

  it('still keeps the sprite inside the scene and closes its loop', () => {
    const calm = generateFlightTrack({ ...PHONE, calm: true, auraMargin: 12 })
    const scale = calm.scale
    for (const key of calm.keyframes) {
      expect(key.x - (64 * scale) / 2).toBeGreaterThanOrEqual(0)
      expect(key.x + (64 * scale) / 2).toBeLessThanOrEqual(PHONE.bounds.width)
    }
    const first = calm.keyframes[0]
    const last = calm.keyframes[calm.keyframes.length - 1]
    expect({ x: last.x, y: last.y, facing: last.facing }).toEqual({
      x: first.x,
      y: first.y,
      facing: first.facing,
    })
  })
})

/**
 * Where a track puts its butterfly `ms` into the garden's life, read the way
 * the animation does: its delay first, then straight lines between keyframes.
 */
function positionAt(generated: FlightTrack, ms: number) {
  const progress =
    ((((ms - generated.delayMs) / generated.durationMs) % 1) + 1) % 1
  const frames = generated.keyframes
  let index = 0
  while (index < frames.length - 2 && frames[index + 1].offset <= progress) index += 1
  const from = frames[index]
  const to = frames[index + 1]
  const along = (progress - from.offset) / (to.offset - from.offset)
  return { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along }
}

describe('room for every butterfly', () => {
  // The garden's own numbers: a 96 px sprite with a 12 px aura, under a title
  // that keeps the top 130 px clear, in a wide scene.
  const GARDEN: FlightMotionInput = {
    creatureId: 'marigold-guide',
    patternId: 'gentle-drift',
    bounds: { width: 1100, height: 510 },
    sprite: { width: 96, height: 88 },
    auraMargin: 12,
    safeTop: 130,
  }
  const GARDEN_PHONE: FlightMotionInput = {
    ...GARDEN,
    bounds: { width: 360, height: 460 },
    safeTop: 128,
  }
  /** The widest a sprite can be drawn: the largest scale a creature draws. */
  const SPRITE_WIDTH = 96 * 0.96

  function flock(
    patternId: FlightPatternId,
    scene: FlightMotionInput = GARDEN,
    names = (index: number) => `companion-${index}`,
    aloft = 12,
  ) {
    return Array.from({ length: aloft }, (_, index) =>
      generateFlightTrack({
        ...scene,
        creatureId: index === 0 ? 'marigold-guide' : names(index),
        patternId,
        densityIndex: index,
        aloft,
      }),
    )
  }

  function nearest(points: Array<{ x: number; y: number }>) {
    let closest = Infinity
    for (let a = 0; a < points.length; a += 1) {
      for (let b = a + 1; b < points.length; b += 1) {
        closest = Math.min(
          closest,
          Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y),
        )
      }
    }
    return closest
  }

  it.each(flightPatterns.map((pattern) => pattern.id))(
    'opens with twelve flying %s spread across the sky, none on top of another',
    (patternId) => {
      for (const set of ['a', 'b', 'c']) {
        const starts = flock(patternId, GARDEN, (index) => `${set}-${index}`).map(
          (generated) => positionAt(generated, 0),
        )
        // No two start within a sprite's width of each other...
        expect(nearest(starts)).toBeGreaterThan(SPRITE_WIDTH)
        // ...and between them they reach across most of the band.
        const xs = starts.map((point) => point.x)
        const usable = GARDEN.bounds.width - 2 * (SPRITE_WIDTH / 2 + 12)
        expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(usable * 0.75)
      }
    },
  )

  it('keeps a full garden spread out as it flies, not only as it opens', () => {
    // Every butterfly on one loop, as before, overlapped some other almost all
    // the time: their nearest neighbour averaged about 7 px over two minutes.
    for (const pattern of flightPatterns) {
      const tracks = flock(pattern.id)
      let nearestTotal = 0
      let middleTotal = 0
      let moments = 0
      const third = GARDEN.bounds.width / 3
      for (let ms = 0; ms <= 120_000; ms += 1000) {
        const points = tracks.map((generated) => positionAt(generated, ms))
        nearestTotal += nearest(points)
        middleTotal += points.filter((point) => point.x > third && point.x < third * 2).length
        moments += 1
      }
      expect(nearestTotal / moments, pattern.id).toBeGreaterThan(30)
      // No more than half of them in the middle third, on average.
      expect(middleTotal / moments, pattern.id).toBeLessThan(6)
    }
  })

  it('gives each butterfly its own patch of sky, the first few already far apart', () => {
    const tracks = flock('gentle-drift')
    const centres = tracks.map((generated) => {
      const xs = generated.keyframes.map((frame) => frame.x)
      return (Math.max(...xs) + Math.min(...xs)) / 2
    })
    expect(new Set(centres.map((x) => Math.round(x))).size).toBe(12)
    // In calm motion only the first four fly: guide, companion and two more.
    const firstFour = centres.slice(0, 4)
    expect(Math.max(...firstFour) - Math.min(...firstFour)).toBeGreaterThan(
      GARDEN.bounds.width * 0.4,
    )
  })

  it('narrows each loop as more share the sky, though never to a hover', () => {
    const width = (generated: FlightTrack) => {
      const xs = generated.keyframes.map((frame) => frame.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    const alone = width(flock('breeze-glide', GARDEN, undefined, 1)[0])
    const two = width(flock('breeze-glide', GARDEN, undefined, 2)[0])
    const twelve = width(flock('breeze-glide', GARDEN, undefined, 12)[0])
    expect(two).toBeLessThan(alone)
    expect(twelve).toBeLessThan(two)
    // A loop is never narrowed below 1.2 sprites, unless the pattern is
    // narrower than that to begin with.
    for (const scene of [GARDEN, GARDEN_PHONE]) {
      for (const pattern of flightPatterns) {
        flock(pattern.id, scene).forEach((generated, index) => {
          const lone = width(
            generateFlightTrack({
              ...scene,
              creatureId: index === 0 ? 'marigold-guide' : `companion-${index}`,
              patternId: pattern.id,
            }),
          )
          expect(width(generated)).toBeGreaterThanOrEqual(
            Math.min(lone, 96 * generated.scale * 1.2) - 0.05,
          )
        })
      }
    }
  })

  it('keeps every lane inside the scene, its aura and the title clear', () => {
    // Thousands of keyframes: gathered and checked once, since an expect per
    // coordinate made this one test take seconds on a busy machine.
    const strays: string[] = []
    for (const pattern of flightPatterns) {
      for (const scene of [GARDEN, GARDEN_PHONE, SCENE, PHONE]) {
        for (const aloft of [2, 3, 4, 7, 12]) {
          for (const calm of [false, true]) {
            const margin = scene.auraMargin ?? 0
            const top = scene.safeTop ?? 0
            const at = `${pattern.id} ${scene.bounds.width}x${scene.bounds.height} aloft ${aloft}${calm ? ' calm' : ''}`
            for (const generated of flock(pattern.id, { ...scene, calm }, undefined, aloft)) {
              const halfWidth = (scene.sprite.width * generated.scale) / 2 + margin
              const halfHeight = (scene.sprite.height * generated.scale) / 2 + margin
              for (const frame of generated.keyframes) {
                if (
                  frame.x < halfWidth - 0.01 ||
                  frame.x > scene.bounds.width - halfWidth + 0.01 ||
                  frame.y < top + halfHeight - 0.01 ||
                  frame.y > scene.bounds.height - halfHeight + 0.01
                ) {
                  strays.push(`${at}: (${frame.x}, ${frame.y})`)
                }
              }
              const first = generated.keyframes[0]
              const last = generated.keyframes[generated.keyframes.length - 1]
              if (last.x !== first.x || last.y !== first.y || last.facing !== first.facing) {
                strays.push(`${at}: the loop does not close`)
              }
            }
          }
        }
      }
    }
    expect(strays).toEqual([])
  })

  it('still rests a full garden apart when motion is switched off', () => {
    const resting = Array.from({ length: 12 }, (_, index) =>
      generateFlightTrack({
        ...GARDEN,
        creatureId: `companion-${index}`,
        densityIndex: index,
        aloft: 12,
        reducedMotion: true,
      }),
    )
    // No two sprites overlap where they wait.
    for (const [a, one] of resting.entries()) {
      for (const other of resting.slice(a + 1)) {
        const apartX =
          Math.abs(one.staticPose.x - other.staticPose.x) >=
          (96 * (one.scale + other.scale)) / 2
        const apartY =
          Math.abs(one.staticPose.y - other.staticPose.y) >=
          (88 * (one.scale + other.scale)) / 2
        expect(apartX || apartY).toBe(true)
      }
    }
  })
})
