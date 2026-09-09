import type { AppState, ShopItemDefinition } from '../../types'
import { balanceFor, currencyLabel } from '../../lib/currency'
import { canWearItem } from '../../lib/gardenPass'
import { stageLabels } from '../../lib/lifecycle'
import { CreatureSprite } from '../sprites/CreatureSprite'
import { Icon } from '../Icons'

export function ShopItemCard({
  item,
  state,
  onPurchase,
  onPreview,
  onWardrobe,
}: {
  item: ShopItemDefinition
  state: AppState
  onPurchase: (id: string) => void
  onPreview: () => void
  onWardrobe: () => void
}) {
  const owned = state.ownedItemIds.includes(item.id)
  const allowed = canWearItem(state.ownedItemIds, item)
  const affordable = balanceFor(state, item.currency) >= item.cost
  const supply = item.kind === 'supply'
  return (
    <article className={`boutique-card ${item.premium ? 'pass-piece' : ''}`}>
      <div className="item-art">
        {supply ? (
          <Icon name={item.icon} size={48} />
        ) : (
          <CreatureSprite
            speciesId="monarch"
            stage={item.stages?.[0] ?? 'butterfly'}
            size={120}
            outfit={item.slot ? { [item.slot]: item.id } : {}}
          />
        )}
        <span className="item-tag">
          {item.premium ? 'Pass preview' : supply ? 'Care supply' : item.slot}
        </span>
        {!supply && (
          <button
            className="preview-button"
            aria-label={`Preview ${item.name}`}
            onClick={onPreview}
          >
            Try on
          </button>
        )}
      </div>
      <div className="item-copy">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <small className="item-fit">
          {supply
            ? `In satchel: ${state.inventory[item.id] ?? 0}`
            : `Fits: ${item.stages?.map((stage) => stageLabels[stage]).join(', ')}`}
        </small>
        <div className="item-footer">
          <span className="pattern-cost">
            <Icon
              name={item.currency === 'stardust' ? 'stardust' : 'nectar'}
              size={17}
            />
            {item.premium
              ? 'Included'
              : `${item.cost} ${currencyLabel(item.currency)}`}
          </span>
          {item.premium || owned ? (
            <button
              className="secondary-button compact"
              disabled={!allowed}
              onClick={onWardrobe}
            >
              {allowed ? 'Open wardrobe' : 'Unavailable'}
            </button>
          ) : (
            <button
              className="primary-button compact"
              disabled={!affordable}
              onClick={() => onPurchase(item.id)}
            >
              {affordable
                ? supply
                  ? 'Buy one'
                  : 'Buy'
                : `Need ${item.cost - balanceFor(state, item.currency)} more`}
            </button>
          )}
        </div>
        {owned && (
          <span className="owned-note">Owned · shared by all companions</span>
        )}
      </div>
    </article>
  )
}
