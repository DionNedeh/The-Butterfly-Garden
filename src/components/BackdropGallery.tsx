import { lazy, Suspense, useState } from 'react'
import type { AppState, CustomBackdrop, GardenBackdropId } from '../types'
import {
  availableBackdropIds,
  daysUntilBackdrop,
  gardenBackdrops,
} from '../lib/appearance'
import { backdropAssets, loadBackdrop } from '../data/backdropAssets'
import { hasGardenPassFeature } from '../lib/gardenPass'
import { CUSTOM_BACKDROP_SLOTS } from '../lib/customBackdrops'
import { CustomBackdropImage } from './CustomBackdropImage'
import { isAndroidApp } from '../lib/platform'

const Editor = lazy(() => import('./CustomBackdropEditor'))
export interface BackdropActions {
  onSelectBackdrop: (id: GardenBackdropId) => void
  onSaveCustomBackdrop: (
    image: CustomBackdrop,
  ) => Promise<{ ok: boolean; message?: string }>
  onSelectCustomBackdrop: (id: string | undefined) => void
  onDeleteCustomBackdrop: (id: string) => void
}

export function BackdropGallery({
  state,
  onSelectBackdrop,
  onSaveCustomBackdrop,
  onSelectCustomBackdrop,
  onDeleteCustomBackdrop,
}: { state: AppState } & BackdropActions) {
  const [editor, setEditor] = useState<CustomBackdrop | 'new'>()
  const [removing, setRemoving] = useState<string>()
  const [loading, setLoading] = useState<GardenBackdropId>()
  const [message, setMessage] = useState('')
  const available = state.profile ? availableBackdropIds(state.profile) : []
  const customAllowed = hasGardenPassFeature('custom-backdrops')
  return (
    <section className="backdrop-gallery" aria-label="Garden backdrops">
      <div className="section-heading">
        <div>
          <p className="eyebrow">A change of scenery</p>
          <h2>Somewhere lovely to land</h2>
        </div>
        <span className="count-badge">{gardenBackdrops.length} scenes</span>
      </div>
      <p className="section-explainer">
        {isAndroidApp()
          ? 'Choose a little world for your garden. Every scene is already on your phone.'
          : "Choose a little world for your garden. Download a scene once to keep it close when you're offline."}
      </p>
      <div className="scene-grid">
        {gardenBackdrops.map((scene) => {
          const selected =
            state.profile?.selectedBackdropId === scene.id &&
            !state.profile.selectedCustomBackdropId
          const allowed = available.includes(scene.id)
          return (
            <article
              className={`scene-card ${selected ? 'selected' : ''}`}
              key={scene.id}
            >
              <img
                src={backdropAssets[scene.id].thumbnail}
                alt=""
                loading="lazy"
                width="400"
                height="225"
              />
              <div className="scene-card-copy">
                <span className="eyebrow">
                  {scene.unlock.kind === 'pass'
                    ? 'Garden Pass preview'
                    : scene.unlock.kind === 'free'
                      ? 'A gift for every garden'
                      : 'Grows with your garden'}
                </span>
                <h3>{scene.name}</h3>
                <p>{scene.description}</p>
                <button
                  className={selected ? 'secondary-button' : 'primary-button'}
                  disabled={!allowed || !!loading || selected}
                  onClick={() => {
                    void (async () => {
                      setLoading(scene.id)
                      setMessage('')
                      try {
                        await loadBackdrop(scene.id)
                        onSelectBackdrop(scene.id)
                        setMessage(`${scene.name} selected.`)
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : 'The scene could not be loaded.',
                        )
                      } finally {
                        setLoading(undefined)
                      }
                    })()
                  }}
                >
                  {loading === scene.id
                    ? 'Opening scene…'
                    : selected
                      ? 'In your garden'
                      : allowed
                        ? 'Use this scene'
                        : scene.unlock.kind === 'pass'
                          ? 'Garden Pass unavailable'
                          : `Opens in ${state.profile ? daysUntilBackdrop(state.profile, scene.id) : 0} days`}
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {message && (
        <p role="status" className="settings-note">
          {message}
        </p>
      )}
      <div className="section-heading personal-scenes-heading">
        <div>
          <p className="eyebrow">Your own corner of the world</p>
          <h2>Made personal</h2>
        </div>
        <span className="count-badge">
          {state.customBackdrops.length} / {CUSTOM_BACKDROP_SLOTS}
        </span>
      </div>
      <p className="section-explainer">
        A favourite place, a peaceful view, a memory. Your images stay on this
        device and travel with your garden backup.
      </p>
      <div className="scene-grid">
        {state.customBackdrops.map((image) => (
          <article className="scene-card" key={image.id}>
            <div className="custom-scene-thumb">
              <CustomBackdropImage image={image} />
            </div>
            <div className="scene-card-copy">
              <p className="eyebrow">Your image · on this device</p>
              <h3>{image.name}</h3>
              <div className="form-actions">
                <button
                  className="primary-button"
                  disabled={
                    !customAllowed ||
                    state.profile?.selectedCustomBackdropId === image.id
                  }
                  onClick={() => onSelectCustomBackdrop(image.id)}
                >
                  {state.profile?.selectedCustomBackdropId === image.id
                    ? 'Selected'
                    : 'Use image'}
                </button>
                <button
                  className="secondary-button"
                  disabled={!customAllowed}
                  onClick={() => setEditor(image)}
                >
                  Edit crop
                </button>
              </div>
              {removing === image.id ? (
                <div role="alert">
                  <p>
                    Remove this saved image? Your original file is unchanged.
                  </p>
                  <button
                    className="text-button danger-text"
                    onClick={() => {
                      onDeleteCustomBackdrop(image.id)
                      setRemoving(undefined)
                    }}
                  >
                    Yes, remove image
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setRemoving(undefined)}
                  >
                    Keep image
                  </button>
                </div>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setRemoving(image.id)}
                >
                  Remove image
                </button>
              )}
            </div>
          </article>
        ))}
        <button
          className="scene-upload-card"
          disabled={
            !customAllowed ||
            state.customBackdrops.length >= CUSTOM_BACKDROP_SLOTS
          }
          onClick={() => setEditor('new')}
        >
          <span aria-hidden="true">＋</span>
          <strong>Add your own backdrop</strong>
          <small>
            {!customAllowed
              ? 'Garden Pass unavailable'
              : state.customBackdrops.length >= CUSTOM_BACKDROP_SLOTS
                ? 'Your three image spaces are full'
                : 'JPEG, PNG or WebP · up to 10 MB'}
          </small>
        </button>
      </div>
      {editor && (
        <Suspense fallback={<p role="status">Opening your image studio…</p>}>
          <Editor
            initial={editor === 'new' ? undefined : editor}
            onSave={onSaveCustomBackdrop}
            onClose={() => setEditor(undefined)}
          />
        </Suspense>
      )}
    </section>
  )
}
