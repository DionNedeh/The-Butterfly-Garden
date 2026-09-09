import { useEffect, useRef } from 'react'
import { coverGeometry } from '../lib/customBackdrops'
import type { CustomBackdrop } from '../types'

export function CustomBackdropImage({
  image,
  onError,
}: {
  image: CustomBackdrop
  onError?: () => void
}) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const element = ref.current
    const frame = element?.parentElement
    if (!element || !frame) return
    const layout = () => {
      const geometry = coverGeometry(
        image,
        { width: frame.clientWidth, height: frame.clientHeight },
        image.crop,
      )
      Object.assign(element.style, {
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
        left: `${geometry.left}px`,
        top: `${geometry.top}px`,
      })
    }
    const observer = new ResizeObserver(layout)
    observer.observe(frame)
    layout()
    return () => observer.disconnect()
  }, [image])
  return (
    <img
      ref={ref}
      className="custom-scene-image"
      src={`data:${image.mimeType};base64,${image.imageData}`}
      alt=""
      onError={onError}
      draggable={false}
    />
  )
}
