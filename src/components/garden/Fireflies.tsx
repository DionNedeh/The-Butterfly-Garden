import { useEffect, useRef } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import './fireflies.css'

/** A handful, so the night stays calm and the compositor's work small. */
export const FIREFLY_COUNT = 5

/**
 * Fireflies drifting low over the night garden, in place of the day's falling
 * petals (plan b G5). GardenView loads them only at night and only with full
 * motion: never with reduced motion (the setting, which is the shell's
 * `.reduce-motion`) or Calm motion. The device's own reduced-motion
 * preference is checked here, where the garden itself does not look.
 *
 * Each firefly is a small glowing dot whose drift is a transform and whose
 * glow is its opacity, both on its own composited layer, so the main thread
 * does nothing while they move; no React render happens per frame. Out of
 * view they pause, marked `data-offscreen` as the sprites are (SpriteFrame),
 * and a hidden tab pauses them with everything else (`.page-hidden`). Their
 * observer is their own, so the garden's first load gains nothing for them.
 */
export function Fireflies() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const field = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = field.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => element.toggleAttribute('data-offscreen', !entry.isIntersecting),
      { rootMargin: '64px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [reduced])
  if (reduced) return null
  return (
    <div className="hero-fireflies" aria-hidden="true" ref={field}>
      {Array.from({ length: FIREFLY_COUNT }, (_, index) => (
        <span key={index} className={`hero-firefly firefly-${index + 1}`} />
      ))}
    </div>
  )
}
