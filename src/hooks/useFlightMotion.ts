import { useEffect, useRef } from 'react'
import { generateFlightTrack } from '../lib/flightMotion'
import type { FlightPatternId } from '../types'

/** Travel and facing have separate animation channels: a turn never scales through zero. */
export function useFlightMotion(
  id: string,
  pattern: FlightPatternId,
  index: number,
  size: number,
  reduced: boolean,
  preview: boolean,
) {
  const travel = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = travel.current
    const face = heading.current
    const frame = element?.parentElement
    if (!element || !face || !frame) return
    if (
      typeof matchMedia === 'undefined' ||
      typeof ResizeObserver === 'undefined' ||
      typeof IntersectionObserver === 'undefined'
    )
      return
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    let animations: Animation[] = []
    let visible = true
    let focused = false
    let hovered = false
    let previousSize = ''
    const sync = () => {
      const paused = document.hidden || !visible || focused || hovered
      element.classList.toggle('flight-paused', paused)
      animations.forEach((animation) => {
        if (paused) animation.pause()
        else animation.play()
      })
    }
    const create = () => {
      animations.forEach((animation) => animation.cancel())
      animations = []
      const track = generateFlightTrack({
        creatureId: id,
        patternId: pattern,
        bounds: { width: frame.clientWidth, height: frame.clientHeight },
        sprite: { width: size, height: (size * 110) / 120 },
        densityIndex: index,
        auraMargin: preview ? 3 : 12,
        safeTop: preview ? 0 : Math.min(130, frame.clientHeight * 0.28),
        reducedMotion: reduced || preference.matches,
      })
      const pose = track.staticPose
      element.style.transform = `translate(${pose.x}px, ${pose.y}px)`
      face.style.transform = `translate(-50%, -50%) scale(${track.scale}) scaleX(${pose.facing})`
      if (reduced || preference.matches || !element.animate) return
      const timing = {
        duration: track.durationMs,
        delay: track.delayMs,
        iterations: Infinity,
        easing: 'linear',
      }
      animations = [
        element.animate(
          track.keyframes.map((key) => ({
            offset: key.offset,
            transform: `translate(${key.x}px, ${key.y}px)`,
          })),
          timing,
        ),
        face.animate(
          track.keyframes.map((key) => ({
            offset: key.offset,
            easing: 'steps(1, end)',
            transform: `translate(-50%, -50%) scale(${track.scale}) scaleX(${key.facing}) rotate(${key.bank}deg)`,
          })),
          timing,
        ),
      ]
      sync()
    }
    const resize = new ResizeObserver(() => {
      const next = `${frame.clientWidth}:${frame.clientHeight}`
      if (next !== previousSize) {
        previousSize = next
        create()
      }
    })
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    const focus = () => {
      focused = true
      sync()
    }
    const blur = () => {
      focused = false
      sync()
    }
    const enter = () => {
      hovered = true
      sync()
    }
    const leave = () => {
      hovered = false
      sync()
    }
    resize.observe(frame)
    observer.observe(frame)
    document.addEventListener('visibilitychange', sync)
    preference.addEventListener('change', create)
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointerleave', leave)
    element.addEventListener('focusin', focus)
    element.addEventListener('focusout', blur)
    create()
    return () => {
      animations.forEach((animation) => animation.cancel())
      resize.disconnect()
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      preference.removeEventListener('change', create)
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointerleave', leave)
      element.removeEventListener('focusin', focus)
      element.removeEventListener('focusout', blur)
    }
  }, [id, pattern, index, size, reduced, preview])
  return { travel, heading }
}
