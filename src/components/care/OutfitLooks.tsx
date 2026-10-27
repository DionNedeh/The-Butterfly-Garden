import { useEffect, useId, useRef, useState } from 'react'
import { getShopItem, outfitSlots } from '../../data/shopItems'
import { MAX_OUTFIT_PRESETS, PRESET_NAME_LENGTH, presetName } from '../../lib/companionDiary'
import { presetFor, presetSaveProblem, suggestPresetName } from '../../lib/outfitPresets'
import { listed } from '../../lib/plural'
import type { WearLookResult } from '../../lib/wardrobe'
import type { CreatureInstance, OutfitPreset } from '../../types'
import { UndoToast, type UndoOffer } from '../UndoToast'
import { describeLookWorn } from './lookMessage'

/** The pieces of a look, by name, in the wardrobe's slot order. */
function lookPieces(preset: OutfitPreset): string {
  return listed(
    outfitSlots.flatMap(({ id }) => {
      const itemId = preset.outfit[id]
      return itemId ? (getShopItem(itemId)?.name ?? []) : []
    }),
  )
}

/**
 * Where focus goes once the page has redrawn, so it never falls to the page
 * body. A look that is not there sends focus to the heading instead.
 */
type FocusTarget =
  | { to: 'heading' }
  | { to: 'save' }
  | { to: 'look'; id: string; part: 'name' | 'rename' }

/** One open form at a time: naming a new look, or renaming a saved one. */
type Editing =
  | { kind: 'save'; creatureId: string; draft: string }
  | { kind: 'rename'; presetId: string; draft: string }

/**
 * Saved looks, under the wardrobe: keep what the selected companion is
 * wearing as a named look, and put any saved look on them in one go.
 * Wearing one says which pieces were left off and why, in a polite status
 * line. Deleting acts at once and offers Undo, as goals on Today do.
 */
export function OutfitLooks({
  creature,
  presets,
  onSave,
  onWear,
  onRename,
  onDelete,
  onRestore,
}: {
  creature: CreatureInstance
  presets: readonly OutfitPreset[]
  onSave: (creatureId: string, name: string) => void
  onWear: (creatureId: string, presetId: string) => Omit<WearLookResult, 'state'>
  onRename: (presetId: string, name: string) => void
  onDelete: (presetId: string) => void
  onRestore: (preset: OutfitPreset, index: number) => void
}) {
  const id = useId()
  const [editing, setEditing] = useState<Editing>()
  // Said for one companion only: choosing another starts quiet.
  const [said, setSaid] = useState<{ creatureId: string; text: string }>()
  const [undoOffer, setUndoOffer] = useState<UndoOffer>()
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const pendingFocus = useRef<FocusTarget>(undefined)

  // A look being named is one companion's outfit, so the form closes when
  // another companion is chosen, and stays closed on coming back.
  const [shownFor, setShownFor] = useState(creature.id)
  if (shownFor !== creature.id) {
    setShownFor(creature.id)
    if (editing?.kind === 'save') setEditing(undefined)
  }
  const naming = editing?.kind === 'save' && editing.creatureId === creature.id ? editing : undefined
  const renaming = editing?.kind === 'rename' ? editing : undefined
  const problem = presetSaveProblem(presets, creature.outfit)
  const savedAs = problem === 'saved' ? presetFor(presets, creature.outfit) : undefined

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = undefined
    if (target.to === 'save') {
      const button = saveButton.current ?? heading.current
      button?.focus()
      return
    }
    if (target.to === 'look') {
      const look = Array.from(
        root.current?.querySelectorAll<HTMLElement>('[data-look-id]') ?? [],
      ).find((element) => element.dataset.lookId === target.id)
      const control = look?.querySelector<HTMLElement>(
        target.part === 'name' ? '.look-name' : '.look-rename',
      )
      if (control) {
        control.focus()
        return
      }
    }
    heading.current?.focus()
  })

  // The field takes focus as its form opens, so typing can begin at once.
  const editingKey =
    editing?.kind === 'rename' ? `rename:${editing.presetId}` : naming && `save:${naming.creatureId}`
  useEffect(() => {
    if (editingKey) field.current?.focus()
  }, [editingKey])

  const say = (text: string) => setSaid({ creatureId: creature.id, text })
  const suggested = suggestPresetName(presets, creature.name)

  return (
    <div className="saved-looks" ref={root}>
      <h3 id={`${id}-title`} ref={heading} tabIndex={-1}>
        Saved looks
      </h3>

      {naming ? (
        <form
          className="look-form"
          onSubmit={(event) => {
            event.preventDefault()
            const name = presetName(naming.draft) || suggested
            // The outfit may have changed while the form was open; then the
            // line where the button was says why there was nothing to save.
            if (!problem) {
              onSave(creature.id, name)
              say(`Saved ${creature.name}’s outfit as ${name}.`)
            }
            setEditing(undefined)
            pendingFocus.current = { to: 'heading' }
          }}
        >
          <label>
            Name this look
            <input
              ref={field}
              value={naming.draft}
              maxLength={PRESET_NAME_LENGTH}
              autoComplete="off"
              onChange={(event) =>
                setEditing({ ...naming, draft: event.target.value })
              }
            />
          </label>
          <div className="look-form-actions">
            <button className="primary-button" type="submit">
              Save look
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditing(undefined)
                pendingFocus.current = { to: 'save' }
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : problem === 'empty' ? (
        <p className="subtle-copy">
          Dress {creature.name} in something, and the look can be saved to
          wear again.
        </p>
      ) : savedAs ? (
        <p className="subtle-copy">
          {creature.name}’s outfit is saved as {savedAs.name}.
        </p>
      ) : (
        <div className="look-save">
          <button
            ref={saveButton}
            className="secondary-button"
            aria-disabled={problem === 'full' || undefined}
            aria-describedby={problem === 'full' ? `${id}-full` : undefined}
            onClick={() => {
              if (problem === 'full') return
              setEditing({ kind: 'save', creatureId: creature.id, draft: suggested })
            }}
          >
            Save this look
          </button>
          {problem === 'full' && (
            <p className="subtle-copy" id={`${id}-full`}>
              The closet keeps {MAX_OUTFIT_PRESETS} looks. Delete one to save
              another.
            </p>
          )}
        </div>
      )}

      {presets.length === 0 ? (
        <p className="subtle-copy">
          A saved look can be put on any companion in one go.
        </p>
      ) : (
        <ul className="look-list" aria-labelledby={`${id}-title`}>
          {presets.map((preset, index) => (
            <li className="look" key={preset.id} data-look-id={preset.id}>
              {renaming?.presetId === preset.id ? (
                <form
                  className="look-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onRename(preset.id, renaming.draft)
                    setEditing(undefined)
                    pendingFocus.current = { to: 'look', id: preset.id, part: 'rename' }
                  }}
                >
                  <label>
                    New name for {preset.name}
                    <input
                      ref={field}
                      value={renaming.draft}
                      maxLength={PRESET_NAME_LENGTH}
                      autoComplete="off"
                      onChange={(event) =>
                        setEditing({ ...renaming, draft: event.target.value })
                      }
                    />
                  </label>
                  <div className="look-form-actions">
                    <button className="primary-button" type="submit">
                      Save new name
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setEditing(undefined)
                        pendingFocus.current = { to: 'look', id: preset.id, part: 'rename' }
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="look-copy">
                    <strong className="look-name" tabIndex={-1}>
                      {preset.name}
                    </strong>
                    <small>{lookPieces(preset)}</small>
                  </div>
                  <div className="look-actions">
                    <button
                      className="secondary-button"
                      aria-label={`Wear ${preset.name}`}
                      onClick={() =>
                        say(describeLookWorn(creature, preset, onWear(creature.id, preset.id)))
                      }
                    >
                      Wear
                    </button>
                    <button
                      className="text-button look-rename"
                      aria-label={`Rename ${preset.name}`}
                      onClick={() =>
                        setEditing({ kind: 'rename', presetId: preset.id, draft: preset.name })
                      }
                    >
                      Rename
                    </button>
                    <button
                      className="text-button danger-text"
                      aria-label={`Delete ${preset.name}`}
                      onClick={() => {
                        onDelete(preset.id)
                        pendingFocus.current = { to: 'heading' }
                        setUndoOffer({
                          message: `${preset.name} deleted.`,
                          undo: () => {
                            // The Undo button goes with the toast; focus goes
                            // to the look it put back.
                            onRestore(preset, index)
                            pendingFocus.current = { to: 'look', id: preset.id, part: 'name' }
                          },
                        })
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="look-status" role="status">
        {said?.creatureId === creature.id ? said.text : ''}
      </p>
      <UndoToast offer={undoOffer} onDone={() => setUndoOffer(undefined)} />
    </div>
  )
}
