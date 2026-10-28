import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/**
 * One observer for every sprite on the page. A sprite out of view marks
 * itself `data-offscreen`, and the stylesheet pauses its layers: motion
 * nobody can see still costs the main thread a tick at every loop. A data
 * attribute, not a class, because React rewrites `className` on render.
 */
let offscreenObserver: IntersectionObserver | undefined

function pauseWhileOffscreen(element: Element): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {}
  offscreenObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.toggleAttribute('data-offscreen', !entry.isIntersecting)
      }
    },
    { rootMargin: '64px' },
  )
  const observer = offscreenObserver
  observer.observe(element)
  return () => observer.unobserve(element)
}

/**
 * The box a sprite is drawn in: an HTML element holding a stack of `<svg>`
 * layers that share one viewBox.
 *
 * Why layers. Chromium runs a CSS animation on an element *inside* an SVG
 * (a wing, a swaying stem) on the main thread, recalculating style and
 * layout every frame. With a dozen butterflies and eight plants moving, that
 * was most of the garden's main-thread time, and 22 fps on a slow phone. An
 * animation on an HTML-level box, which each layer's `<svg>` element is,
 * runs on the compositor instead, with no layout at all. So each moving part
 * gets its own layer, and the CSS animates the layer. The drawing inside is
 * unchanged.
 *
 * The size comes in as custom properties rather than an inline width, so a
 * stylesheet can still resize a sprite (`.item-art .butterfly-sprite`) the
 * way it could resize the old `<svg>`.
 */
export function SpriteFrame({
  width,
  height,
  className,
  label,
  style,
  children,
}: {
  width: number
  height: number
  className: string
  /** The accessible name. Without one the sprite is decoration and hidden. */
  label?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const frame = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const element = frame.current
    return element ? pauseWhileOffscreen(element) : undefined
  }, [])
  return (
    <span
      ref={frame}
      className={`sprite-frame ${className}`}
      style={{
        ['--sprite-w' as string]: `${width}px`,
        ['--sprite-h' as string]: `${height}px`,
        ...style,
      }}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      {children}
    </span>
  )
}

/** One layer of a sprite. Every layer of a sprite uses the same viewBox. */
export function SpriteLayer({
  viewBox,
  className = '',
  style,
  children,
}: {
  viewBox: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <svg
      viewBox={viewBox}
      className={`sprite-layer ${className}`}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}
