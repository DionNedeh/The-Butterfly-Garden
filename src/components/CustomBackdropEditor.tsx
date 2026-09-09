import { useEffect, useRef, useState } from 'react'
import type { CustomBackdrop } from '../types'
import { prepareBackdrop } from '../lib/imageImport'
import { clampCrop, coverGeometry } from '../lib/customBackdrops'
import { CustomBackdropImage } from './CustomBackdropImage'

export default function CustomBackdropEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: CustomBackdrop
  onSave: (image: CustomBackdrop) => Promise<{ ok: boolean; message?: string }>
  onClose: () => void
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
  const [busy, setBusy] = useState(false)
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
      if (ticket === sequence.current)
        setDraft(
          initial
            ? { ...image, id: initial.id, createdAt: initial.createdAt }
            : image,
        )
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
              {busy ? 'Preparing…' : 'Save & use backdrop'}
            </button>
          </div>
        </>
      )}
      {busy && (
        <p role="status">Preparing your image. This may take a moment.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </dialog>
  )
}
