import { useEffect, useRef, useState } from 'react'
import { species } from '../data/content'
import { toLocalDate } from '../lib/date'
import { marigoldLine } from '../lib/gardenLines'
import { bondLevel, stageLabels } from '../lib/lifecycle'
import type { CreatureInstance, OutfitSlot, RegionId } from '../types'
import { ButterflySprite } from './sprites/ButterflySprite'
import './butterflyCard.css'

/**
 * Who a butterfly in the garden is, opened by tapping it.
 *
 * A native modal dialog, so it is reached and left the way every dialog in
 * the app is: focus moves into it and stays there, and Escape, a tap outside,
 * Close and Android's back gesture (lib/backNavigation) all end in its close
 * event. The garden hands focus back to the butterfly from there.
 *
 * Petting lives here now, as a button of its own. A tap on a flying butterfly
 * used to pet it; it opens this instead, so one press can never do both, and
 * a hello is still one more tap away, with the same hearts and the same words
 * read out.
 */
export function ButterflyCard({
  creature,
  outfit,
  region,
  onCareFor,
  onClose,
}: {
  /** The companion, or none for Marigold, who is the garden's guide. */
  creature?: CreatureInstance
  outfit?: Partial<Record<OutfitSlot, string>>
  /** Where the gardener gardens, whose seasons Marigold's travels follow. */
  region?: RegionId
  /** Opens Care with this companion chosen. */
  onCareFor?: () => void
  /** Called once the dialog has closed, however it was closed. */
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [petCount, setPetCount] = useState(0)
  useEffect(() => {
    dialog.current?.showModal()
    // Its first action, as a browser's own dialog focusing would choose,
    // said outright so every engine agrees.
    dialog.current?.querySelector<HTMLElement>('.butterfly-card-actions button')?.focus()
  }, [])
  const close = () => dialog.current?.close()
  const name = creature?.name ?? 'Marigold'
  const speciesId = creature?.speciesId ?? 'monarch'
  const speciesName =
    species.find((item) => item.id === speciesId)?.commonName ?? 'Butterfly'
  // Marigold's season, in autumn and spring: words only, she never leaves.
  const travels = creature ? undefined : marigoldLine(region, toLocalDate())

  return (
    <dialog
      ref={dialog}
      className="garden-dialog butterfly-card"
      aria-labelledby="butterfly-card-name"
      onClose={onClose}
      onClick={(event) => {
        // The body fills the dialog, so only a tap on the backdrop lands here.
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="butterfly-card-body">
        <div className="butterfly-card-portrait" aria-hidden="true">
          <ButterflySprite speciesId={speciesId} size={112} outfit={outfit} />
          {petCount > 0 && (
            <span className="heart-burst" key={petCount}>
              <span>♥</span>
              <span>♥</span>
              <span>♥</span>
            </span>
          )}
        </div>
        <p className="eyebrow">
          {speciesName} · {stageLabels[creature?.stage ?? 'butterfly']}
        </p>
        <h2 id="butterfly-card-name">{name}</h2>
        <p>
          {creature
            ? `Bond level ${bondLevel(creature.bond)}`
            : 'Your garden guide, who looks after the garden with you.'}
        </p>
        {travels && <p>{travels}</p>}
        <div className="form-actions butterfly-card-actions">
          {creature && onCareFor && (
            <button className="primary-button" onClick={onCareFor}>
              Care for {name}
            </button>
          )}
          <button
            className="secondary-button"
            onClick={() => setPetCount((count) => count + 1)}
          >
            Pet {name}
          </button>
          <button className="secondary-button" onClick={close}>
            Close
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {petCount > 0 ? `${name} enjoyed that gentle hello.` : ''}
        </span>
      </div>
    </dialog>
  )
}
