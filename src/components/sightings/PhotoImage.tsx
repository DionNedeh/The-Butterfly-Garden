import { useEffect, useRef } from 'react'

/**
 * A sighting's photo, drawn from its Blob. The address made for it lasts
 * only while it is on screen, and a new one is made for each photo, so a
 * field book of fifty photos holds no more than it shows.
 */
export function PhotoImage({
  photo,
  alt,
  className,
}: {
  photo: Blob
  alt: string
  className?: string
}) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const element = image.current
    if (!element) return
    let url: string
    try {
      url = URL.createObjectURL(photo)
    } catch {
      // A photo that cannot be shown says so through its text.
      return
    }
    element.src = url
    return () => {
      element.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [photo])
  return <img ref={image} className={className} alt={alt} decoding="async" />
}
