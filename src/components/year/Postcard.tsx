import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { backdropAssets } from '../../data/backdropAssets'
import { effectiveBackdropId, gardenBackdrops } from '../../lib/appearance'
import { activeCustomBackdrop } from '../../lib/customBackdrops'
import { hasGardenPassFeature } from '../../lib/gardenPass'
import { postcardButterflies } from '../../lib/gardenYear'
import { isAndroidApp } from '../../lib/platform'
import {
  browserDevice,
  describePostcard,
  drawPostcard,
  postcardFileName,
  POSTCARD_HEIGHT,
  POSTCARD_TYPE,
  POSTCARD_WIDTH,
  spriteSvg,
  type PostcardBackdrop,
  type PostcardDevice,
} from '../../lib/postcard'
import { saveImageFile } from '../../lib/saveImage'
import { canShareFile, shareFile } from '../../lib/shareFile'
import { yearLabel } from '../../lib/weatherCalendar'
import type { AppState } from '../../types'
import { ButterflySprite } from '../sprites/ButterflySprite'

type Card =
  | { kind: 'none' }
  | { kind: 'making' }
  | { kind: 'made'; blob: Blob; url: string; description: string }

/** The scene the card is drawn on, and how it is named in the card's description. */
interface Scene extends PostcardBackdrop {
  name: string
}

/**
 * The scene the garden shows by day: the gardener's own picture while it is
 * chosen and the Pass allows it, as the garden decides (lib/customBackdrops),
 * or the built-in scene it draws.
 */
function daytimeScene(state: AppState): Scene {
  const own = activeCustomBackdrop(state, hasGardenPassFeature('custom-backdrops'), 'sunlight')
  if (own)
    return {
      src: `data:${own.mimeType};base64,${own.imageData}`,
      crop: own.crop,
      brightness: own.brightness,
      name: 'your own picture',
    }
  const id = state.profile ? effectiveBackdropId(state.profile) : 'sunlit-meadow'
  const name = gardenBackdrops.find((backdrop) => backdrop.id === id)?.name ?? 'the garden'
  return { src: backdropAssets[id].image, name: `the ${name}` }
}

/**
 * The postcard at the end of "Your garden's year" (plan c.4): made on this
 * device only when the gardener asks, from the garden scene, their
 * butterflies, the garden's name and the year, and nothing from the
 * journal. It leaves the device only by their tap: Share, where the browser
 * can share an image, or Save image. A status line says what became of each,
 * and never claims more than it knows.
 */
export function Postcard({
  state,
  year,
  today,
  device = browserDevice,
}: {
  state: AppState
  year: number
  today: string
  /** The canvas, images and fonts to draw with; tests hand in their own. */
  device?: PostcardDevice
}) {
  const titleId = useId()
  const [card, setCard] = useState<Card>({ kind: 'none' })
  const [status, setStatus] = useState('')
  const sprites = useRef<HTMLDivElement>(null)
  const butterflies = useMemo(() => postcardButterflies(state, year, today), [state, year, today])
  const gardenName = state.profile?.gardenName ?? 'My Butterfly Garden'
  const yearWords = yearLabel(year)
  const fileName = postcardFileName(year)
  // The browser answers by name and type, so this is asked once.
  const [canShare] = useState(() => canShareFile(fileName, POSTCARD_TYPE))

  // Drawn once the sprites to copy are on the page, hidden, and only then.
  const making = card.kind === 'making'
  const latest = useRef({ state, butterflies, gardenName, yearWords, device })
  useEffect(() => {
    latest.current = { state, butterflies, gardenName, yearWords, device }
  })
  useEffect(() => {
    if (!making) return
    let current = true
    const { state, butterflies, gardenName, yearWords, device } = latest.current
    const frames = Array.from(sprites.current?.querySelectorAll('.sprite-frame') ?? [])
    const chosen = butterflies.flatMap((butterfly, index) => {
      const frame = frames[index]
      const svg = frame ? spriteSvg(frame) : undefined
      return svg ? [{ ...butterfly, svg }] : []
    })
    const scene = daytimeScene(state)
    drawPostcard(
      {
        gardenName,
        year: yearWords,
        backdrop: scene,
        butterflies: chosen.map((butterfly) => butterfly.svg),
      },
      device,
    ).then(
      (postcard) => {
        if (!current) return
        if (!postcard) {
          setCard({ kind: 'none' })
          setStatus('The postcard could not be made on this device.')
          return
        }
        setCard({
          kind: 'made',
          blob: postcard.blob,
          url: URL.createObjectURL(postcard.blob),
          description: describePostcard(gardenName, yearWords, {
            scene: postcard.backdrop ? scene.name : undefined,
            species: postcard.butterflies.map((index) => chosen[index].speciesName),
          }),
        })
        setStatus('Your postcard is ready.')
      },
      () => {
        if (!current) return
        setCard({ kind: 'none' })
        setStatus('The postcard could not be made on this device.')
      },
    )
    return () => {
      current = false
    }
  }, [making])

  // The preview's address lasts as long as the preview.
  const previewUrl = card.kind === 'made' ? card.url : undefined
  useEffect(() => (previewUrl ? () => URL.revokeObjectURL(previewUrl) : undefined), [previewUrl])

  const make = () => {
    if (making) return
    setStatus('Making your postcard…')
    setCard({ kind: 'making' })
  }

  const share = async () => {
    if (card.kind !== 'made') return
    setStatus('')
    try {
      const outcome = await shareFile(
        fileName,
        POSTCARD_TYPE,
        card.blob,
        `${gardenName}, ${yearWords}`,
      )
      setStatus(outcome === 'shared' ? 'Postcard shared.' : 'Nothing was shared.')
    } catch {
      setStatus('This browser would not share the postcard. Save it instead.')
    }
  }

  const save = async () => {
    if (card.kind !== 'made') return
    setStatus('')
    try {
      const outcome = await saveImageFile(fileName, card.blob)
      setStatus(
        outcome === 'saved'
          ? 'Postcard saved.'
          : outcome === 'cancelled'
            ? 'No image was saved.'
            : 'Your postcard is downloading. Check your downloads.',
      )
    } catch {
      setStatus(
        isAndroidApp()
          ? 'The postcard could not be saved there. Try choosing another place.'
          : 'This browser would not start the download.',
      )
    }
  }

  return (
    <section className="card postcard" aria-labelledby={titleId}>
      <p className="eyebrow">A keepsake</p>
      <h2 id={titleId}>A postcard of your garden</h2>
      <p className="section-explainer">
        Made here, on your device, from your garden’s scene, your butterflies,
        its name and the year. Nothing from your journal is on it, and it
        goes nowhere unless you share or save it.
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="primary-button"
          // Not disabled while it is made, so focus stays on it.
          aria-disabled={making}
          onClick={make}
        >
          {card.kind === 'made' ? 'Make it again' : 'Make a postcard'}
        </button>
      </div>
      {making && (
        // The sprites the card copies its butterflies from, never shown.
        <div ref={sprites} hidden>
          {butterflies.map((butterfly, index) => (
            <ButterflySprite key={index} speciesId={butterfly.speciesId} flapping={false} />
          ))}
        </div>
      )}
      {card.kind === 'made' && (
        <div className="postcard-preview">
          <img
            src={card.url}
            alt={card.description}
            width={POSTCARD_WIDTH}
            height={POSTCARD_HEIGHT}
          />
        </div>
      )}
      {card.kind === 'made' && (
        <div className="form-actions postcard-actions">
          {canShare && (
            <button type="button" className="secondary-button" onClick={() => void share()}>
              Share…
            </button>
          )}
          <button type="button" className="secondary-button" onClick={() => void save()}>
            Save image
          </button>
        </div>
      )}
      <p className="settings-note postcard-status" role="status">
        {status}
      </p>
    </section>
  )
}
