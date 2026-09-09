import { useEffect, useRef, useState } from 'react'
import type { CreatureStage, ShopItemDefinition } from '../../types'
import { CreatureSprite } from '../sprites/CreatureSprite'
import { stageLabels } from '../../lib/lifecycle'

export function ItemPreview({
  item,
  onClose,
}: {
  item: ShopItemDefinition
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [stage, setStage] = useState<CreatureStage>(
    item.stages?.[0] ?? 'butterfly',
  )
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="garden-dialog outfit-dialog"
      aria-labelledby="preview-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Try a little something</p>
          <h2 id="preview-title">{item.name}</h2>
        </div>
        <button className="secondary-button compact" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="outfit-stage">
        <CreatureSprite
          speciesId="monarch"
          stage={stage}
          size={220}
          outfit={item.slot ? { [item.slot]: item.id } : {}}
        />
      </div>
      <p>{item.description}</p>
      <label>
        Preview life stage
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value as CreatureStage)}
        >
          {item.stages?.map((value) => (
            <option key={value} value={value}>
              {stageLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <p className="subtle-copy">
        Just trying it on. Your companion's outfit stays as it is.
      </p>
    </dialog>
  )
}
