import { useEffect, useRef, useState } from 'react'
import type { CustomBackdrop } from '../types'
import { prepareBackdrop, turnBackdrop } from '../lib/imageImport'
import {
  clampCrop,
  coverGeometry,
  CUSTOM_BACKDROP_LIMITS,
} from '../lib/customBackdrops'
import {
  addQuarterTurn,
  brightnessWords,
  turnCrop,
  withBrightness,
  type TurnStep,
} from '../lib/backdropEdits'
import { CustomBackdropImage } from './CustomBackdropImage'
import './backdrops/backdrops.css'

export default function CustomBackdropEditor({
  initial,
  onSave,
  onClose,
  saveLabel = 'Save & use backdrop',
}: {
  initial?: CustomBackdrop
  onSave: (image: CustomBackdrop) => Promise<{ ok: boolean; message?: string }>
  onClose: () => void
  /** What saving does, when it is not also choosing the image for the day. */
  saveLabel?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const sequence = useRef(0)
  const drag = useRef<{
    x: number
    y: number
    cropX: number
    cropY: number
  } | null>(null)
  const [draft, setDraft] = useState(initial)
  // What a turn is made from: the chosen file, or the image as it was stored,
  // with the total quarter turns asked of it. Turning from the source each
  // time, never from the last turned copy, keeps the picture one encoding
  // away from the original however often it is turned.
  const source = useRef<File | CustomBackdrop | undefined>(initial)
  const turns = useRef(0)
  const [busy, setBusy] = useState(false)
  const [turning, setTurning] = useState(false)
  const [error, setError] = useState('')
  const [shape, setShape] = useState<'wide' | 'phone'>('wide')
  useEffect(() => {
    dialog.current?.showModal()
    const token = sequence
    return () => {
      token.current++
    }
  }, [])
  const choose = async (file: File) => {
    const ticket = ++sequence.current
    setBusy(true)
    setError('')
    try {
      const image = await prepareBackdrop(file)
      if (ticket === sequence.current) {
        source.current = file
        turns.current = 0
        setDraft(
          initial
            ? { ...image, id: initial.id, createdAt: initial.createdAt }
            : image,
        )
      }
    } catch (cause) {
      if (ticket === sequence.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'That image could not be read.',
        )
    } finally {
      if (ticket === sequence.current) setBusy(false)
    }
  }
  const close = () => {
    if (!busy) onClose()
  }
  const turn = async (step: TurnStep) => {
    const from = source.current
    if (busy || !from) return
    const ticket = ++sequence.current
    const next = addQuarterTurn(turns.current, step)
    setBusy(true)
    setTurning(true)
    setError('')
    try {
      // Back to as it was stored: the stored copy itself, not a new one.
      const pixels =
        next === 0 && 'imageData' in from ? from : await turnBackdrop(from, next)
      if (ticket === sequence.current) {
        turns.current = next
        const { mimeType, width, height, byteLength, imageData } = pixels
        setDraft(
          (current) =>
            current && {
              ...current,
              mimeType,
              width,
              height,
              byteLength,
              imageData,
              crop: turnCrop(current.crop, step),
            },
        )
      }
    } catch (cause) {
      if (ticket === sequence.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'That image could not be turned.',
        )
    } finally {
      if (ticket === sequence.current) {
        setBusy(false)
        setTurning(false)
      }
    }
  }
  const brightness = draft?.brightness ?? 0
  return (
    <dialog
      ref={dialog}
      className="garden-dialog backdrop-editor"
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">A place of your own</p>
          <h2 id="editor-title">Frame your garden</h2>
        </div>
        <button
          className="secondary-button compact"
          onClick={close}
          disabled={busy}
        >
          Close
        </button>
      </div>
      <p>
        A resized copy stays on this device and in your garden backups. Your
        original file is unchanged. Animated images become a still picture.
      </p>
      <label className="image-upload">
        Choose a garden image
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void choose(file)
            event.target.value = ''
          }}
        />
      </label>
      {draft && (
        <>
          <label>
            Image name
            <input
              value={draft.name}
              maxLength={60}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              disabled={busy}
            />
          </label>
          <div className="segmented-control">
            <button
              aria-pressed={shape === 'wide'}
              onClick={() => setShape('wide')}
            >
              Wide preview
            </button>
            <button
              aria-pressed={shape === 'phone'}
              onClick={() => setShape('phone')}
            >
              Phone preview
            </button>
          </div>
          <div
            className={`crop-preview ${shape}`}
            onPointerDown={(event) => {
              if (busy) return
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                cropX: draft.crop.x,
                cropY: draft.crop.y,
              }
            }}
            onPointerMove={(event) => {
              if (!drag.current || busy) return
              const geometry = coverGeometry(
                draft,
                {
                  width: event.currentTarget.clientWidth,
                  height: event.currentTarget.clientHeight,
                },
                draft.crop,
              )
              const dx = geometry.width - event.currentTarget.clientWidth,
                dy = geometry.height - event.currentTarget.clientHeight
              setDraft({
                ...draft,
                crop: clampCrop({
                  ...draft.crop,
                  x:
                    drag.current.cropX -
                    (event.clientX - drag.current.x) / Math.max(1, dx),
                  y:
                    drag.current.cropY -
                    (event.clientY - drag.current.y) / Math.max(1, dy),
                }),
              })
            }}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
          >
            <CustomBackdropImage image={draft} />
            <span className="crop-caption">Your living sanctuary</span>
          </div>
          <p className="subtle-copy">
            Drag to reposition, or use the sliders below.
          </p>
          <div className="crop-controls">
            {(['zoom', 'x', 'y'] as const).map((key) => (
              <label key={key}>
                {key === 'zoom'
                  ? 'Zoom'
                  : key === 'x'
                    ? 'Horizontal position'
                    : 'Vertical position'}
                <input
                  type="range"
                  min={key === 'zoom' ? 1 : 0}
                  max={key === 'zoom' ? 3 : 1}
                  step="0.01"
                  value={draft.crop[key]}
                  disabled={busy}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      crop: {
                        ...draft.crop,
                        [key]: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="image-adjustments">
            {/* aria-disabled while a turn is made, so the button pressed
                keeps focus rather than dropping it to the page. */}
            <div className="turn-controls" role="group" aria-label="Turn the image">
              {([
                [-1, 'Turn left', '↺'],
                [1, 'Turn right', '↻'],
              ] as const).map(([step, label, glyph]) => (
                <button
                  key={label}
                  className="secondary-button"
                  aria-disabled={busy}
                  onClick={() => void turn(step)}
                >
                  {label} <span aria-hidden="true">{glyph}</span>
                </button>
              ))}
            </div>
            <label className="brightness-control">
              Brightness
              <input
                type="range"
                min={CUSTOM_BACKDROP_LIMITS.minBrightness}
                max={CUSTOM_BACKDROP_LIMITS.maxBrightness}
                step="5"
                value={brightness}
                aria-valuetext={brightnessWords(brightness)}
                disabled={busy}
                onChange={(event) =>
                  setDraft(withBrightness(draft, Number(event.target.value)))
                }
              />
              <span className="adjustment-value" aria-hidden="true">
                {brightnessWords(brightness)}
              </span>
            </label>
          </div>
          <p className="subtle-copy">
            A little darker helps your garden’s name stand out at night, a
            little lighter by day.
          </p>
          <div className="form-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                setDraft({ ...draft, crop: { x: 0.5, y: 0.5, zoom: 1 } })
              }
            >
              Reset crop
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError('')
                  try {
                    const result = await onSave({
                      ...draft,
                      name: draft.name.trim() || 'My garden image',
                      updatedAt: new Date().toISOString(),
                    })
                    if (result.ok) onClose()
                    else
                      setError(
                        result.message ?? 'Your image could not be saved.',
                      )
                  } catch {
                    setError(
                      'Your image could not be saved. Your draft is still here.',
                    )
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              {busy ? 'Preparing…' : saveLabel}
            </button>
          </div>
        </>
      )}
      {busy && (
        <p role="status">
          {turning
            ? 'Turning your image.'
            : 'Preparing your image. This may take a moment.'}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </dialog>
  )
}
